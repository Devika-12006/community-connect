import os
from datetime import datetime, timedelta
from flask import Blueprint, render_template, redirect, url_for, flash, request, abort, current_app, send_file
from flask_login import login_required, current_user
from app import db, role_required
from app.models.user import User, Resident, Worker, Manager
from app.models.complaint import Complaint, Assignment, StatusUpdate, ComplaintCategory, Feedback, MaintenanceRecord
from app.models.asset import Asset
from app.models.audit import AuditLog
from app.services.priority_engine import PriorityEngine
from app.services.duplicate_detector import DuplicateDetector
from app.services.analytics_service import AnalyticsService
from app.services.qr_service import QRService
from app.services.notification_service import NotificationService

manager_bp = Blueprint('manager', __name__)

@manager_bp.before_request
@login_required
@role_required('manager')
def ensure_manager():
    pass

@manager_bp.route('/dashboard')
def dashboard():
    stats = AnalyticsService.get_manager_overview()
    recent_complaints = Complaint.query.order_by(Complaint.created_at.desc()).limit(8).all()
    recurring_alerts = DuplicateDetector.get_recurring_asset_alerts()
    workers = Worker.query.all()

    return render_template(
        'manager/dashboard.html',
        stats=stats,
        recent_complaints=recent_complaints,
        recurring_alerts=recurring_alerts,
        workers=workers
    )


@manager_bp.route('/complaints')
def complaints():
    status = request.args.get('status')
    priority = request.args.get('priority')
    category_id = request.args.get('category_id', type=int)
    asset_id = request.args.get('asset_id', type=int)

    query = Complaint.query
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority_level=priority)
    if category_id:
        query = query.filter_by(category_id=category_id)
    if asset_id:
        query = query.filter_by(asset_id=asset_id)

    # Sort: Priority score desc, then date desc
    all_complaints = query.order_by(Complaint.priority_score.desc(), Complaint.created_at.desc()).all()
    categories = ComplaintCategory.query.order_by(ComplaintCategory.name).all()
    assets = Asset.query.order_by(Asset.name).all()
    workers = Worker.query.filter_by(is_available=True).all()

    return render_template(
        'manager/complaints.html',
        complaints=all_complaints,
        categories=categories,
        assets=assets,
        workers=workers,
        selected_status=status,
        selected_priority=priority,
        selected_category=category_id,
        selected_asset=asset_id
    )


