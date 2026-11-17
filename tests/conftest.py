import pytest
from app import create_app, db
from app.config import TestingConfig
from app.models.user import User, Resident, Worker, Manager
from app.models.asset import Asset
from app.models.complaint import ComplaintCategory

@pytest.fixture
def app():
    app = create_app(TestingConfig)
    with app.app_context():
        db.create_all()
        
        # Base setup: categories
        cat = ComplaintCategory(name='Elevators & Lifts', default_criticality=5, icon='bi-tools')
        cat2 = ComplaintCategory(name='Water Supply & Pumps', default_criticality=4, icon='bi-droplet')
        db.session.add(cat)
        db.session.add(cat2)

        # Base setup: Asset
        asset = Asset(
            asset_code='AST-ELEV-01',
            name='Passenger Elevator A1',
            category='Elevators & Lifts',
            building='Tower A',
            location='Tower A Main Lobby',
            criticality=5,
            condition='Good',
            status='Operational'
        )
        db.session.add(asset)

        # Users
        # 1. Manager
        mgr = User(username='test_mgr', email='mgr@test.com', role='manager', full_name='Manager Test')
        mgr.set_password('pass123')
        db.session.add(mgr)
        db.session.flush()
        mgr_profile = Manager(user_id=mgr.id, designation='Ops Manager')
        db.session.add(mgr_profile)

        # 2. Worker
        wkr = User(username='test_worker', email='wkr@test.com', role='worker', full_name='Worker Test')
        wkr.set_password('pass123')
        db.session.add(wkr)
        db.session.flush()
        wkr_profile = Worker(user_id=wkr.id, specialty='Plumbing & Water')
        db.session.add(wkr_profile)

        # 3. Resident
        res = User(username='test_resident', email='res@test.com', role='resident', full_name='Resident Test')
        res.set_password('pass123')
        db.session.add(res)
        db.session.flush()
        res_profile = Resident(user_id=res.id, building_block='Tower A', flat_no='101')
        db.session.add(res_profile)

        db.session.commit()
        yield app

        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

class AuthActions:
    def __init__(self, client):
        self._client = client

    def login(self, username='test_resident', password='pass123'):
        return self._client.post('/auth/login', data={
            'username': username,
            'password': password
        }, follow_redirects=True)

    def logout(self):
        return self._client.get('/auth/logout', follow_redirects=True)

@pytest.fixture
def auth(client):
    return AuthActions(client)
