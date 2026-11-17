import os
from functools import wraps
from flask import Flask, render_template, redirect, url_for, request, abort, current_app
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, current_user
from app.config import DevelopmentConfig

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'warning'

def role_required(*roles):
    """
    Server-side Role-Based Access Control (RBAC) Decorator.
    Guarantees authorization is enforced strictly on the server.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for('auth.login', next=request.url))
            if not current_user.has_role(*roles):
                abort(403)
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def create_app(config_class=DevelopmentConfig):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Ensure upload directories exist
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'complaints'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'evidence'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'qr_codes'), exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)

    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.resident import resident_bp
    from app.routes.worker import worker_bp
    from app.routes.manager import manager_bp
    from app.routes.asset import asset_bp
    from app.routes.api import api_bp

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(resident_bp, url_prefix='/resident')
    app.register_blueprint(worker_bp, url_prefix='/worker')
    app.register_blueprint(manager_bp, url_prefix='/manager')
    app.register_blueprint(asset_bp, url_prefix='/assets')
    app.register_blueprint(api_bp, url_prefix='/api')

    @app.route('/')
    def index():
        if current_user.is_authenticated:
            if current_user.is_resident:
                return redirect(url_for('resident.dashboard'))
            elif current_user.is_worker:
                return redirect(url_for('worker.dashboard'))
            elif current_user.is_manager:
                return redirect(url_for('manager.dashboard'))
        return render_template('index.html')

    @app.context_processor
    def inject_global_context():
        unread_count = 0
        if current_user.is_authenticated:
            from app.models.notification import Notification
            unread_count = Notification.query.filter_by(
                user_id=current_user.id,
                is_read=False
            ).count()
        return {
            'unread_notifications_count': unread_count,
            'current_user': current_user
        }

    @app.errorhandler(403)
    def forbidden_error(error):
        return render_template('errors/403.html'), 403

    @app.errorhandler(404)
    def not_found_error(error):
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return render_template('errors/500.html'), 500

    return app

from app.models.user import User

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
