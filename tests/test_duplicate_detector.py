from datetime import datetime, timedelta
from app import db
from app.services.duplicate_detector import DuplicateDetector
from app.models.complaint import Complaint, ComplaintCategory
from app.models.asset import Asset
from app.models.user import Resident

def test_duplicate_detection_rules(app):
    with app.app_context():
        res = Resident.query.first()
        cat = ComplaintCategory.query.first()
        asset = Asset.query.first()

        # Create base active complaint
        c1 = Complaint(
            complaint_no='CC-TEST-001',
            resident_id=res.id,
            asset_id=asset.id,
            category_id=cat.id,
            title='Main elevator jerky stop and door jam',
            description='Elevator car shuddered violently between floors with scraping sound',
            location_details='Block A Elevator Shaft',
            severity=4,
            work_impact=3,
            recurrence_score=1,
            priority_score=69,
            priority_level='High',
            status='In Progress'
        )
        db.session.add(c1)
        db.session.commit()

        # Case 1: Same Asset ID duplicate check
        matches = DuplicateDetector.detect_duplicates(
            title='Lift doors stuck',
            description='The lift will not open doors',
            category_id=cat.id,
            location_details='Block A',
            asset_id=asset.id
        )
        assert len(matches) > 0
        assert matches[0]['confidence'] in ['High', 'Medium']
        assert matches[0]['complaint'].id == c1.id

        # Case 2: Text similarity check
        sim_matches = DuplicateDetector.detect_duplicates(
            title='Main elevator jerky stop with scraping sound',
            description='Violent shuddering and scraping sound in elevator car',
            category_id=cat.id,
            location_details='Unknown',
            asset_id=None
        )
        assert len(sim_matches) > 0
        assert sim_matches[0]['text_similarity'] > 0.4


def test_recurring_asset_alerts(app):
    with app.app_context():
        res = Resident.query.first()
        cat = ComplaintCategory.query.first()
        asset = Asset.query.first()

        # Add 3 complaints to the asset within past 20 days
        for i in range(3):
            c = Complaint(
                complaint_no=f'CC-RECUR-{i}',
                resident_id=res.id,
                asset_id=asset.id,
                category_id=cat.id,
                title=f'Elevator fault incident #{i}',
                description=f'Recurring issue on elevator #{i}',
                location_details='Block A Shaft',
                severity=3,
                work_impact=2,
                recurrence_score=3,
                priority_score=50,
                priority_level='Medium',
                status='Closed',
                created_at=datetime.utcnow() - timedelta(days=5 + i)
            )
            db.session.add(c)
        db.session.commit()

        alerts = DuplicateDetector.get_recurring_asset_alerts(window_days=30, threshold=3)
        assert len(alerts) > 0
        assert alerts[0]['asset'].id == asset.id
        assert alerts[0]['complaint_count'] >= 3
        assert 'recommendation' in alerts[0]
