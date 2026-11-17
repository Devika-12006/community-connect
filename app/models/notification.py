from datetime import datetime
from app import db

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)
    link = db.Column(db.String(255), nullable=True)
    category = db.Column(db.String(20), default='info', nullable=False)  # info, success, warning, danger
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    def mark_as_read(self):
        self.is_read = True

    def __repr__(self):
        return f'<Notification User:{self.user_id} Title:{self.title} Read:{self.is_read}>'
