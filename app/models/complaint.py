from datetime import datetime
from app import db

class ComplaintCategory(db.Model):
    __tablename__ = 'complaint_categories'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), unique=True, nullable=False)
    default_criticality = db.Column(db.Integer, default=3, nullable=False)  # 1 to 5
    description = db.Column(db.String(255), nullable=True)
    icon = db.Column(db.String(50), default='bi-tools', nullable=True)

    # Relationships
    complaints = db.relationship('Complaint', backref='category', lazy='dynamic')

    def __repr__(self):
        return f'<ComplaintCategory {self.name}>'


class Complaint(db.Model):
    __tablename__ = 'complaints'

    id = db.Column(db.Integer, primary_key=True)
    complaint_no = db.Column(db.String(30), unique=True, nullable=False, index=True)
    resident_id = db.Column(db.Integer, db.ForeignKey('residents.id', ondelete='CASCADE'), nullable=False)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id', ondelete='SET NULL'), nullable=True)
    category_id = db.Column(db.Integer, db.ForeignKey('complaint_categories.id'), nullable=False)
    
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location_details = db.Column(db.String(200), nullable=False)
    photo_url = db.Column(db.String(255), nullable=True)

    # Priority Calculation Components (P = 7S + 5A + 4W + 4R)
    severity = db.Column(db.Integer, default=3, nullable=False)  # S (1-5)
    work_impact = db.Column(db.Integer, default=2, nullable=False)  # W (1-5)
    recurrence_score = db.Column(db.Integer, default=1, nullable=False)  # R (1-5)
    priority_score = db.Column(db.Integer, default=0, nullable=False, index=True)  # Calculated P
    priority_level = db.Column(db.String(20), default='Medium', nullable=False, index=True)  # Critical, High, Medium, Low

    # Priority Override
    priority_override = db.Column(db.Boolean, default=False, nullable=False)
    override_priority_level = db.Column(db.String(20), nullable=True)
    override_reason = db.Column(db.Text, nullable=True)
    override_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    override_at = db.Column(db.DateTime, nullable=True)

    # Status: Submitted -> Assigned -> In Progress -> Pending Verification -> Rework Required / Closed
    status = db.Column(db.String(30), default='Submitted', nullable=False, index=True)

    # Duplicate Management
    is_duplicate = db.Column(db.Boolean, default=False, nullable=False)
    duplicate_of_id = db.Column(db.Integer, db.ForeignKey('complaints.id', ondelete='SET NULL'), nullable=True)

    # Workflow Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    assigned_at = db.Column(db.DateTime, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    submitted_for_verification_at = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    closed_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    override_by = db.relationship('User', foreign_keys=[override_by_id])
    duplicates = db.relationship('Complaint', backref=db.backref('original_complaint', remote_side=[id]), lazy='dynamic')
    assignments = db.relationship('Assignment', backref='complaint', lazy='dynamic', cascade='all, delete-orphan')
    status_updates = db.relationship('StatusUpdate', backref='complaint', lazy='dynamic', cascade='all, delete-orphan', order_by='StatusUpdate.created_at.asc()')
    repair_evidences = db.relationship('RepairEvidence', backref='complaint', lazy='dynamic', cascade='all, delete-orphan', order_by='RepairEvidence.submitted_at.desc()')
    feedback = db.relationship('Feedback', backref='complaint', uselist=False, cascade='all, delete-orphan')
    maintenance_records = db.relationship('MaintenanceRecord', backref='complaint', lazy='dynamic')

    @property
    def current_assignment(self):
        return self.assignments.order_by(Assignment.assigned_at.desc()).first()

    @property
    def active_worker(self):
        curr = self.current_assignment
        return curr.worker if curr else None

    @property
    def effective_priority(self):
        if self.priority_override and self.override_priority_level:
            return self.override_priority_level
        return self.priority_level

    @property
    def latest_evidence(self):
        return self.repair_evidences.first()

    @property
    def latest_rework_update(self):
        return self.status_updates.filter_by(new_status='Rework Required').order_by(StatusUpdate.created_at.desc()).first()

    def __repr__(self):
        return f'<Complaint {self.complaint_no} [{self.status}] P={self.effective_priority}>'


class Assignment(db.Model):
    __tablename__ = 'assignments'

    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id', ondelete='CASCADE'), nullable=False)
    worker_id = db.Column(db.Integer, db.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False)
    assigned_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(30), default='Assigned', nullable=False)  # Assigned, Accepted, In Progress, Submitted, Completed, Reassigned
    deadline = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    # Relationships
    assigned_by = db.relationship('User', foreign_keys=[assigned_by_id])

    def __repr__(self):
        return f'<Assignment Complaint:{self.complaint_id} Worker:{self.worker_id} Status:{self.status}>'


class StatusUpdate(db.Model):
    __tablename__ = 'status_updates'

    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id', ondelete='CASCADE'), nullable=False)
    old_status = db.Column(db.String(30), nullable=True)
    new_status = db.Column(db.String(30), nullable=False)
    changed_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    changed_by = db.relationship('User')

    def __repr__(self):
        return f'<StatusUpdate {self.old_status} -> {self.new_status}>'


class RepairEvidence(db.Model):
    __tablename__ = 'repair_evidences'

    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id', ondelete='CASCADE'), nullable=False)
    worker_id = db.Column(db.Integer, db.ForeignKey('workers.id', ondelete='CASCADE'), nullable=False)
    before_photo_url = db.Column(db.String(255), nullable=True)
    after_photo_url = db.Column(db.String(255), nullable=False)
    inspection_notes = db.Column(db.Text, nullable=True)
    repair_description = db.Column(db.Text, nullable=False)
    parts_replaced = db.Column(db.String(255), nullable=True)
    time_spent_minutes = db.Column(db.Integer, default=60, nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<RepairEvidence Complaint:{self.complaint_id} Worker:{self.worker_id}>'


class Feedback(db.Model):
    __tablename__ = 'feedbacks'

    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id', ondelete='CASCADE'), unique=True, nullable=False)
    resident_id = db.Column(db.Integer, db.ForeignKey('residents.id', ondelete='CASCADE'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1 to 5 stars
    comments = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f'<Feedback Complaint:{self.complaint_id} Rating:{self.rating}*>'


class MaintenanceRecord(db.Model):
    __tablename__ = 'maintenance_records'

    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id', ondelete='SET NULL'), nullable=True)
    performed_by_id = db.Column(db.Integer, db.ForeignKey('workers.id', ondelete='SET NULL'), nullable=True)
    maintenance_type = db.Column(db.String(50), default='Corrective', nullable=False)  # Preventive, Corrective, Emergency
    notes = db.Column(db.Text, nullable=False)
    cost = db.Column(db.Float, default=0.0, nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    performed_by = db.relationship('Worker')

    def __repr__(self):
        return f'<MaintenanceRecord Asset:{self.asset_id} Type:{self.maintenance_type}>'
