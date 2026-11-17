import os
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, render_template, redirect, url_for, flash, request, abort, current_app
from flask_login import login_required, current_user
from app import db, role_required
from app.models.complaint import Complaint, Assignment, StatusUpdate, RepairEvidence, Feedback, MaintenanceRecord
from app.services.notification_service import NotificationService

worker_bp = Blueprint('worker', __name__)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

@worker_bp.before_request
@login_required
@role_required('worker')
def ensure_worker():
    pass

@worker_bp.route('/dashboard')
def dashboard():
    worker = current_user.worker_profile
    if not worker:
        abort(400, "Worker profile not found")

    assignments = Assignment.query.filter_by(worker_id=worker.id).order_by(Assignment.assigned_at.desc()).all()

    assigned_tasks = [a for a in assignments if a.status == 'Assigned']
    in_progress_tasks = [a for a in assignments if a.status in ['Accepted', 'In Progress']]
    rework_tasks = [a for a in assignments if a.complaint.status == 'Rework Required']
    pending_verification_tasks = [a for a in assignments if a.complaint.status == 'Pending Verification']
    completed_tasks = [a for a in assignments if a.status == 'Completed' or a.complaint.status == 'Closed']

    # Feedback ratings
    complaint_ids = [a.complaint_id for a in completed_tasks]
    feedbacks = Feedback.query.filter(Feedback.complaint_id.in_(complaint_ids)).all() if complaint_ids else []
    avg_rating = round(sum(f.rating for f in feedbacks) / len(feedbacks), 1) if feedbacks else 0.0

    return render_template(
        'worker/dashboard.html',
        worker=worker,
        assigned_tasks=assigned_tasks,
        in_progress_tasks=in_progress_tasks,
        rework_tasks=rework_tasks,
        pending_verification_tasks=pending_verification_tasks,
        completed_count=len(completed_tasks),
        avg_rating=avg_rating,
        feedback_count=len(feedbacks)
    )


@worker_bp.route('/tasks/<int:task_id>')
def task_detail(task_id):
    worker = current_user.worker_profile
    assignment = Assignment.query.filter_by(id=task_id, worker_id=worker.id).first_or_404()
    complaint = assignment.complaint
    return render_template('worker/task_detail.html', assignment=assignment, complaint=complaint)


@worker_bp.route('/tasks/<int:task_id>/accept', methods=['POST'])
def accept_task(task_id):
    worker = current_user.worker_profile
    assignment = Assignment.query.filter_by(id=task_id, worker_id=worker.id).first_or_404()
    complaint = assignment.complaint

    assignment.status = 'In Progress'
    assignment.accepted_at = datetime.utcnow()
    complaint.status = 'In Progress'
    if not complaint.started_at:
        complaint.started_at = datetime.utcnow()

    update = StatusUpdate(
        complaint_id=complaint.id,
        old_status='Assigned',
        new_status='In Progress',
        changed_by_id=current_user.id,
        comment=f"Worker {current_user.full_name} accepted the task and initiated maintenance."
    )
    db.session.add(update)
    db.session.commit()

    # Notify Resident
    NotificationService.notify(
        user_id=complaint.resident.user_id,
        title=f"Worker Started: {complaint.complaint_no}",
        message=f"{current_user.full_name} ({worker.specialty}) has accepted and started work on your ticket.",
        link=url_for('resident.complaint_detail', complaint_id=complaint.id),
        category='info'
    )

    flash('Task accepted! You may now perform maintenance and record repair evidence.', 'success')
    return redirect(url_for('worker.task_detail', task_id=assignment.id))


@worker_bp.route('/tasks/<int:task_id>/submit-evidence', methods=['POST'])
def submit_evidence(task_id):
    worker = current_user.worker_profile
    assignment = Assignment.query.filter_by(id=task_id, worker_id=worker.id).first_or_404()
    complaint = assignment.complaint

    inspection_notes = request.form.get('inspection_notes', '').strip()
    repair_description = request.form.get('repair_description', '').strip()
    parts_replaced = request.form.get('parts_replaced', '').strip()
    time_spent = request.form.get('time_spent_minutes', type=int, default=45)

    if not repair_description:
        flash('Please describe the repair work performed.', 'danger')
        return redirect(url_for('worker.task_detail', task_id=assignment.id))

    # Evidence photos upload
    before_url = None
    after_url = None

    if 'before_photo' in request.files:
        f_before = request.files['before_photo']
        if f_before and f_before.filename and allowed_file(f_before.filename):
            fname = secure_filename(f"evid_before_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{f_before.filename}")
            f_before.save(os.path.join(current_app.config['UPLOAD_FOLDER'], 'evidence', fname))
            before_url = f"uploads/evidence/{fname}"

    if 'after_photo' in request.files:
        f_after = request.files['after_photo']
        if f_after and f_after.filename and allowed_file(f_after.filename):
            fname = secure_filename(f"evid_after_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{f_after.filename}")
            f_after.save(os.path.join(current_app.config['UPLOAD_FOLDER'], 'evidence', fname))
            after_url = f"uploads/evidence/{fname}"

    if not after_url:
        flash('Please upload an after-repair completion photograph as verification evidence.', 'danger')
        return redirect(url_for('worker.task_detail', task_id=assignment.id))

    evidence = RepairEvidence(
        complaint_id=complaint.id,
        worker_id=worker.id,
        before_photo_url=before_url,
        after_photo_url=after_url,
        inspection_notes=inspection_notes,
        repair_description=repair_description,
        parts_replaced=parts_replaced,
        time_spent_minutes=time_spent
    )
    db.session.add(evidence)

    # Transition complaint to Pending Verification
    old_status = complaint.status
    complaint.status = 'Pending Verification'
    complaint.submitted_for_verification_at = datetime.utcnow()
    assignment.status = 'Submitted'

    update = StatusUpdate(
        complaint_id=complaint.id,
        old_status=old_status,
        new_status='Pending Verification',
        changed_by_id=current_user.id,
        comment=f"Worker {current_user.full_name} submitted repair completion evidence for resident verification."
    )
    db.session.add(update)

    # Also log MaintenanceRecord if asset is linked
    if complaint.asset_id:
        m_rec = MaintenanceRecord(
            asset_id=complaint.asset_id,
            complaint_id=complaint.id,
            performed_by_id=worker.id,
            maintenance_type='Corrective',
            notes=repair_description,
            cost=0.0
        )
        db.session.add(m_rec)

    db.session.commit()

    # Notify Resident that verification is required
    NotificationService.notify(
        user_id=complaint.resident.user_id,
        title=f"Verification Required: {complaint.complaint_no}",
        message=f"{current_user.full_name} has completed repair work. Please review the evidence and approve or reject.",
        link=url_for('resident.complaint_detail', complaint_id=complaint.id),
        category='info'
    )

    flash('Repair evidence submitted successfully! Waiting for resident verification.', 'success')
    return redirect(url_for('worker.dashboard'))


@worker_bp.route('/history')
def history():
    worker = current_user.worker_profile
    assignments = Assignment.query.filter_by(worker_id=worker.id)\
        .order_by(Assignment.assigned_at.desc()).all()
    return render_template('worker/history.html', assignments=assignments)
