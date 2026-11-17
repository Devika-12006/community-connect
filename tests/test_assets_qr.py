from app.services.qr_service import QRService
from app.models.asset import Asset
from app import db

def test_qr_generation(app):
    with app.app_context():
        qr_path = QRService.generate_asset_qr('AST-TEST-99')
        assert 'AST-TEST-99.png' in qr_path

def test_asset_lookup(client, auth):
    auth.login('test_resident', 'pass123')
    
    # Direct asset code view
    res = client.get('/assets/AST-ELEV-01')
    assert res.status_code == 200
    assert b'Passenger Elevator A1' in res.data
    assert b'Report Issue on this Asset' in res.data

    # Search lookup redirect
    res_search = client.get('/assets/lookup?q=AST-ELEV-01', follow_redirects=True)
    assert res_search.status_code == 200
    assert b'Passenger Elevator A1' in res_search.data

def test_asset_lookup_invalid(client, auth):
    auth.login('test_resident', 'pass123')
    res = client.get('/assets/lookup?q=INVALID-CODE', follow_redirects=True)
    assert res.status_code == 200
    assert b'not found' in res.data
