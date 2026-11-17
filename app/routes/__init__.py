from app.routes.auth import auth_bp
from app.routes.resident import resident_bp
from app.routes.worker import worker_bp
from app.routes.manager import manager_bp
from app.routes.asset import asset_bp
from app.routes.api import api_bp

__all__ = ['auth_bp', 'resident_bp', 'worker_bp', 'manager_bp', 'asset_bp', 'api_bp']
