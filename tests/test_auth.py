def test_resident_registration(client):
    response = client.post('/auth/register', data={
        'full_name': 'New Resident',
        'username': 'new_res',
        'email': 'new_res@community.com',
        'building_block': 'Tower B',
        'flat_no': '204',
        'phone': '9876543219',
        'password': 'Password@123',
        'confirm_password': 'Password@123'
    }, follow_redirects=True)
    assert response.status_code == 200
    assert b'Registration successful' in response.data

def test_login_logout(client, auth):
    # Test valid login
    res = auth.login('test_resident', 'pass123')
    assert res.status_code == 200
    assert b'Welcome back' in res.data or b'Resident Portal' in res.data

    # Test logout
    res_logout = auth.logout()
    assert res_logout.status_code == 200
    assert b'logged out' in res_logout.data

def test_invalid_credentials(client, auth):
    res = auth.login('test_resident', 'wrongpassword')
    assert res.status_code == 200
    assert b'Invalid username or password' in res.data

def test_rbac_resident_blocked_from_manager(client, auth):
    auth.login('test_resident', 'pass123')
    res = client.get('/manager/dashboard')
    assert res.status_code == 403
    assert b'403' in res.data

def test_rbac_worker_blocked_from_manager(client, auth):
    auth.login('test_worker', 'pass123')
    res = client.get('/manager/dashboard')
    assert res.status_code == 403

def test_unauthenticated_redirect(client):
    res = client.get('/resident/dashboard', follow_redirects=False)
    assert res.status_code == 302
    assert '/auth/login' in res.headers['Location']

def test_manager_access(client, auth):
    auth.login('test_mgr', 'pass123')
    res = client.get('/manager/dashboard')
    assert res.status_code == 200
    assert b'Executive Community Dashboard' in res.data
