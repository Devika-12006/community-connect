from app import db
from app.models.notification import Notification
from app.models.user import User

class NotificationService:
    @staticmethod
    def notify(user_id, title, message, link=None, category='info'):
        """
        Creates an in-app notification for a given user.
        """
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            link=link,
            category=category
        )
        db.session.add(notif)
        db.session.commit()
        return notif

    @classmethod
    def notify_role(cls, role, title, message, link=None, category='info'):
        """
        Broadcasts notification to all active users with a specified role.
        """
        users = User.query.filter_by(role=role, is_active=True).all()
        created = []
        for u in users:
            notif = Notification(
                user_id=u.id,
                title=title,
                message=message,
                link=link,
                category=category
            )
            db.session.add(notif)
            created.append(notif)
        db.session.commit()
        return created
