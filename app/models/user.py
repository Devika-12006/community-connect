from datetime import datetime
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from app import db

class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # 'resident', 'worker', 'manager'
    full_name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    resident_profile = db.relationship('Resident', backref='user', uselist=False, cascade='all, delete-orphan')
    worker_profile = db.relationship('Worker', backref='user', uselist=False, cascade='all, delete-orphan')
    manager_profile = db.relationship('Manager', backref='user', uselist=False, cascade='all, delete-orphan')
    notifications = db.relationship('Notification', backref='recipient', lazy='dynamic', cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', backref='actor', lazy='dynamic')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def has_role(self, *roles):
        return self.role in roles

    @property
    def is_resident(self):
        return self.role == 'resident'

    @property
    def is_worker(self):
        return self.role == 'worker'

    @property
    def is_manager(self):
        return self.role == 'manager'

    def __repr__(self):
        return f'<User {self.username} [{self.role}]>'


class Resident(db.Model):
    __tablename__ = 'residents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    flat_no = db.Column(db.String(20), nullable=False)
    building_block = db.Column(db.String(50), nullable=False)
    alternate_contact = db.Column(db.String(20), nullable=True)
    verified = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    complaints = db.relationship('Complaint', backref='resident', lazy='dynamic', cascade='all, delete-orphan')
    feedback = db.relationship('Feedback', backref='resident', lazy='dynamic')

    @property
    def full_address(self):
        return f"{self.building_block}, Flat {self.flat_no}"

    def __repr__(self):
        return f'<Resident {self.user.full_name} ({self.full_address})>'


class Worker(db.Model):
    __tablename__ = 'workers'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    specialty = db.Column(db.String(80), nullable=False)  # Electrical, Plumbing, Elevator, Civil, etc.
    is_available = db.Column(db.Boolean, default=True, nullable=False)
    emergency_contact = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    assignments = db.relationship('Assignment', backref='worker', lazy='dynamic')
    repair_evidences = db.relationship('RepairEvidence', backref='worker', lazy='dynamic')

    def __repr__(self):
        return f'<Worker {self.user.full_name} ({self.specialty})>'


class Manager(db.Model):
    __tablename__ = 'managers'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    designation = db.Column(db.String(80), default='Community Manager', nullable=False)
    department = db.Column(db.String(80), default='Facility Operations', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Manager {self.user.full_name} - {self.designation}>'
