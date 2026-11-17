import re
from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from app import db
from app.models.user import User, Resident
from app.models.notification import Notification

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        if current_user.is_resident:
            return redirect(url_for('resident.dashboard'))
        elif current_user.is_worker:
            return redirect(url_for('worker.dashboard'))
        elif current_user.is_manager:
            return redirect(url_for('manager.dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        remember = True if request.form.get('remember') else False

        user = User.query.filter((User.username == username) | (User.email == username)).first()

        if not user or not user.check_password(password):
            flash('Invalid username or password. Please try again.', 'danger')
            return render_template('auth/login.html')

        if not user.is_active:
            flash('Your account has been deactivated. Please contact the community manager.', 'danger')
            return render_template('auth/login.html')

        login_user(user, remember=remember)
        flash(f'Welcome back, {user.full_name}!', 'success')

        next_page = request.args.get('next')
        if next_page and next_page.startswith('/'):
            return redirect(next_page)

        if user.is_resident:
            return redirect(url_for('resident.dashboard'))
        elif user.is_worker:
            return redirect(url_for('worker.dashboard'))
        elif user.is_manager:
            return redirect(url_for('manager.dashboard'))

    return render_template('auth/login.html')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        raw_full_name = request.form.get('full_name', '')
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        building_block = request.form.get('building_block', '').strip()
        raw_flat_no = request.form.get('flat_no', '')
        phone = request.form.get('phone', '').strip()

        # Trim unnecessary spaces from name (leading, trailing, and multiple spaces collapsed)
        full_name = re.sub(r'\s+', ' ', raw_full_name).strip() if raw_full_name else ''
        flat_no = raw_flat_no.strip() if raw_flat_no else ''

        # 1. Full Name Validations (Mandatory, max 30 chars, English alphabets and spaces only)
        name_error = None
        if not full_name:
            name_error = 'Full Name is mandatory.'
        elif len(full_name) > 30:
            name_error = 'Name cannot exceed 30 characters.'
        elif not re.match(r'^[A-Za-z ]+$', full_name):
            name_error = 'Name must contain only English alphabets (A–Z, a–z) and spaces. Numbers and special characters are not allowed.'

        # 2. Flat Number Validations (Mandatory, max 10 chars, letters, numbers, hyphens, and slashes only)
        flat_error = None
        if not flat_no:
            flat_error = 'Flat Number is mandatory.'
        elif len(flat_no) > 10:
            flat_error = 'Flat number cannot exceed 10 characters.'
        elif not re.match(r'^[A-Za-z0-9/-]+$', flat_no):
            flat_error = 'Flat number can only contain letters, numbers, hyphens (-), and forward slashes (/). Spaces and other special characters are not allowed.'

        if name_error:
            flash(name_error, 'danger')
        if flat_error:
            flash(flat_error, 'danger')

        if name_error or flat_error:
            return render_template(
                'auth/register.html',
                name_error=name_error,
                flat_error=flat_error,
                full_name=raw_full_name,
                username=username,
                email=email,
                building_block=building_block,
                flat_no=raw_flat_no,
                phone=phone
            )

        # Other Validations
        if not all([full_name, username, email, password, building_block, flat_no]):
            flash('Please fill in all mandatory fields.', 'warning')
            return render_template('auth/register.html')

        if password != confirm_password:
            flash('Passwords do not match.', 'danger')
            return render_template('auth/register.html')

        if len(password) < 6:
            flash('Password must be at least 6 characters long.', 'warning')
            return render_template('auth/register.html')

        if User.query.filter_by(username=username).first():
            flash('Username is already taken.', 'danger')
            return render_template('auth/register.html')

        if User.query.filter_by(email=email).first():
            flash('Email address is already registered.', 'danger')
            return render_template('auth/register.html')

        user = User(
            username=username,
            email=email,
            role='resident',
            full_name=full_name,
            phone=phone,
            is_active=True
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        resident = Resident(
            user_id=user.id,
            building_block=building_block,
            flat_no=flat_no,
            alternate_contact=phone
        )
        db.session.add(resident)
        db.session.commit()

        flash('Registration successful! You may now log in to Community Connect.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/register.html')


@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out securely.', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/notifications')
@login_required
def notifications():
    notifs = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).all()
    return render_template('notifications/index.html', notifications=notifs)


@auth_bp.route('/notifications/read/<int:notif_id>', methods=['POST'])
@login_required
def mark_read(notif_id):
    notif = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first_or_404()
    notif.mark_as_read()
    db.session.commit()
    return jsonify({'success': True})


@auth_bp.route('/notifications/mark-all-read', methods=['POST'])
@login_required
def mark_all_read():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({'is_read': True})
    db.session.commit()
    flash('All notifications marked as read.', 'success')
    return redirect(url_for('auth.notifications'))
