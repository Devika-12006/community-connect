import os
from app import create_app, db

app = create_app()

@app.cli.command('init-db')
def init_db():
    """Initialize empty database tables."""
    db.create_all()
    print("Database tables initialized.")

@app.cli.command('seed-demo')
def seed_demo_command():
    """Seed database with realistic demonstration records."""
    from seed_demo import seed_database
    seed_database()

if __name__ == '__main__':
    # Initialize DB if not present
    with app.app_context():
        db.create_all()
    
    port = int(os.environ.get('PORT', 5000))
    print(f"Community Connect starting on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
