from app.services.analytics_service import AnalyticsService
from app.models.complaint import Complaint
from app import db

def test_analytics_metrics(app):
    with app.app_context():
        overview = AnalyticsService.get_manager_overview()
        assert 'total_complaints' in overview
        assert 'open_complaints' in overview
        assert 'avg_response_hours' in overview
        assert 'avg_resolution_hours' in overview

        cat_dist = AnalyticsService.get_category_distribution()
        assert 'labels' in cat_dist
        assert 'data' in cat_dist

        pri_dist = AnalyticsService.get_priority_distribution()
        assert 'labels' in pri_dist
        assert 'Critical' in pri_dist['labels']

        worker_metrics = AnalyticsService.get_worker_performance_metrics()
        assert len(worker_metrics) > 0
        w0 = worker_metrics[0]
        assert 'name' in w0
        assert 'assigned_count' in w0
        assert 'on_time_rate' in w0
