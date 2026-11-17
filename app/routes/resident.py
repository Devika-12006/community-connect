import os
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, render_template, redirect, url_for, flash, request, abort, current_app
from flask_login import login_required, current_user
from app import db, role_required
from app.models.complaint import Complaint, ComplaintCategory, StatusUpdate, Feedback, RepairEvidence
from app.models.asset import Asset
from app.services.priority_engine import PriorityEngine
from app.services.duplicate_detector import DuplicateDetector
from app.services.notification_service import NotificationService

resident_bp = Blueprint('resident', __name__)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

@resident_bp.before_request
@login_required
@role_required('resident')
def ensure_resident():
    pass

@resident_bp.route('/dashboard')
def dashboard():
    resident = current_user.resident_profile
    if not resident:
        abort(400, "Resident profile not configured")

    complaints = Complaint.query.filter_by(resident_id=resident.id).order_by(Complaint.created_at.desc()).all()
    
    total = len(complaints)
    active = len([c for c in complaints if c.status in ['Submitted', 'Assigned', 'In Progress', 'Rework Required']])
    pending_verification = len([c for c in complaints if c.status == 'Pending Verification'])
    resolved = len([c for c in complaints if c.status == 'Closed'])

    return render_template(
        'resident/dashboard.html',
        resident=resident,
        complaints=complaints[:5],
        total=total,
        active=active,
        pending_verification=pending_verification,
        resolved=resolved
    )


@resident_bp.route('/complaints')
def my_complaints():
    resident = current_user.resident_profile
    status_filter = request.args.get('status')
    
    query = Complaint.query.filter_by(resident_id=resident.id)
    if status_filter:
        query = query.filter_by(status=status_filter)
        
    complaints = query.order_by(Complaint.created_at.desc()).all()
    return render_template('resident/my_complaints.html', complaints=complaints, status_filter=status_filter)


@resident_bp.route('/complaints/new', methods=['GET', 'POST'])
def submit_complaint():
    resident = current_user.resident_profile
    categories = ComplaintCategory.query.order_by(ComplaintCategory.name).all()
    assets = Asset.query.order_by(Asset.name).all()

    prefill_asset_code = request.args.get('asset_code')
    selected_asset = None
    if prefill_asset_code:
        selected_asset = Asset.query.filter_by(asset_code=prefill_asset_code).first()

    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        category_id = request.form.get('category_id', type=int)
        asset_id = request.form.get('asset_id', type=int) or None
        location_details = request.form.get('location_details', '').strip()
        severity = request.form.get('severity', type=int, default=3)
        work_impact = request.form.get('work_impact', type=int, default=2)

        if not all([title, description, category_id, location_details]):
            flash('Please fill out all mandatory fields.', 'danger')
            return render_template(
                'resident/submit_complaint.html',
                categories=categories,
                assets=assets,
                selected_asset=selected_asset
            )

        # Handle Photo Upload
        photo_filename = None
        if 'photo' in request.files:
            file = request.files['photo']
            if file and file.filename and allowed_file(file.filename):
                fname = secure_filename(f"comp_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{file.filename}")
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'complaints', fname)
                file.save(upload_path)
                photo_filename = f"uploads/complaints/{fname}"

        # Determine Asset Criticality (A)
        asset = Asset.query.get(asset_id) if asset_id else None
        category = ComplaintCategory.query.get(category_id)
        asset_criticality = asset.criticality if asset else (category.default_criticality if category else 3)

        # Calculate Recurrence Score (R)
        recurrence_score = PriorityEngine.calculate_recurrence_score(
            asset_id=asset_id,
            category_id=category_id,
            location=location_details
        )

        # Calculate Priority: P = 7S + 5A + 4W + 4R
        calc_result = PriorityEngine.compute_priority(
            severity=severity,
            asset_criticality=asset_criticality,
            work_impact=work_impact,
            recurrence_score=recurrence_score
        )

        # Generate unique Complaint Number
        year = datetime.utcnow().year
        last_complaint = Complaint.query.order_by(Complaint.id.desc()).first()
        next_id = (last_complaint.id + 1) if last_complaint else 1
        complaint_no = f"CC-{year}-{next_id:04d}"

        complaint = Complaint(
            complaint_no=complaint_no,
            resident_id=resident.id,
            asset_id=asset_id,
            category_id=category_id,
            title=title,
            description=description,
            location_details=location_details,
            photo_url=photo_filename,
            severity=calc_result['severity'],
            work_impact=calc_result['work_impact'],
            recurrence_score=calc_result['recurrence_score'],
            priority_score=calc_result['priority_score'],
            priority_level=calc_result['priority_level'],
            status='Submitted'
        )

        # Check for potential duplicates
        duplicates = DuplicateDetector.detect_duplicates(
            title=title,
            description=description,
            category_id=category_id,
            location_details=location_details,
            asset_id=asset_id
        )
        if duplicates:
            complaint.is_duplicate = True
            complaint.duplicate_of_id = duplicates[0]['complaint'].id

        db.session.add(complaint)
        db.session.flush()

        # Add initial timeline status update
        status_update = StatusUpdate(
            complaint_id=complaint.id,
            old_status=None,
            new_status='Submitted',
            changed_by_id=current_user.id,
            comment=f"Complaint registered by {current_user.full_name}. Priority automatically assigned as {calc_result['priority_level']} (Score: {calc_result['priority_score']})."
        )
        db.session.add(status_update)
        db.session.commit()

        # Notify Managers of new submission
        NotificationService.notify_role(
            role='manager',
            title=f"New Complaint: {complaint.complaint_no} ({calc_result['priority_level']})",
            message=f"{current_user.full_name} reported '{title}' in {location_details}.",
            link=url_for('manager.complaint_detail', complaint_id=complaint.id),
            category='danger' if calc_result['priority_level'] == 'Critical' else 'info'
        )

        flash(f'Complaint {complaint_no} submitted successfully with {calc_result["priority_level"]} priority.', 'success')
        return redirect(url_for('resident.complaint_detail', complaint_id=complaint.id))

    return render_template(
        'resident/submit_complaint.html',
        categories=categories,
        assets=assets,
        selected_asset=selected_asset
    )


