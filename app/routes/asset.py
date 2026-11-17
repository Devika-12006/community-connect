from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from app.models.asset import Asset
from app.models.complaint import Complaint, MaintenanceRecord

asset_bp = Blueprint('asset', __name__)

@asset_bp.route('/scan')
@login_required
def scan_qr():
    """
    Dedicated QR Scanner page featuring HTML5 camera video scanner
    and manual Asset ID search fallback.
    """
    assets = Asset.query.order_by(Asset.name).all()
    return render_template('asset/scan.html', assets=assets)


@asset_bp.route('/lookup')
@login_required
def lookup():
    query = request.args.get('q', '').strip().upper()
    if not query:
        flash('Please enter an Asset ID to search.', 'warning')
        return redirect(url_for('asset.scan_qr'))

    asset = Asset.query.filter(
        (Asset.asset_code == query) | (Asset.asset_code.ilike(f"%{query}%"))
    ).first()

    if not asset:
        flash(f"Asset '{query}' not found. Please verify the asset code.", 'danger')
        return redirect(url_for('asset.scan_qr'))

    return redirect(url_for('asset.view_asset', asset_code=asset.asset_code))


@asset_bp.route('/<asset_code>')
@login_required
def view_asset(asset_code):
    """
    Asset Detail & History view reached by scanning asset QR code.
    Accessible to Residents, Workers, and Managers with appropriate controls.
    """
    asset = Asset.query.filter_by(asset_code=asset_code.upper()).first_or_404()
    recent_complaints = asset.complaints.order_by(Complaint.created_at.desc()).limit(10).all()
    maintenance_records = asset.maintenance_records.order_by(MaintenanceRecord.completed_at.desc()).limit(10).all()

    return render_template(
        'asset/view.html',
        asset=asset,
        recent_complaints=recent_complaints,
        maintenance_records=maintenance_records
    )
