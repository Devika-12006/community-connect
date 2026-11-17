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

def test_registration_validation_name_and_flat(client):
    # Invalid Name: numbers in name
    res1 = client.post('/auth/register', data={
        'full_name': 'Resident 123',
        'username': 'invalid_name_user',
        'email': 'invalid1@community.com',
        'building_block': 'Block A',
        'flat_no': 'A-203',
        'password': 'Password@123',
        'confirm_password': 'Password@123'
    }, follow_redirects=True)
    assert b'Name must contain only English alphabets' in res1.data

    # Invalid Name: >30 characters
    res2 = client.post('/auth/register', data={
        'full_name': 'A' * 31,
        'username': 'too_long_name_user',
        'email': 'invalid2@community.com',
        'building_block': 'Block A',
        'flat_no': 'A-203',
        'password': 'Password@123',
        'confirm_password': 'Password@123'
    }, follow_redirects=True)
    assert b'Name cannot exceed 30 characters' in res2.data

    # Invalid Flat: spaces in flat number
    res3 = client.post('/auth/register', data={
        'full_name': 'Valid Name',
        'username': 'invalid_flat_user',
        'email': 'invalid3@community.com',
        'building_block': 'Block A',
        'flat_no': 'A 203',
        'password': 'Password@123',
        'confirm_password': 'Password@123'
    }, follow_redirects=True)
    assert b'Flat number can only contain letters, numbers, hyphens' in res3.data

    # Invalid Flat: >10 characters
    res4 = client.post('/auth/register', data={
        'full_name': 'Valid Name',
        'username': 'too_long_flat_user',
        'email': 'invalid4@community.com',
        'building_block': 'Block A',
        'flat_no': '12345678901',
        'password': 'Password@123',
        'confirm_password': 'Password@123'
    }, follow_redirects=True)
    assert b'Flat number cannot exceed 10 characters' in res4.data

    # Valid Name and Flat: examples A-203, B/102, 1204 with unnecessary spaces trimmed in name
    res5 = client.post('/auth/register', data={
        'full_name': '  Priya   Sharma  ',
        'username': 'priya_valid',
        'email': 'priya_valid@community.com',
        'building_block': 'Block A',
        'flat_no': 'B/102',
        'password': 'Password@123',
        'confirm_password': 'Password@123'
    }, follow_redirects=True)
    assert res5.status_code == 200
    assert b'Registration successful' in res5.data

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