@resident_bp.route('/complaints/<int:complaint_id>')
def complaint_detail(complaint_id):
    resident = current_user.resident_profile
    complaint = Complaint.query.filter_by(id=complaint_id, resident_id=resident.id).first_or_404()

    # Generate priority breakdown explanation
    asset_crit = complaint.asset.criticality if complaint.asset else complaint.category.default_criticality
    calc_result = {
        'severity': complaint.severity,
        'asset_criticality': asset_crit,
        'work_impact': complaint.work_impact,
        'recurrence_score': complaint.recurrence_score,
        'priority_score': complaint.priority_score,
        'priority_level': complaint.priority_level,
        'breakdown': {
            'severity_term': 7 * complaint.severity,
            'criticality_term': 5 * asset_crit,
            'work_impact_term': 4 * complaint.work_impact,
            'recurrence_term': 4 * complaint.recurrence_score
        }
    }
    explanation = PriorityEngine.get_explanation(calc_result, complaint.asset.name if complaint.asset else None)

    return render_template(
        'resident/complaint_detail.html',
        complaint=complaint,
        explanation=explanation
    )


@resident_bp.route('/complaints/<int:complaint_id>/verify', methods=['POST'])
def verify_repair(complaint_id):
    resident = current_user.resident_profile
    complaint = Complaint.query.filter_by(id=complaint_id, resident_id=resident.id).first_or_404()

    if complaint.status != 'Pending Verification':
        flash('This complaint is not pending verification.', 'warning')
        return redirect(url_for('resident.complaint_detail', complaint_id=complaint.id))

    decision = request.form.get('decision')  # 'approve' or 'reject'

    if decision == 'approve':
        rating = request.form.get('rating', type=int, default=5)
        comments = request.form.get('comments', '').strip()

        complaint.status = 'Closed'
        complaint.verified_at = datetime.utcnow()
        complaint.closed_at = datetime.utcnow()

        feedback = Feedback(
            complaint_id=complaint.id,
            resident_id=resident.id,
            rating=rating,
            comments=comments
        )
        db.session.add(feedback)

        # Update assignment completed timestamp
        curr_assignment = complaint.current_assignment
        if curr_assignment:
            curr_assignment.status = 'Completed'
            curr_assignment.completed_at = datetime.utcnow()

        # Update asset last maintenance date if linked
        if complaint.asset:
            complaint.asset.last_maintenance_date = datetime.utcnow()
            complaint.asset.schedule_next_maintenance()

        # Timeline update
        update = StatusUpdate(
            complaint_id=complaint.id,
            old_status='Pending Verification',
            new_status='Closed',
            changed_by_id=current_user.id,
            comment=f"Resident approved repair work with {rating}-star rating. Repair closed successfully."
        )
        db.session.add(update)
        db.session.commit()

        # Notify Worker and Manager
        if curr_assignment and curr_assignment.worker:
            NotificationService.notify(
                user_id=curr_assignment.worker.user_id,
                title="Repair Approved & Closed!",
                message=f"Resident {current_user.full_name} approved your repair for {complaint.complaint_no} with {rating} stars.",
                link=url_for('worker.task_detail', task_id=curr_assignment.id),
                category='success'
            )

        NotificationService.notify_role(
            role='manager',
            title=f"Complaint Closed: {complaint.complaint_no}",
            message=f"{complaint.complaint_no} verified and closed by resident ({rating} stars).",
            link=url_for('manager.complaint_detail', complaint_id=complaint.id),
            category='success'
        )

        flash('Thank you! Repair approved and complaint closed.', 'success')

    elif decision == 'reject':
        rejection_reason = request.form.get('rejection_reason', '').strip()
        if not rejection_reason:
            flash('Please state the reason for rejecting the repair.', 'danger')
            return redirect(url_for('resident.complaint_detail', complaint_id=complaint.id))

        complaint.status = 'Rework Required'

        curr_assignment = complaint.current_assignment
        if curr_assignment:
            curr_assignment.status = 'In Progress'

        update = StatusUpdate(
            complaint_id=complaint.id,
            old_status='Pending Verification',
            new_status='Rework Required',
            changed_by_id=current_user.id,
            comment=f"Resident rejected repair submission. Reason: {rejection_reason}"
        )
        db.session.add(update)
        db.session.commit()

        # Notify Worker immediately for rework
        if curr_assignment and curr_assignment.worker:
            NotificationService.notify(
                user_id=curr_assignment.worker.user_id,
                title=f"Correction Needed: {complaint.complaint_no}",
                message=f"Resident rejected repair. Reason: {rejection_reason}",
                link=url_for('worker.task_detail', task_id=curr_assignment.id),
                category='warning'
            )

        # Notify Manager of rework
        NotificationService.notify_role(
            role='manager',
            title=f"Repair Rejected: {complaint.complaint_no}",
            message=f"Resident rejected repair on {complaint.complaint_no}: {rejection_reason}",
            link=url_for('manager.complaint_detail', complaint_id=complaint.id),
            category='warning'
        )

        flash('Repair rejected and returned to maintenance worker for corrective action.', 'warning')

    return redirect(url_for('resident.complaint_detail', complaint_id=complaint.id))
