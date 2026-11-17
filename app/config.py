import os

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-community-connect-key-90plus-score-2026')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'app', 'static', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
    
    # Priority Formula: P = 7S + 5A + 4W + 4R
    PRIORITY_WEIGHTS = {
        'severity': 7,
        'criticality': 5,
        'work_impact': 4,
        'recurrence': 4
    }
    
    # Priority Level Thresholds
    # Max possible = 7*5 + 5*5 + 4*5 + 4*5 = 100
    PRIORITY_THRESHOLDS = {
        'Critical': 75,
        'High': 55,
        'Medium': 35,
        'Low': 0
    }
    
    # Duplicate detection time window (in days)
    DUPLICATE_TIME_WINDOW_DAYS = 14
    
    # Recurrence alert threshold: N complaints within 30 days flags asset as unreliable
    RECURRING_ALERT_THRESHOLD = 3
    RECURRING_WINDOW_DAYS = 30

class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        f"sqlite:///{os.path.join(BASE_DIR, 'community_connect.db')}"
    )

class TestingConfig(Config):
    TESTING = True
    DEBUG = False
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'

class ProductionConfig(Config):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
