import os
from datetime import datetime, timedelta
from app import create_app, db
from app.models.user import User, Resident, Worker, Manager
from app.models.asset import Asset
from app.models.complaint import (
    ComplaintCategory, Complaint, Assignment, StatusUpdate,
    RepairEvidence, Feedback, MaintenanceRecord
)
from app.models.notification import Notification
from app.models.audit import AuditLog
from app.services.qr_service import QRService

def seed_database():
    app = create_app()
    with app.app_context():
        print("Initializing Community Connect Database Schema...")
        db.drop_all()
        db.create_all()

        print("1. Seeding Complaint Categories...")
        categories = [
            ComplaintCategory(name='Elevators & Lifts', default_criticality=5, description='Elevator machinery, door sensors, cables and car lighting', icon='bi-arrow-down-up'),
            ComplaintCategory(name='Water Supply & Pumps', default_criticality=5, description='Hydro-pneumatic booster pumps, pipelines, overhead tanks and valves', icon='bi-droplet-fill'),
            ComplaintCategory(name='Common-Area Electrical', default_criticality=4, description='Substations, diesel generators, corridor lighting, meters and main lines', icon='bi-lightning-charge-fill'),
            ComplaintCategory(name='Fire Safety & Suppression', default_criticality=5, description='Hydrant lines, smoke detectors, extinguishers and alarm panels', icon='bi-shield-fire'),
            ComplaintCategory(name='Drainage & Sanitation', default_criticality=3, description='Sewage lines, stormwater drains, chamber covers and sump pits', icon='bi-water'),
            ComplaintCategory(name='Streetlights & Security', default_criticality=2, description='Campus streetlights, CCTV cameras, boom barriers and intercoms', icon='bi-camera-video-fill'),
            ComplaintCategory(name='Civil & Structural', default_criticality=2, description='Road potholes, pavement slabs, plastering, gates and railings', icon='bi-hammer')
        ]
        db.session.add_all(categories)
        db.session.commit()
        cat_map = {c.name: c for c in ComplaintCategory.query.all()}

        print("2. Seeding Users (Manager, Workers, Residents)...")
        # Manager
        mgr_user = User(
            username='manager_admin',
            email='admin@communityconnect.local',
            role='manager',
            full_name='Mr. Rajesh Varma',
            phone='+91 98200 12345',
            is_active=True
        )
        mgr_user.set_password('admin123')
        db.session.add(mgr_user)
        db.session.flush()

        manager = Manager(
            user_id=mgr_user.id,
            designation='Chief Facility Director',
            department='Integrated Facility Management'
        )
        db.session.add(manager)

        # Workers
        workers_data = [
            ('worker_vikram', 'vikram@communityconnect.local', 'Vikram Shinde', 'Elevator/Lift', '+91 98111 22334'),
            ('worker_suresh', 'suresh@communityconnect.local', 'Suresh Patil', 'Plumbing', '+91 98222 33445'),
            ('worker_ramesh', 'ramesh@communityconnect.local', 'Ramesh Kumar', 'Electrical', '+91 98333 44556'),
            ('worker_anand', 'anand@communityconnect.local', 'Anand Kulkarni', 'Civil & Masonry', '+91 98444 55667')
        ]
        worker_objs = {}
        for uname, uemail, ufullname, uspec, uphone in workers_data:
            w_user = User(
                username=uname,
                email=uemail,
                role='worker',
                full_name=ufullname,
                phone=uphone,
                is_active=True
            )
            w_user.set_password('worker123')
            db.session.add(w_user)
            db.session.flush()

            w = Worker(
                user_id=w_user.id,
                specialty=uspec,
                emergency_contact=uphone,
                is_available=True
            )
            db.session.add(w)
            db.session.flush()
            worker_objs[uname] = w

        # Residents
        residents_data = [
            ('resident_devika', 'devika@example.com', 'Devika Sharma', 'Block A', '302', '+91 99111 00001'),
            ('resident_arjun', 'arjun@example.com', 'Arjun Mehta', 'Block B', '504', '+91 99222 00002'),
            ('resident_priya', 'priya@example.com', 'Priya Deshmukh', 'Block C', '101', '+91 99333 00003')
        ]
        resident_objs = {}
        for uname, uemail, ufullname, ublock, uflat, uphone in residents_data:
            r_user = User(
                username=uname,
                email=uemail,
                role='resident',
                full_name=ufullname,
                phone=uphone,
                is_active=True
            )
            r_user.set_password('resident123')
            db.session.add(r_user)
            db.session.flush()

            r = Resident(
                user_id=r_user.id,
                building_block=ublock,
                flat_no=uflat,
                alternate_contact=uphone
            )
            db.session.add(r)
            db.session.flush()
            resident_objs[uname] = r

        db.session.commit()

        print("3. Seeding Community Infrastructure Assets & Generating Real QR Codes...")
        assets_data = [
            ('AST-ELEV-01', 'Passenger Elevator 1', 'Elevators', 'Block A', 'Wing A Shaft (Floors 0-14)', 5, 'Fair', 30),
            ('AST-ELEV-02', 'Passenger Elevator 2', 'Elevators', 'Block B', 'Wing B Shaft (Floors 0-14)', 5, 'Good', 30),
            ('AST-PUMP-01', 'Hydro-Pneumatic Water Pump 1', 'Water pumps', 'Common Area', 'Basement Utility Room 1', 5, 'Good', 60),
            ('AST-GEN-01', '250kVA Emergency Diesel Generator', 'Generators', 'Common Area', 'Substation Enclosure Ground Level', 4, 'Excellent', 90),
            ('AST-LGT-01', 'Perimeter LED Streetlight Array 1', 'Streetlights', 'Perimeter / Grounds', 'North Jogging Track P1 to P10', 2, 'Good', 180),
            ('AST-CCTV-04', 'Main Gate Surveillance CCTV 4', 'CCTV cameras', 'Perimeter / Grounds', 'Main Security Barrier Post', 3, 'Good', 90),
            ('AST-FIRE-01', 'Central Fire Hydrant & Sprinkler Pump', 'Fire safety equipment', 'Common Area', 'Pump House B2 Under Tank', 5, 'Excellent', 30),
            ('AST-DRN-02', 'Stormwater Sump & Drainage Pump', 'Drainage systems', 'Block B', 'South Basement Ramp Discharge', 3, 'Poor', 30)
        ]

        asset_objs = {}
        for acode, aname, acat, abldg, aloc, acrit, acondition, afreq in assets_data:
            qr_rel_path = QRService.generate_asset_qr(acode)
            last_date = datetime.utcnow() - timedelta(days=25)
            next_date = last_date + timedelta(days=afreq)

            asset = Asset(
                asset_code=acode,
                name=aname,
                category=acat,
                building=abldg,
                location=aloc,
                criticality=acrit,
                condition=acondition,
                maintenance_frequency_days=afreq,
                last_maintenance_date=last_date,
                next_maintenance_date=next_date,
                status='Operational',
                qr_code_path=qr_rel_path,
                notes=f"Installed under OEM warranty. Maintenance frequency {afreq} days."
            )
            db.session.add(asset)
            db.session.flush()
            asset_objs[acode] = asset

        db.session.commit()

        print("4. Seeding Maintenance Complaints across All Workflow States...")
        now = datetime.utcnow()

        # Ticket 1: CRITICAL IN PROGRESS (Elevator 1)
        # S=5, A=5, W=4, R=3 -> P = 7(5)+5(5)+4(4)+4(3) = 35+25+16+12 = 88 (Critical)
        c1 = Complaint(
            complaint_no='CC-2026-0001',
            resident_id=resident_objs['resident_devika'].id,
            asset_id=asset_objs['AST-ELEV-01'].id,
            category_id=cat_map['Elevators & Lifts'].id,
            title='Elevator sudden jerking stop between 4th and 5th floor',
            description='The elevator jerked violently and came to an abrupt stop with passengers inside. Door reopening mechanism showed delayed response.',
            location_details='Block A, Elevator Shaft 1',
            severity=5,
            work_impact=4,
            recurrence_score=3,
            priority_score=88,
            priority_level='Critical',
            status='In Progress',
            created_at=now - timedelta(hours=6),
            assigned_at=now - timedelta(hours=5),
            started_at=now - timedelta(hours=4)
        )
        db.session.add(c1)
        db.session.flush()

        a1 = Assignment(
            complaint_id=c1.id,
            worker_id=worker_objs['worker_vikram'].id,
            assigned_by_id=mgr_user.id,
            assigned_at=now - timedelta(hours=5),
            accepted_at=now - timedelta(hours=4),
            status='In Progress',
            deadline=now + timedelta(hours=18),
            notes='Inspect traction brake cables and elevator drive controller immediately.'
        )
        db.session.add(a1)

        db.session.add(StatusUpdate(
            complaint_id=c1.id, old_status=None, new_status='Submitted',
            changed_by_id=resident_objs['resident_devika'].user_id,
            comment='Complaint registered by Devika Sharma. Automated priority: Critical (Score: 88).',
            created_at=now - timedelta(hours=6)
        ))
        db.session.add(StatusUpdate(
            complaint_id=c1.id, old_status='Submitted', new_status='Assigned',
            changed_by_id=mgr_user.id,
            comment='Assigned to Vikram Shinde (Elevator/Lift Specialist).',
            created_at=now - timedelta(hours=5)
        ))
        db.session.add(StatusUpdate(
            complaint_id=c1.id, old_status='Assigned', new_status='In Progress',
            changed_by_id=worker_objs['worker_vikram'].user_id,
            comment='Technician Vikram Shinde accepted task and opened machine room cabinet.',
            created_at=now - timedelta(hours=4)
        ))

        # Ticket 2: PENDING VERIFICATION (Water Pump burst - ready for resident sign-off!)
        # S=4, A=5, W=4, R=2 -> P = 7(4)+5(5)+4(4)+4(2) = 28+25+16+8 = 77 (Critical)
        c2 = Complaint(
            complaint_no='CC-2026-0002',
            resident_id=resident_objs['resident_devika'].id,
            asset_id=asset_objs['AST-PUMP-01'].id,
            category_id=cat_map['Water Supply & Pumps'].id,
            title='Severe water pressure drop and pump room leakage',
            description='Water pressure dropped across Block A upper floors. Pump room 1 floor flooded with approx 2 inches of water.',
            location_details='Basement Utility Room 1, Pump 1',
            severity=4,
            work_impact=4,
            recurrence_score=2,
            priority_score=77,
            priority_level='Critical',
            status='Pending Verification',
            created_at=now - timedelta(hours=12),
            assigned_at=now - timedelta(hours=11),
            started_at=now - timedelta(hours=10),
            submitted_for_verification_at=now - timedelta(hours=1)
        )
        db.session.add(c2)
        db.session.flush()

        a2 = Assignment(
            complaint_id=c2.id,
            worker_id=worker_objs['worker_suresh'].id,
            assigned_by_id=mgr_user.id,
            assigned_at=now - timedelta(hours=11),
            accepted_at=now - timedelta(hours=10),
            status='Submitted',
            deadline=now + timedelta(hours=12),
            notes='Replace burst gasket and calibrate pressure gauge.'
        )
        db.session.add(a2)

        # Worker submitted evidence!
        ev2 = RepairEvidence(
            complaint_id=c2.id,
            worker_id=worker_objs['worker_suresh'].id,
            before_photo_url='uploads/complaints/sample_pump_before.png',
            after_photo_url='uploads/complaints/sample_pump_after.png',
            inspection_notes='Gasket flange cracked at outlet joint due to vibration.',
            repair_description='Replaced 4-inch rubber flange gasket, tightened mounting bolts to torque spec, ran pressure test at 6.5 bar with zero leaks.',
            parts_replaced='4-inch EPDM Flange Gasket, 4x M16 Bolts',
            time_spent_minutes=90,
            submitted_at=now - timedelta(hours=1)
        )
        db.session.add(ev2)

        db.session.add(StatusUpdate(
            complaint_id=c2.id, old_status='In Progress', new_status='Pending Verification',
            changed_by_id=worker_objs['worker_suresh'].user_id,
            comment='Repair completed. Suresh Patil submitted completion photographs for resident sign-off.',
            created_at=now - timedelta(hours=1)
        ))

        # Ticket 3: REWORK REQUIRED (Resident rejected incomplete repair!)
        c3 = Complaint(
            complaint_no='CC-2026-0003',
            resident_id=resident_objs['resident_arjun'].id,
            asset_id=asset_objs['AST-DRN-02'].id,
            category_id=cat_map['Drainage & Sanitation'].id,
            title='Basement stormwater drain overflowing during morning rain',
            description='Basement ramp water chamber backed up and water overflowed into visitor parking slots.',
            location_details='Block B, Basement Ramp Drainage Chamber',
            severity=3,
            work_impact=3,
            recurrence_score=3,
            priority_score=60,
            priority_level='High',
            status='Rework Required',
            created_at=now - timedelta(days=2),
            assigned_at=now - timedelta(days=2, hours=-1),
            started_at=now - timedelta(days=1, hours=18)
        )
        db.session.add(c3)
        db.session.flush()

        a3 = Assignment(
            complaint_id=c3.id,
            worker_id=worker_objs['worker_anand'].id,
            assigned_by_id=mgr_user.id,
            assigned_at=now - timedelta(days=2, hours=-1),
            accepted_at=now - timedelta(days=1, hours=18),
            status='In Progress',
            deadline=now + timedelta(days=1)
        )
        db.session.add(a3)

        db.session.add(StatusUpdate(
            complaint_id=c3.id, old_status='Pending Verification', new_status='Rework Required',
            changed_by_id=resident_objs['resident_arjun'].user_id,
            comment='Resident rejected repair submission. Reason: Debris and silt still clogging the lower discharge trap; water level is still not receding.',
            created_at=now - timedelta(hours=3)
        ))

        # Ticket 4: CLOSED WITH 5-STAR RATING (Completed Maintenance Lifecycle!)
        c4 = Complaint(
            complaint_no='CC-2026-0004',
            resident_id=resident_objs['resident_devika'].id,
            asset_id=asset_objs['AST-FIRE-01'].id,
            category_id=cat_map['Fire Safety & Suppression'].id,
            title='Fire alarm false trigger chirp on 3rd floor hydrant panel',
            description='Periodic beeping sound coming from the fire control panel warning indicator.',
            location_details='Block A, Floor 3 Hydrant Station',
            severity=3,
            work_impact=2,
            recurrence_score=1,
            priority_score=48,
            priority_level='Medium',
            status='Closed',
            created_at=now - timedelta(days=5),
            assigned_at=now - timedelta(days=5, hours=-2),
            started_at=now - timedelta(days=4, hours=20),
            submitted_for_verification_at=now - timedelta(days=4, hours=12),
            verified_at=now - timedelta(days=4, hours=8),
            closed_at=now - timedelta(days=4, hours=8)
        )
        db.session.add(c4)
        db.session.flush()

        a4 = Assignment(
            complaint_id=c4.id,
            worker_id=worker_objs['worker_ramesh'].id,
            assigned_by_id=mgr_user.id,
            assigned_at=now - timedelta(days=5, hours=-2),
            accepted_at=now - timedelta(days=4, hours=20),
            completed_at=now - timedelta(days=4, hours=8),
            status='Completed'
        )
        db.session.add(a4)

        fb4 = Feedback(
            complaint_id=c4.id,
            resident_id=resident_objs['resident_devika'].id,
            rating=5,
            comments='Ramesh arrived promptly, replaced the backup sensor battery, and verified alarm integrity. Excellent service!'
        )
        db.session.add(fb4)

        mrec4 = MaintenanceRecord(
            asset_id=asset_objs['AST-FIRE-01'].id,
            complaint_id=c4.id,
            performed_by_id=worker_objs['worker_ramesh'].id,
            maintenance_type='Corrective',
            notes='Battery replacement and circuit calibration on 3rd floor panel.',
            cost=450.0,
            completed_at=now - timedelta(days=4, hours=8)
        )
        db.session.add(mrec4)

        # Additional historical complaints on Elevator 1 (to demonstrate Recurring Issue Alert Section 6!)
        for i in range(1, 4):
            c_hist = Complaint(
                complaint_no=f'CC-2026-000{4+i}',
                resident_id=resident_objs['resident_priya'].id,
                asset_id=asset_objs['AST-ELEV-01'].id,
                category_id=cat_map['Elevators & Lifts'].id,
                title=f'Elevator 1 door sensor misaligned error code #{i}',
                description=f'Door closed halfway and reopened multiple times on floor {i*3}.',
                location_details='Block A Elevator 1',
                severity=3,
                work_impact=3,
                recurrence_score=3,
                priority_score=62,
                priority_level='High',
                status='Closed',
                created_at=now - timedelta(days=10 + i * 4),
                closed_at=now - timedelta(days=9 + i * 4)
            )
            db.session.add(c_hist)

        # Audit Logs
        db.session.add(AuditLog(
            user_id=mgr_user.id,
            action='PRIORITY_OVERRIDE',
            entity_type='complaint',
            entity_id=str(c1.id),
            details='Priority verified as Critical due to human entrapment hazard.',
            ip_address='127.0.0.1',
            timestamp=now - timedelta(hours=5)
        ))
        db.session.add(AuditLog(
            user_id=mgr_user.id,
            action='WORKER_ASSIGNED',
            entity_type='complaint',
            entity_id=str(c1.id),
            details='Assigned to Vikram Shinde (Elevator Specialist) with 18-hour SLA.',
            ip_address='127.0.0.1',
            timestamp=now - timedelta(hours=5)
        ))

        # Sample Notifications for each role
        db.session.add(Notification(
            user_id=resident_objs['resident_devika'].user_id,
            title='Verification Required: #CC-2026-0002',
            message='Technician Suresh Patil submitted repair proof for Water Pump leakage. Please verify and approve.',
            link='/resident/complaints/' + str(c2.id),
            category='warning',
            is_read=False
        ))
        db.session.add(Notification(
            user_id=worker_objs['worker_anand'].user_id,
            title='Correction Needed: #CC-2026-0003',
            message='Resident rejected repair: Debris and silt still clogging lower trap.',
            link='/worker/tasks/' + str(a3.id),
            category='danger',
            is_read=False
        ))
        db.session.add(Notification(
            user_id=mgr_user.id,
            title='Critical Recurring Alert: AST-ELEV-01',
            message='Passenger Elevator 1 has accumulated 4 complaints in 30 days. Reliability warning active.',
            link='/manager/recurring-issues',
            category='danger',
            is_read=False
        ))

        db.session.commit()
        print("Database successfully seeded with realistic demonstration records!")
        print("Demo credentials:")
        print("  Manager:   manager_admin   / admin123")
        print("  Worker:    worker_ramesh   / worker123   (or worker_vikram, worker_suresh)")
        print("  Resident:  resident_devika / resident123 (or resident_arjun)")

if __name__ == '__main__':
    seed_database()
