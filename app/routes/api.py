from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from app.services.analytics_service import AnalyticsService
from app.services.duplicate_detector import DuplicateDetector
from app.models.asset import Asset
from app.models.complaint import ComplaintCategory

api_bp = Blueprint('api', __name__)

@api_bp.route('/analytics/data')
@login_required
def analytics_data():
    if not current_user.has_role('manager'):
        return jsonify({'error': 'Unauthorized'}), 403

    category_dist = AnalyticsService.get_category_distribution()
    priority_dist = AnalyticsService.get_priority_distribution()
    status_dist = AnalyticsService.get_status_distribution()
    monthly_trend = AnalyticsService.get_monthly_trend()
    worker_perf = AnalyticsService.get_worker_performance_metrics()

    worker_labels = [w['name'] for w in worker_perf]
    worker_completed = [w['completed_count'] for w in worker_perf]
    worker_ratings = [w['avg_rating'] for w in worker_perf]

    return jsonify({
        'category_distribution': category_dist,
        'priority_distribution': priority_dist,
        'status_distribution': status_dist,
        'monthly_trend': monthly_trend,
        'worker_metrics': {
            'labels': worker_labels,
            'completed': worker_completed,
            'ratings': worker_ratings
        }
    })

@api_bp.route('/check-duplicates', methods=['POST'])
@login_required
def check_duplicates():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    category_id = data.get('category_id')
    location_details = data.get('location_details', '').strip()
    asset_id = data.get('asset_id')

    if not title and not description:
        return jsonify({'matches': []})

    matches = DuplicateDetector.detect_duplicates(
        title=title,
        description=description,
        category_id=int(category_id) if category_id else None,
        location_details=location_details,
        asset_id=int(asset_id) if asset_id else None
    )

    results = []
    for m in matches[:5]:
        c = m['complaint']
        results.append({
            'id': c.id,
            'complaint_no': c.complaint_no,
            'title': c.title,
            'status': c.status,
            'priority_level': c.priority_level,
            'created_at': c.created_at.strftime('%Y-%m-%d'),
            'confidence': m['confidence'],
            'reasons': m['reasons'],
            'text_similarity': m['text_similarity']
        })

    return jsonify({'matches': results})

@api_bp.route('/asset/<asset_code>')
@login_required
def get_asset_info(asset_code):
    asset = Asset.query.filter_by(asset_code=asset_code.upper()).first()
    if not asset:
        return jsonify({'found': False, 'message': 'Asset not found'}), 404

    return jsonify({
        'found': True,
        'id': asset.id,
        'asset_code': asset.asset_code,
        'name': asset.name,
        'category': asset.category,
        'building': asset.building,
        'location': asset.location,
        'criticality': asset.criticality,
        'condition': asset.condition,
        'status': asset.status
    })
