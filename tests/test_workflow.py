import io
from app.models.complaint import Complaint, Assignment, StatusUpdate, Feedback
from app.models.asset import Asset
from app import db

def test_complete_16_step_maintenance_lifecycle(client, auth, app):
    # ==========================================
    # STEP 1: Resident submits complaint
    # ==========================================
    auth.login('test_resident', 'pass123')
    
    with app.app_context():
        asset = Asset.query.filter_by(asset_code='AST-ELEV-01').first()
        asset_id = asset.id

    res_submit = client.post('/resident/complaints/new', data={
        'title': 'Elevator shaking violently during descent',
        'description': 'Elevator vibrated heavily between 5th and 2nd floor, making grinding noises.',
        'category_id': 1,
        'asset_id': asset_id,
        'location_details': 'Tower A Shaft 1',
        'severity': 5,
        'work_impact': 4
    }, follow_redirects=True)
    assert res_submit.status_code == 200

    with app.app_context():
        comp = Complaint.query.filter_by(title='Elevator shaking violently during descent').first()
        assert comp is not None
        assert comp.complaint_no.startswith('CC-')
        assert comp.status == 'Submitted'
        assert comp.priority_level == 'Critical'
        assert comp.priority_score >= 75
        complaint_id = comp.id
    
    auth.logout()

    # ==========================================
    # STEP 2: Manager assigns worker
    # ==========================================
    auth.login('test_mgr', 'pass123')
    
    with app.app_context():
        from app.models.user import Worker
        wkr = Worker.query.first()
        worker_id = wkr.id

    res_assign = client.post(f'/manager/complaints/{complaint_id}/assign', data={
        'worker_id': worker_id,
        'deadline_days': 2,
        'instructions': 'Immediate inspection of guide shoe liners'
    }, follow_redirects=True)
    assert res_assign.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'Assigned'
        assert comp.active_worker.id == worker_id
        assignment_id = comp.current_assignment.id

    auth.logout()

    # ==========================================
    # STEP 3: Worker accepts task
    # ==========================================
    auth.login('test_worker', 'pass123')
    
    res_accept = client.post(f'/worker/tasks/{assignment_id}/accept', follow_redirects=True)
    assert res_accept.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'In Progress'
        assert comp.started_at is not None

    # ==========================================
    # STEP 4: Worker submits repair evidence
    # ==========================================
    fake_img = (io.BytesIO(b"fake image data"), "after.png")
    res_evidence = client.post(f'/worker/tasks/{assignment_id}/submit-evidence', data={
        'repair_description': 'Adjusted guide rail tensioners and replaced worn guide shoes.',
        'inspection_notes': 'Shaft cleared and aligned.',
        'parts_replaced': 'Nylon Guide Shoe Pair',
        'time_spent_minutes': 90,
        'after_photo': fake_img
    }, content_type='multipart/form-data', follow_redirects=True)
    assert res_evidence.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'Pending Verification'
        assert comp.latest_evidence is not None

    auth.logout()

    # ==========================================
    # STEP 5: Resident rejects repair (Rework)
    # ==========================================
    auth.login('test_resident', 'pass123')

    res_reject = client.post(f'/resident/complaints/{complaint_id}/verify', data={
        'decision': 'reject',
        'rejection_reason': 'Still hearing slight grinding sound on 3rd floor.'
    }, follow_redirects=True)
    assert res_reject.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'Rework Required'

    auth.logout()

    # ==========================================
    # STEP 6: Worker does corrective repair and resubmits
    # ==========================================
    auth.login('test_worker', 'pass123')

    fake_img2 = (io.BytesIO(b"fake image data 2"), "after2.png")
    res_rework = client.post(f'/worker/tasks/{assignment_id}/submit-evidence', data={
        'repair_description': 'Lubricated 3rd floor guide bracket and re-tested counterweight.',
        'inspection_notes': 'Sound completely eliminated.',
        'parts_replaced': 'Heavy Lubricant',
        'time_spent_minutes': 30,
        'after_photo': fake_img2
    }, content_type='multipart/form-data', follow_redirects=True)
    assert res_rework.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'Pending Verification'

    auth.logout()

    # ==========================================
    # STEP 7: Resident approves repair & closes ticket
    # ==========================================
    auth.login('test_resident', 'pass123')

    res_approve = client.post(f'/resident/complaints/{complaint_id}/verify', data={
        'decision': 'approve',
        'rating': 5,
        'comments': 'Now running smoothly and quietly! Thanks.'
    }, follow_redirects=True)
    assert res_approve.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'Closed'
        assert comp.closed_at is not None
        assert comp.feedback.rating == 5
        assert comp.asset.last_maintenance_date is not None

    auth.logout()

def test_manager_exception_close(client, auth, app):
    auth.login('test_resident', 'pass123')
    client.post('/resident/complaints/new', data={
        'title': 'Exterior streetlight blinking near gate',
        'description': 'Light turns on and off continuously.',
        'category_id': 1,
        'location_details': 'West Perimeter',
        'severity': 2,
        'work_impact': 2
    }, follow_redirects=True)
    auth.logout()

    with app.app_context():
        comp = Complaint.query.filter_by(title='Exterior streetlight blinking near gate').first()
        complaint_id = comp.id

    auth.login('test_mgr', 'pass123')
    res_exc = client.post(f'/manager/complaints/{complaint_id}/exception-close', data={
        'exception_reason': 'Resident travelling overseas; common-area fixture verified functional by security team.'
    }, follow_redirects=True)
    assert res_exc.status_code == 200

    with app.app_context():
        comp = Complaint.query.get(complaint_id)
        assert comp.status == 'Closed'
        # Verify status update comment recorded
        last_update = StatusUpdate.query.filter_by(complaint_id=complaint_id).order_by(StatusUpdate.id.desc()).first()
        assert 'Manager Exception Closure executed' in last_update.comment
