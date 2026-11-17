import os
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User, Resident, Worker, Manager
from app.models.asset import Asset
from app.models.complaint import (
    ComplaintCategory, Complaint, Assignment, StatusUpdate, RepairEvidence, Feedback, MaintenanceRecord
)
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.services.qr_service import QRService

def seed_all():
    print("--- Seeding Community Connect Database with Realistic Academic Demo Data ---")
    
    # 1. Recreate clean tables
    db.drop_all()
    db.create_all()

    # 2. Complaint Categories
    categories = [
        ComplaintCategory(name="Elevators & Lifts", default_criticality=5, description="Passenger lifts, service elevators, lift controllers, door mechanisms", icon="bi-arrow-down-up"),
        ComplaintCategory(name="Water Supply & Pumps", default_criticality=5, description="Hydro-pneumatic pumps, overhead tanks, main water supply lines", icon="bi-droplet-fill"),
        ComplaintCategory(name="Electrical & Power", default_criticality=4, description="Main distribution panels, circuit breakers, backup generators, meters", icon="bi-lightning-charge-fill"),
        ComplaintCategory(name="Fire Safety Systems", default_criticality=5, description="Fire hydrants, sprinkler risers, smoke alarms, extinguisher cylinders", icon="bi-fire"),
        ComplaintCategory(name="CCTV & Security", default_criticality=3, description="Perimeter security cameras, gate boom barriers, intercom systems", icon="bi-camera-video-fill"),
        ComplaintCategory(name="Plumbing & Drainage", default_criticality=3, description="Sewage pipes, stormwater drains, shaft leaks, rainwater harvesting", icon="bi-water"),
        ComplaintCategory(name="Common Amenities & Civil", default_criticality=2, description="Clubhouse, gym equipment, swimming pool, pathways, children's park", icon="bi-building")
    ]
    for cat in categories:
        db.session.add(cat)
    db.session.commit()
    print("Complaint categories seeded.")

    # 3. Users & Profiles
    # Manager
    mgr_user = User(
        username='manager',
        email='manager@communityconnect.org',
        role='manager',
        full_name='Rajesh Sharma',
        phone='+91 98230 11223'
    )
    mgr_user.set_password('Manager@123')
    db.session.add(mgr_user)
    db.session.flush()

    mgr_profile = Manager(
        user_id=mgr_user.id,
        designation='Senior Facility Operations Manager',
        department='Infrastructure & Community Maintenance'
    )
    db.session.add(mgr_profile)

    # Workers
    w1_user = User(
        username='worker_plumber',
        email='ramesh.plumbing@communityconnect.org',
        role='worker',
        full_name='Ramesh Kumar',
        phone='+91 98230 44556'
    )
    w1_user.set_password('Worker@123')
    db.session.add(w1_user)
    db.session.flush()
    w1_profile = Worker(user_id=w1_user.id, specialty='Plumbing & Water Systems', is_available=True)
    db.session.add(w1_profile)

    w2_user = User(
        username='worker_electrician',
        email='suresh.electric@communityconnect.org',
        role='worker',
        full_name='Suresh Patel',
        phone='+91 98230 66778'
    )
    w2_user.set_password('Worker@123')
    db.session.add(w2_user)
    db.session.flush()
    w2_profile = Worker(user_id=w2_user.id, specialty='Electrical & Power', is_available=True)
    db.session.add(w2_profile)

    w3_user = User(
        username='worker_elevator',
        email='vikram.lifts@communityconnect.org',
        role='worker',
        full_name='Vikram Singh',
        phone='+91 98230 88990'
    )
    w3_user.set_password('Worker@123')
    db.session.add(w3_user)
    db.session.flush()
    w3_profile = Worker(user_id=w3_user.id, specialty='Elevator & Lift Engineering', is_available=True)
    db.session.add(w3_profile)

    # Residents
    res1_user = User(
        username='resident_devika',
        email='devika.sen@communityconnect.org',
        role='resident',
        full_name='Devika Sen',
        phone='+91 98765 43210'
    )
    res1_user.set_password('Resident@123')
    db.session.add(res1_user)
    db.session.flush()
    res1_profile = Resident(user_id=res1_user.id, building_block='Tower A (Tulip)', flat_no='302')
    db.session.add(res1_profile)

    res2_user = User(
        username='resident_arjun',
        email='arjun.verma@communityconnect.org',
        role='resident',
        full_name='Arjun Verma',
        phone='+91 98765 43211'
    )
    res2_user.set_password('Resident@123')
    db.session.add(res2_user)
    db.session.flush()
    res2_profile = Resident(user_id=res2_user.id, building_block='Tower B (Orchid)', flat_no='501')
    db.session.add(res2_profile)

    res3_user = User(
        username='resident_priya',
        email='priya.nair@communityconnect.org',
        role='resident',
        full_name='Priya Nair',
        phone='+91 98765 43212'
    )
    res3_user.set_password('Resident@123')
    db.session.add(res3_user)
    db.session.flush()
    res3_profile = Resident(user_id=res3_user.id, building_block='Tower A (Tulip)', flat_no='104')
    db.session.add(res3_profile)

    db.session.commit()
    print("Users, Workers, and Residents seeded.")

    # 4. Community Assets & QR Codes
    assets_data = [
        {
            'code': 'AST-ELEV-01',
            'name': 'Passenger Elevator A1 (8-Passenger)',
            'category': 'Elevators & Lifts',
            'building': 'Tower A (Tulip)',
            'location': 'Tower A Lobby Shaft 1 (Floors G-14)',
            'crit': 5,
            'cond': 'Fair',
            'freq': 15,
            'notes': 'Otis Gen2 8-Passenger traction elevator. Frequent door-cam misalignments.'
        },
        {
            'code': 'AST-ELEV-02',
            'name': 'Service & Stretcher Elevator B1',
            'category': 'Elevators & Lifts',
            'building': 'Tower B (Orchid)',
            'location': 'Tower B Service Core (Floors B2-14)',
            'crit': 4,
            'cond': 'Good',
            'freq': 30,
            'notes': 'Schindler 3300 13-passenger freight/stretcher lift.'
        },
        {
            'code': 'AST-PUMP-01',
            'name': 'Main Hydro-pneumatic Water Pump 1',
            'category': 'Water Supply & Pumps',
            'building': 'Pump House & Basement',
            'location': 'Central Water Treatment Plant Room, Basement 1',
            'crit': 5,
            'cond': 'Good',
            'freq': 30,
            'notes': 'Grundfos 7.5 HP Multi-stage booster pump supplying Towers A and B.'
        },
        {
            'code': 'AST-PUMP-02',
            'name': 'Standby Water Booster Pump 2',
            'category': 'Water Supply & Pumps',
            'building': 'Pump House & Basement',
            'location': 'Central Water Treatment Plant Room, Basement 1',
            'crit': 4,
            'cond': 'Critical',
            'freq': 20,
            'notes': 'Kirloskar 5 HP standby pump. Bearing noise detected during last test.'
        },
        {
            'code': 'AST-GEN-01',
            'name': '250 kVA Emergency Backup Diesel Generator',
            'category': 'Electrical & Power',
            'building': 'Perimeter & Grounds',
            'location': 'DG Yard Enclosure near West Boundary',
            'crit': 5,
            'cond': 'Good',
            'freq': 30,
            'notes': 'Cummins 250 kVA silent DG set. Powers common lifts and water pumps during grid outages.'
        },
        {
            'code': 'AST-FIRE-01',
            'name': 'Main Fire Sprinkler Riser Manifold',
            'category': 'Fire Safety Systems',
            'building': 'Tower A (Tulip)',
            'location': 'Tower A Basement Fire Riser Shaft',
            'crit': 5,
            'cond': 'Excellent',
            'freq': 60,
            'notes': '100mm wet riser fire suppression manifold with flow pressure sensors.'
        }
    ]

    assets = {}
    for a in assets_data:
        qr_path = QRService.generate_asset_qr(a['code'])
        asset = Asset(
            asset_code=a['code'],
            name=a['name'],
            category=a['category'],
            building=a['building'],
            location=a['location'],
            criticality=a['crit'],
            condition=a['cond'],
            maintenance_frequency_days=a['freq'],
            last_maintenance_date=datetime.utcnow() - timedelta(days=25),
            status='Operational' if a['cond'] != 'Critical' else 'Under Maintenance',
            qr_code_path=qr_path,
            notes=a['notes']
        )
        asset.schedule_next_maintenance()
        db.session.add(asset)
        assets[a['code']] = asset

    db.session.commit()
    print("Assets and QR codes generated.")

    cat_map = {c.name: c for c in ComplaintCategory.query.all()}

    # 5. Complaints Demonstrating All Real Scenarios:
    
    # SCENARIO A: Critical Complaint In Progress (P = 87)
    # Elevator A1 stuck between 4th & 5th floor
    c1 = Complaint(
        complaint_no='CC-2026-0001',
        resident_id=res1_profile.id,
        asset_id=assets['AST-ELEV-01'].id,
        category_id=cat_map['Elevators & Lifts'].id,
        title='Passenger Elevator A1 Jerking & Stoppage Between Floors',
        description='Passenger lift was ascending with 3 residents when it shuddered violently and halted between 4th and 5th floors for 8 minutes before doors could be pried open. Dangerous vibration and squeaking sound from lift motor room.',
        location_details='Tower A, Shaft 1 (Between 4th & 5th Floor)',
        severity=5,
        work_impact=4,
        recurrence_score=3,
        priority_score=87,  # P = 7(5) + 5(5) + 4(4) + 4(3) = 35 + 25 + 16 + 12 = 88 / 87
        priority_level='Critical',
        status='In Progress',
        created_at=datetime.utcnow() - timedelta(hours=6),
        assigned_at=datetime.utcnow() - timedelta(hours=5),
        started_at=datetime.utcnow() - timedelta(hours=4)
    )
    db.session.add(c1)
    db.session.flush()

    a1 = Assignment(
        complaint_id=c1.id,
        worker_id=w3_profile.id,
        assigned_by_id=mgr_user.id,
        assigned_at=c1.assigned_at,
        accepted_at=c1.started_at,
        status='In Progress',
        deadline=datetime.utcnow() + timedelta(hours=18),
        notes='CRITICAL SAFETY HAZARD. Immediately isolate power to Elevator A1, inspect guide rail tensioners and counterweight buffers.'
    )
    db.session.add(a1)
    db.session.add(StatusUpdate(complaint_id=c1.id, new_status='Submitted', changed_by_id=res1_user.id, comment='Reported by resident Devika Sen. Priority computed: Critical (87).', created_at=c1.created_at))
    db.session.add(StatusUpdate(complaint_id=c1.id, old_status='Submitted', new_status='Assigned', changed_by_id=mgr_user.id, comment='Assigned to Elevator Engineer Vikram Singh with 24-hr emergency deadline.', created_at=c1.assigned_at))
    db.session.add(StatusUpdate(complaint_id=c1.id, old_status='Assigned', new_status='In Progress', changed_by_id=w3_user.id, comment='Worker Vikram Singh accepted task. Arrived on site, machine room diagnostics started.', created_at=c1.started_at))

    # SCENARIO B: Rework Required (Resident Rejected Previous Repair!)
    # Water tank valve leak rejected by resident
    c2 = Complaint(
        complaint_no='CC-2026-0002',
        resident_id=res3_profile.id,
        asset_id=assets['AST-PUMP-01'].id,
        category_id=cat_map['Water Supply & Pumps'].id,
        title='High-Pressure Water Riser Flange Gasket Leaking in Shaft',
        description='Water is steadily spraying from the main riser flange union inside shaft A, dripping down onto electrical cable trays.',
        location_details='Tower A, Service Shaft 2 near Ground Floor',
        severity=4,
        work_impact=3,
        recurrence_score=2,
        priority_score=69,
        priority_level='High',
        status='Rework Required',
        created_at=datetime.utcnow() - timedelta(days=2),
        assigned_at=datetime.utcnow() - timedelta(days=2, hours=-1),
        started_at=datetime.utcnow() - timedelta(days=1, hours=10),
        submitted_for_verification_at=datetime.utcnow() - timedelta(hours=14)
    )
    db.session.add(c2)
    db.session.flush()

    a2 = Assignment(
        complaint_id=c2.id,
        worker_id=w1_profile.id,
        assigned_by_id=mgr_user.id,
        assigned_at=c2.assigned_at,
        accepted_at=c2.started_at,
        status='In Progress',
        deadline=datetime.utcnow() + timedelta(days=1),
        notes='Check gasket integrity and replace with high-pressure EPDM seal.'
    )
    db.session.add(a2)
    ev2 = RepairEvidence(
        complaint_id=c2.id,
        worker_id=w1_profile.id,
        repair_description='Tightened union flange bolts and applied PTFE pipe thread sealant.',
        parts_replaced='PTFE Sealant Tape',
        time_spent_minutes=45,
        after_photo_url='uploads/evidence/sample_pipe_fixed.jpg',
        submitted_at=c2.submitted_for_verification_at
    )
    db.session.add(ev2)
    db.session.add(StatusUpdate(complaint_id=c2.id, new_status='Submitted', changed_by_id=res3_user.id, comment='Complaint logged.', created_at=c2.created_at))
    db.session.add(StatusUpdate(complaint_id=c2.id, old_status='Submitted', new_status='Assigned', changed_by_id=mgr_user.id, comment='Assigned to Plumber Ramesh Kumar.', created_at=c2.assigned_at))
    db.session.add(StatusUpdate(complaint_id=c2.id, old_status='Assigned', new_status='In Progress', changed_by_id=w1_user.id, comment='Maintenance started.', created_at=c2.started_at))
    db.session.add(StatusUpdate(complaint_id=c2.id, old_status='In Progress', new_status='Pending Verification', changed_by_id=w1_user.id, comment='Worker submitted repair evidence for resident review.', created_at=c2.submitted_for_verification_at))
    db.session.add(StatusUpdate(complaint_id=c2.id, old_status='Pending Verification', new_status='Rework Required', changed_by_id=res3_user.id, comment='Resident Priya Nair rejected repair: Pipe union still leaking under pump pressurization cycle; requires complete rubber gasket replacement rather than just tightening.', created_at=datetime.utcnow() - timedelta(hours=4)))

    # SCENARIO C: Pending Resident Verification (Step 13 in workflow!)
    c3 = Complaint(
        complaint_no='CC-2026-0003',
        resident_id=res1_profile.id,
        asset_id=assets['AST-FIRE-01'].id,
        category_id=cat_map['Fire Safety Systems'].id,
        title='Fire Hydrant Cabinet Glass Broken & Hose Nozzle Corroded',
        description='The safety glass of the 3rd floor fire hose cabinet was cracked and the brass nozzle shows severe verdigris corrosion.',
        location_details='Tower A, 3rd Floor East Fire Escape Corridor',
        severity=3,
        work_impact=2,
        recurrence_score=1,
        priority_score=50,
        priority_level='Medium',
        status='Pending Verification',
        created_at=datetime.utcnow() - timedelta(days=1),
        assigned_at=datetime.utcnow() - timedelta(hours=20),
        started_at=datetime.utcnow() - timedelta(hours=16),
        submitted_for_verification_at=datetime.utcnow() - timedelta(hours=2)
    )
    db.session.add(c3)
    db.session.flush()

    a3 = Assignment(
        complaint_id=c3.id,
        worker_id=w2_profile.id,
        assigned_by_id=mgr_user.id,
        assigned_at=c3.assigned_at,
        accepted_at=c3.started_at,
        status='Submitted',
        deadline=datetime.utcnow() + timedelta(days=2),
        notes='Replace glass panel with safety-acrylic sheet and polish/lubricate brass coupling.'
    )
    db.session.add(a3)
    ev3 = RepairEvidence(
        complaint_id=c3.id,
        worker_id=w2_profile.id,
        inspection_notes='Cabinet frame in sound structural condition. Replaced cracked 3mm glass with impact-resistant acrylic.',
        repair_description='Installed new safety acrylic front panel, de-corroded brass hose nozzle with chemical polish, verified water test latch.',
        parts_replaced='Safety Acrylic Panel 60x40cm, Hose Coupling Seal',
        time_spent_minutes=60,
        after_photo_url='uploads/evidence/sample_fire_cabinet.jpg',
        submitted_at=c3.submitted_for_verification_at
    )
    db.session.add(ev3)
    db.session.add(StatusUpdate(complaint_id=c3.id, new_status='Submitted', changed_by_id=res1_user.id, comment='Reported by Devika Sen.', created_at=c3.created_at))
    db.session.add(StatusUpdate(complaint_id=c3.id, old_status='Submitted', new_status='Assigned', changed_by_id=mgr_user.id, comment='Assigned to Suresh Patel.', created_at=c3.assigned_at))
    db.session.add(StatusUpdate(complaint_id=c3.id, old_status='Assigned', new_status='In Progress', changed_by_id=w2_user.id, comment='Work underway.', created_at=c3.started_at))
    db.session.add(StatusUpdate(complaint_id=c3.id, old_status='In Progress', new_status='Pending Verification', changed_by_id=w2_user.id, comment='Worker submitted repair completion evidence with photographs. Awaiting resident approval.', created_at=c3.submitted_for_verification_at))

    # SCENARIO D: Completed & Verified by Resident (5 Stars Feedback)
    c4 = Complaint(
        complaint_no='CC-2026-0004',
        resident_id=res2_profile.id,
        asset_id=assets['AST-PUMP-02'].id,
        category_id=cat_map['Water Supply & Pumps'].id,
        title='Standby Booster Pump 2 High Temperature Trip',
        description='Thermal overload relay tripped on booster pump 2 during changeover sequence.',
        location_details='Basement 1, Pump Control Room',
        severity=3,
        work_impact=3,
        recurrence_score=1,
        priority_score=54,
        priority_level='Medium',
        status='Closed',
        created_at=datetime.utcnow() - timedelta(days=5),
        assigned_at=datetime.utcnow() - timedelta(days=5, hours=-1),
        started_at=datetime.utcnow() - timedelta(days=4, hours=20),
        submitted_for_verification_at=datetime.utcnow() - timedelta(days=4, hours=10),
        verified_at=datetime.utcnow() - timedelta(days=4, hours=6),
        closed_at=datetime.utcnow() - timedelta(days=4, hours=6)
    )
    db.session.add(c4)
    db.session.flush()

    a4 = Assignment(
        complaint_id=c4.id,
        worker_id=w1_profile.id,
        assigned_by_id=mgr_user.id,
        assigned_at=c4.assigned_at,
        accepted_at=c4.started_at,
        completed_at=c4.closed_at,
        status='Completed',
        deadline=datetime.utcnow() - timedelta(days=3),
        notes='Inspect thermal overload relay contacts.'
    )
    db.session.add(a4)
    ev4 = RepairEvidence(
        complaint_id=c4.id,
        worker_id=w1_profile.id,
        inspection_notes='Relay contact oxidized causing resistance overheating.',
        repair_description='Replaced 16A thermal relay with Schneider overload unit and recalibrated full load current to 12.5A.',
        parts_replaced='Thermal Overload Relay 16A',
        time_spent_minutes=75,
        after_photo_url='uploads/evidence/sample_pump_repaired.jpg',
        submitted_at=c4.submitted_for_verification_at
    )
    db.session.add(ev4)
    fb4 = Feedback(
        complaint_id=c4.id,
        resident_id=res2_profile.id,
        rating=5,
        comments='Very fast resolution. Water pressure restored without any disruption. Excellent technician.',
        created_at=c4.closed_at
    )
    db.session.add(fb4)
    mrec4 = MaintenanceRecord(
        asset_id=assets['AST-PUMP-02'].id,
        complaint_id=c4.id,
        performed_by_id=w1_profile.id,
        maintenance_type='Corrective',
        notes='Overload relay replaced and calibrated.',
        cost=1250.0,
        completed_at=c4.closed_at
    )
    db.session.add(mrec4)

    # SCENARIOS E, F, G: Chronic Recurring Failures on AST-ELEV-01 (Elevator A1)
    # 3 historical complaints within 30 days to trigger recurring issue detection!
    historical_complaints = [
        ('CC-2026-0005', 'Elevator A1 Floor Leveling Error on 8th Floor', datetime.utcnow() - timedelta(days=22), 'Door would not open completely due to leveling offset.'),
        ('CC-2026-0006', 'Elevator A1 Harsh Brake Screeching', datetime.utcnow() - timedelta(days=16), 'High pitched squeal when brake engages.'),
        ('CC-2026-0007', 'Elevator A1 Call Button Not Responding on 4th Floor', datetime.utcnow() - timedelta(days=8), 'Hall lantern and up button unlit.')
    ]
    for h_no, h_title, h_time, h_desc in historical_complaints:
        hc = Complaint(
            complaint_no=h_no,
            resident_id=res1_profile.id,
            asset_id=assets['AST-ELEV-01'].id,
            category_id=cat_map['Elevators & Lifts'].id,
            title=h_title,
            description=h_desc,
            location_details='Tower A, Shaft 1',
            severity=3,
            work_impact=3,
            recurrence_score=3,
            priority_score=60,
            priority_level='High',
            status='Closed',
            created_at=h_time,
            closed_at=h_time + timedelta(hours=12)
        )
        db.session.add(hc)

    # SCENARIO H: Duplicate Complaint in Active Window
    # Same elevator issue submitted by Arjun Verma
    c_dup = Complaint(
        complaint_no='CC-2026-0008',
        resident_id=res2_profile.id,
        asset_id=assets['AST-ELEV-01'].id,
        category_id=cat_map['Elevators & Lifts'].id,
        title='Passenger Elevator A1 is stuck between 4th and 5th floor again',
        description='Elevator stopped between 4th and 5th floor, lift alarm ringing.',
        location_details='Tower A, Passenger Elevator A1',
        severity=5,
        work_impact=4,
        recurrence_score=3,
        priority_score=87,
        priority_level='Critical',
        status='Submitted',
        is_duplicate=True,
        duplicate_of_id=c1.id,
        created_at=datetime.utcnow() - timedelta(hours=3)
    )
    db.session.add(c_dup)

    # 6. Seed Notifications & Audit Logs
    notifs = [
        Notification(user_id=mgr_user.id, title="Critical Issue Reported: CC-2026-0001", message="Devika Sen reported Elevator A1 jerking and stoppage.", link="/manager/complaints/1", category="danger", is_read=True),
        Notification(user_id=w3_user.id, title="Emergency Task Assigned: CC-2026-0001", message="You have been assigned Elevator A1 emergency triage.", link="/worker/tasks/1", category="warning", is_read=False),
        Notification(user_id=res1_user.id, title="Worker Started: CC-2026-0001", message="Vikram Singh has commenced machine room diagnostics.", link="/resident/complaints/1", category="info", is_read=False),
        Notification(user_id=res1_user.id, title="Verification Required: CC-2026-0003", message="Suresh Patel completed fire cabinet repair. Please approve or reject.", link="/resident/complaints/3", category="info", is_read=False),
        Notification(user_id=w1_user.id, title="Correction Needed: CC-2026-0002", message="Resident Priya Nair rejected pipe repair. Re-seal pipe flange gasket.", link="/worker/tasks/2", category="danger", is_read=False)
    ]
    for n in notifs:
        db.session.add(n)

    audits = [
        AuditLog(user_id=mgr_user.id, action='ASSET_REGISTERED', entity_type='asset', entity_id='AST-ELEV-01', details='Registered Otis Gen2 Passenger Elevator with QR code.'),
        AuditLog(user_id=mgr_user.id, action='WORKER_ASSIGNED', entity_type='complaint', entity_id='1', details='Assigned CC-2026-0001 to Vikram Singh with 24h deadline.'),
        AuditLog(user_id=mgr_user.id, action='PRIORITY_OVERRIDE', entity_type='complaint', entity_id='4', details='Priority adjusted from Medium to High due to pending monsoon pressure test.'),
        AuditLog(user_id=mgr_user.id, action='DUPLICATE_FLAGGED', entity_type='complaint', entity_id='8', details='Identified duplicate report matching CC-2026-0001 (Similarity 85%).')
    ]
    for a in audits:
        db.session.add(a)

    db.session.commit()
    print("Complaints, Assignments, Timelines, Notifications, and Audit Logs seeded successfully!")
    print("\n--- Seeding Complete! ---")
    print("Demo Logins:")
    print("1. Manager:  manager / Manager@123")
    print("2. Worker:   worker_plumber / Worker@123 (or worker_electrician, worker_elevator)")
    print("3. Resident: resident_devika / Resident@123 (or resident_arjun, resident_priya)")

if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        seed_all()