@manager_bp.route('/complaints/<int:complaint_id>')
def complaint_detail(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    workers = Worker.query.all()

    # Calculate priority breakdown explanation
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

    # Check for potential duplicates
    duplicates = DuplicateDetector.detect_duplicates(
        title=complaint.title,
        description=complaint.description,
        category_id=complaint.category_id,
        location_details=complaint.location_details,
        asset_id=complaint.asset_id,
        exclude_id=complaint.id
    )

    return render_template(
        'manager/complaint_detail.html',
        complaint=complaint,
        workers=workers,
        explanation=explanation,
        duplicates=duplicates
    )


@manager_bp.route('/complaints/<int:complaint_id>/assign', methods=['POST'])
def assign_worker(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    worker_id = request.form.get('worker_id', type=int)
    deadline_days = request.form.get('deadline_days', type=int, default=2)
    instructions = request.form.get('instructions', '').strip()

    worker = Worker.query.get_or_404(worker_id)
    deadline = datetime.utcnow() + timedelta(days=deadline_days)

    old_status = complaint.status
    complaint.status = 'Assigned'
    complaint.assigned_at = datetime.utcnow()

    # Create Assignment
    assignment = Assignment(
        complaint_id=complaint.id,
        worker_id=worker.id,
        assigned_by_id=current_user.id,
        assigned_at=datetime.utcnow(),
        status='Assigned',
        deadline=deadline,
        notes=instructions
    )
    db.session.add(assignment)

    update = StatusUpdate(
        complaint_id=complaint.id,
        old_status=old_status,
        new_status='Assigned',
        changed_by_id=current_user.id,
        comment=f"Assigned to worker {worker.user.full_name} ({worker.specialty}). Target deadline: {deadline.strftime('%Y-%m-%d %H:%M')}."
    )
    db.session.add(update)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action='WORKER_ASSIGNED',
        entity_type='complaint',
        entity_id=str(complaint.id),
        details=f"Assigned to {worker.user.full_name} with {deadline_days} days deadline. Notes: {instructions}",
        ip_address=request.remote_addr
    )
    db.session.add(audit)
    db.session.commit()

    # Notify Worker
    NotificationService.notify(
        user_id=worker.user_id,
        title=f"New Task Assigned: {complaint.complaint_no}",
        message=f"You have been assigned ticket {complaint.complaint_no} ({complaint.priority_level} priority) in {complaint.location_details}.",
        link=url_for('worker.task_detail', task_id=assignment.id),
        category='warning' if complaint.priority_level in ['Critical', 'High'] else 'info'
    )

    # Notify Resident
    NotificationService.notify(
        user_id=complaint.resident.user_id,
        title=f"Worker Assigned: {complaint.complaint_no}",
        message=f"Maintenance worker {worker.user.full_name} ({worker.specialty}) has been assigned to your ticket.",
        link=url_for('resident.complaint_detail', complaint_id=complaint.id),
        category='info'
    )

    flash(f'Task successfully assigned to {worker.user.full_name}.', 'success')
    return redirect(url_for('manager.complaint_detail', complaint_id=complaint.id))


@manager_bp.route('/complaints/<int:complaint_id>/override-priority', methods=['POST'])
def override_priority(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    new_priority = request.form.get('priority_level')
    override_reason = request.form.get('override_reason', '').strip()

    if not override_reason:
        flash('A detailed justification is required to override automated priority.', 'danger')
        return redirect(url_for('manager.complaint_detail', complaint_id=complaint.id))

    old_priority = complaint.priority_level
    complaint.priority_override = True
    complaint.override_priority_level = new_priority
    complaint.override_reason = override_reason
    complaint.override_by_id = current_user.id
    complaint.override_at = datetime.utcnow()
    complaint.priority_level = new_priority

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action='PRIORITY_OVERRIDE',
        entity_type='complaint',
        entity_id=str(complaint.id),
        details=f"Priority overridden from {old_priority} to {new_priority}. Justification: {override_reason}",
        ip_address=request.remote_addr
    )
    db.session.add(audit)

    update = StatusUpdate(
        complaint_id=complaint.id,
        old_status=complaint.status,
        new_status=complaint.status,
        changed_by_id=current_user.id,
        comment=f"Priority manually overridden from {old_priority} to {new_priority} by Manager {current_user.full_name}. Justification: {override_reason}"
    )
    db.session.add(update)
    db.session.commit()

    flash(f'Priority successfully overridden to {new_priority}.', 'success')
    return redirect(url_for('manager.complaint_detail', complaint_id=complaint.id))


@manager_bp.route('/complaints/<int:complaint_id>/merge-duplicate', methods=['POST'])
def merge_duplicate(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    primary_id = request.form.get('primary_complaint_id', type=int)

    if not primary_id or primary_id == complaint.id:
        flash('Invalid primary complaint specified for merge.', 'danger')
        return redirect(url_for('manager.complaint_detail', complaint_id=complaint.id))

    primary = Complaint.query.get_or_404(primary_id)
    complaint.is_duplicate = True
    complaint.duplicate_of_id = primary.id
    complaint.status = 'Closed'
    complaint.closed_at = datetime.utcnow()

    update = StatusUpdate(
        complaint_id=complaint.id,
        old_status=complaint.status,
        new_status='Closed',
        changed_by_id=current_user.id,
        comment=f"Linked and closed as duplicate of ticket #{primary.complaint_no}."
    )
    db.session.add(update)

    audit = AuditLog(
        user_id=current_user.id,
        action='DUPLICATE_MERGE',
        entity_type='complaint',
        entity_id=str(complaint.id),
        details=f"Merged into primary ticket {primary.complaint_no}",
        ip_address=request.remote_addr
    )
    db.session.add(audit)
    db.session.commit()

    flash(f"Complaint {complaint.complaint_no} linked as duplicate of {primary.complaint_no}.", 'info')
    return redirect(url_for('manager.complaint_detail', complaint_id=primary.id))


@manager_bp.route('/complaints/<int:complaint_id>/exception-close', methods=['POST'])
def exception_close(complaint_id):
    """
    Manager exception closure for cases where resident is unreachable / unavailable.
    """
    complaint = Complaint.query.get_or_404(complaint_id)
    reason = request.form.get('exception_reason', '').strip()

    if not reason:
        flash('Exception justification required.', 'danger')
        return redirect(url_for('manager.complaint_detail', complaint_id=complaint.id))

    old_status = complaint.status
    complaint.status = 'Closed'
    complaint.closed_at = datetime.utcnow()

    curr_assignment = complaint.current_assignment
    if curr_assignment:
        curr_assignment.status = 'Completed'
        curr_assignment.completed_at = datetime.utcnow()

    update = StatusUpdate(
        complaint_id=complaint.id,
        old_status=old_status,
        new_status='Closed',
        changed_by_id=current_user.id,
        comment=f"Manager Exception Closure executed by {current_user.full_name}. Reason: {reason}"
    )
    db.session.add(update)

    audit = AuditLog(
        user_id=current_user.id,
        action='MANAGER_EXCEPTION_CLOSE',
        entity_type='complaint',
        entity_id=str(complaint.id),
        details=f"Closed via Manager Exception. Justification: {reason}",
        ip_address=request.remote_addr
    )
    db.session.add(audit)
    db.session.commit()

    flash('Complaint closed under documented Manager Exception.', 'success')
    return redirect(url_for('manager.complaint_detail', complaint_id=complaint.id))


@manager_bp.route('/assets')
def assets():
    all_assets = Asset.query.order_by(Asset.building, Asset.name).all()
    return render_template('manager/assets.html', assets=all_assets)


@manager_bp.route('/assets/new', methods=['GET', 'POST'])
def add_asset():
    if request.method == 'POST':
        asset_code = request.form.get('asset_code', '').strip().upper()
        name = request.form.get('name', '').strip()
        category = request.form.get('category', '').strip()
        building = request.form.get('building', '').strip()
        location = request.form.get('location', '').strip()
        criticality = request.form.get('criticality', type=int, default=3)
        condition = request.form.get('condition', 'Good')
        frequency_days = request.form.get('maintenance_frequency_days', type=int, default=30)
        notes = request.form.get('notes', '').strip()

        if not all([asset_code, name, category, building, location]):
            flash('Please fill in all mandatory asset fields.', 'danger')
            return render_template('manager/asset_form.html')

        if Asset.query.filter_by(asset_code=asset_code).first():
            flash('An asset with this Asset Code already exists.', 'danger')
            return render_template('manager/asset_form.html')

        # Generate QR Code
        qr_path = QRService.generate_asset_qr(asset_code)

        asset = Asset(
            asset_code=asset_code,
            name=name,
            category=category,
            building=building,
            location=location,
            criticality=criticality,
            condition=condition,
            maintenance_frequency_days=frequency_days,
            last_maintenance_date=datetime.utcnow(),
            status='Operational',
            qr_code_path=qr_path,
            notes=notes
        )
        asset.schedule_next_maintenance()

        db.session.add(asset)
        db.session.flush()

        audit = AuditLog(
            user_id=current_user.id,
            action='ASSET_REGISTERED',
            entity_type='asset',
            entity_id=str(asset.id),
            details=f"Registered asset {asset_code} ({name}) with QR code.",
            ip_address=request.remote_addr
        )
        db.session.add(audit)
        db.session.commit()

        flash(f'Asset {asset_code} registered and QR code generated successfully!', 'success')
        return redirect(url_for('manager.asset_detail', asset_id=asset.id))

    return render_template('manager/asset_form.html')


@manager_bp.route('/assets/<int:asset_id>')
def asset_detail(asset_id):
    asset = Asset.query.get_or_404(asset_id)
    complaints = asset.complaints.order_by(Complaint.created_at.desc()).all()
    maintenance_records = asset.maintenance_records.order_by(MaintenanceRecord.completed_at.desc()).all()
    return render_template(
        'manager/asset_detail.html',
        asset=asset,
        complaints=complaints,
        maintenance_records=maintenance_records
    )


@manager_bp.route('/assets/<int:asset_id>/regenerate-qr')
def regenerate_qr(asset_id):
    asset = Asset.query.get_or_404(asset_id)
    qr_path = QRService.generate_asset_qr(asset.asset_code)
    asset.qr_code_path = qr_path
    db.session.commit()
    flash(f"QR code regenerated for {asset.asset_code}.", "success")
    return redirect(url_for('manager.asset_detail', asset_id=asset.id))


@manager_bp.route('/workers')
def workers():
    workers_list = Worker.query.all()
    metrics = AnalyticsService.get_worker_performance_metrics()
    return render_template('manager/workers.html', workers=workers_list, metrics=metrics)


@manager_bp.route('/workers/add', methods=['GET', 'POST'])
def add_worker():
    if request.method == 'POST':
        full_name = request.form.get('full_name', '').strip()
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        specialty = request.form.get('specialty', '').strip()
        phone = request.form.get('phone', '').strip()

        if not all([full_name, username, email, password, specialty]):
            flash('Please fill in all mandatory fields.', 'danger')
            return render_template('manager/worker_form.html')

        if User.query.filter_by(username=username).first():
            flash('Username is already taken.', 'danger')
            return render_template('manager/worker_form.html')

        user = User(
            username=username,
            email=email,
            role='worker',
            full_name=full_name,
            phone=phone,
            is_active=True
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        worker = Worker(
            user_id=user.id,
            specialty=specialty,
            emergency_contact=phone
        )
        db.session.add(worker)
        db.session.commit()

        flash(f'Maintenance Worker {full_name} ({specialty}) added successfully!', 'success')
        return redirect(url_for('manager.workers'))

    return render_template('manager/worker_form.html')


@manager_bp.route('/analytics')
def analytics():
    overview = AnalyticsService.get_manager_overview()
    worker_metrics = AnalyticsService.get_worker_performance_metrics()
    failing_assets = AnalyticsService.get_frequently_failing_assets()
    categories = ComplaintCategory.query.all()
    assets = Asset.query.all()

    return render_template(
        'manager/analytics.html',
        overview=overview,
        worker_metrics=worker_metrics,
        failing_assets=failing_assets,
        categories=categories,
        assets=assets
    )


@manager_bp.route('/recurring-issues')
def recurring_issues():
    recurring_alerts = DuplicateDetector.get_recurring_asset_alerts()
    return render_template('manager/recurring_issues.html', alerts=recurring_alerts)


@manager_bp.route('/audit-logs')
def audit_logs():
    logs = AuditLog.query.order_by(AuditLog.timestamp.desc()).limit(100).all()
    return render_template('manager/audit_logs.html', logs=logs)
