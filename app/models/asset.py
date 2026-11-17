from datetime import datetime, timedelta
from app import db

class Asset(db.Model):
    __tablename__ = 'assets'

    id = db.Column(db.Integer, primary_key=True)
    asset_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    building = db.Column(db.String(60), nullable=False)
    location = db.Column(db.String(150), nullable=False)
    criticality = db.Column(db.Integer, default=3, nullable=False)  # 1 (lowest) to 5 (highest)
    installation_date = db.Column(db.Date, nullable=True)
    condition = db.Column(db.String(30), default='Good', nullable=False)  # Excellent, Good, Fair, Poor, Critical
    maintenance_frequency_days = db.Column(db.Integer, default=30, nullable=False)
    last_maintenance_date = db.Column(db.DateTime, nullable=True)
    next_maintenance_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(30), default='Operational', nullable=False)  # Operational, Under Maintenance, Degraded, Decommissioned
    qr_code_path = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    complaints = db.relationship('Complaint', backref='asset', lazy='dynamic')
    maintenance_records = db.relationship('MaintenanceRecord', backref='asset', lazy='dynamic', cascade='all, delete-orphan')

    @property
    def is_due_for_maintenance(self):
        if not self.next_maintenance_date:
            return False
        return datetime.utcnow() >= self.next_maintenance_date

    def schedule_next_maintenance(self):
        base_date = self.last_maintenance_date or datetime.utcnow()
        self.next_maintenance_date = base_date + timedelta(days=self.maintenance_frequency_days)

    def __repr__(self):
        return f'<Asset {self.asset_code} - {self.name} ({self.status})>'
