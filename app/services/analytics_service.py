from datetime import datetime, timedelta
from sqlalchemy import func
from app import db
from app.models.complaint import Complaint, Assignment, ComplaintCategory, Feedback, RepairEvidence
from app.models.asset import Asset
from app.models.user import Worker, User

class AnalyticsService:
    """
    Facility Analytics and Reporting Engine.
    All metrics derive strictly from database timestamps and verified records.
    """

    @classmethod
    def get_manager_overview(cls, filters=None):
        query = Complaint.query

        if filters:
            if filters.get('category_id'):
                query = query.filter(Complaint.category_id == filters['category_id'])
            if filters.get('asset_id'):
                query = query.filter(Complaint.asset_id == filters['asset_id'])
            if filters.get('priority'):
                query = query.filter(Complaint.priority_level == filters['priority'])
            if filters.get('status'):
                query = query.filter(Complaint.status == filters['status'])
            if filters.get('start_date'):
                query = query.filter(Complaint.created_at >= filters['start_date'])
            if filters.get('end_date'):
                query = query.filter(Complaint.created_at <= filters['end_date'])

        total = query.count()
        open_statuses = ['Submitted', 'Assigned', 'In Progress', 'Rework Required']
        open_count = query.filter(Complaint.status.in_(open_statuses)).count()
        pending_verification = query.filter(Complaint.status == 'Pending Verification').count()
        closed_count = query.filter(Complaint.status == 'Closed').count()
        critical_count = query.filter(Complaint.priority_level == 'Critical').count()
        high_count = query.filter(Complaint.priority_level == 'High').count()

        total_assets = Asset.query.count()
        due_maintenance_assets = Asset.query.filter(
            Asset.next_maintenance_date != None,
            Asset.next_maintenance_date <= datetime.utcnow()
        ).count()

        # Average Response Time (Created -> Started)
        # and Average Resolution Time (Started -> Closed / Verified)
        closed_complaints = Complaint.query.filter(
            Complaint.status == 'Closed',
            Complaint.created_at != None
        ).all()

        response_hours = []
        resolution_hours = []

        for c in closed_complaints:
            if c.started_at and c.created_at:
                diff_resp = (c.started_at - c.created_at).total_seconds() / 3600.0
                if diff_resp >= 0:
                    response_hours.append(diff_resp)
            elif c.assigned_at and c.created_at:
                diff_resp = (c.assigned_at - c.created_at).total_seconds() / 3600.0
                if diff_resp >= 0:
                    response_hours.append(diff_resp)

            if c.closed_at and (c.started_at or c.created_at):
                start_pt = c.started_at or c.created_at
                diff_res = (c.closed_at - start_pt).total_seconds() / 3600.0
                if diff_res >= 0:
                    resolution_hours.append(diff_res)

        avg_resp_time = round(sum(response_hours) / len(response_hours), 1) if response_hours else 0.0
        avg_resol_time = round(sum(resolution_hours) / len(resolution_hours), 1) if resolution_hours else 0.0

        return {
            'total_complaints': total,
            'open_complaints': open_count,
            'pending_verification': pending_verification,
            'closed_complaints': closed_count,
            'critical_complaints': critical_count,
            'high_complaints': high_count,
            'total_assets': total_assets,
            'due_maintenance_assets': due_maintenance_assets,
            'avg_response_hours': avg_resp_time,
            'avg_resolution_hours': avg_resol_time
        }

    @classmethod
    def get_category_distribution(cls):
        categories = ComplaintCategory.query.all()
        labels = []
        data = []
        for cat in categories:
            count = Complaint.query.filter_by(category_id=cat.id).count()
            labels.append(cat.name)
            data.append(count)
        return {'labels': labels, 'data': data}

    @classmethod
    def get_priority_distribution(cls):
        levels = ['Critical', 'High', 'Medium', 'Low']
        data = [Complaint.query.filter_by(priority_level=lvl).count() for lvl in levels]
        return {'labels': levels, 'data': data}

    @classmethod
    def get_status_distribution(cls):
        statuses = ['Submitted', 'Assigned', 'In Progress', 'Pending Verification', 'Rework Required', 'Closed']
        data = [Complaint.query.filter_by(status=st).count() for st in statuses]
        return {'labels': statuses, 'data': data}

    @classmethod
    def get_monthly_trend(cls, months=6):
        labels = []
        counts = []
        now = datetime.utcnow()
        for i in range(months - 1, -1, -1):
            m_start = datetime(now.year, now.month, 1) - timedelta(days=i * 30)
            m_start = datetime(m_start.year, m_start.month, 1)
            # next month start
            if m_start.month == 12:
                m_end = datetime(m_start.year + 1, 1, 1)
            else:
                m_end = datetime(m_start.year, m_start.month + 1, 1)

            month_name = m_start.strftime('%b %Y')
            cnt = Complaint.query.filter(
                Complaint.created_at >= m_start,
                Complaint.created_at < m_end
            ).count()
            labels.append(month_name)
            counts.append(cnt)

        return {'labels': labels, 'data': counts}

    @classmethod
    def get_worker_performance_metrics(cls):
        workers = Worker.query.all()
        results = []

        for w in workers:
            assignments = Assignment.query.filter_by(worker_id=w.id).all()
            assigned_count = len(assignments)
            completed_assignments = [a for a in assignments if a.status in ['Completed', 'Submitted']]
            completed_count = len(completed_assignments)
            active_count = len([a for a in assignments if a.status in ['Assigned', 'Accepted', 'In Progress']])

            # Count rework instances (complaints that were rejected while assigned to this worker)
            rework_count = Complaint.query.filter(
                Complaint.id.in_([a.complaint_id for a in assignments]),
                Complaint.status == 'Rework Required'
            ).count()

            # Ratings received from resident feedback
            complaint_ids = [a.complaint_id for a in assignments]
            feedbacks = Feedback.query.filter(Feedback.complaint_id.in_(complaint_ids)).all() if complaint_ids else []
            avg_rating = round(sum(f.rating for f in feedbacks) / len(feedbacks), 1) if feedbacks else None

            # Resolution time for this worker
            worker_resolutions = []
            for a in completed_assignments:
                if a.completed_at and a.accepted_at:
                    hrs = (a.completed_at - a.accepted_at).total_seconds() / 3600.0
                    if hrs >= 0:
                        worker_resolutions.append(hrs)

            avg_res_hrs = round(sum(worker_resolutions) / len(worker_resolutions), 1) if worker_resolutions else 0.0

            # On-time completion rate
            on_time_count = 0
            for a in completed_assignments:
                if a.completed_at and a.deadline:
                    if a.completed_at <= a.deadline:
                        on_time_count += 1
                elif a.completed_at:
                    on_time_count += 1

            on_time_rate = round((on_time_count / completed_count) * 100, 1) if completed_count > 0 else 100.0

            results.append({
                'worker': w,
                'name': w.user.full_name,
                'specialty': w.specialty,
                'assigned_count': assigned_count,
                'completed_count': completed_count,
                'active_count': active_count,
                'rework_count': rework_count,
                'on_time_rate': on_time_rate,
                'avg_resolution_hours': avg_res_hrs,
                'avg_rating': avg_rating or 0.0,
                'feedback_count': len(feedbacks)
            })

        return results

    @classmethod
    def get_frequently_failing_assets(cls, limit=5):
        """
        Retrieves assets with the highest incident counts.
        """
        results = db.session.query(
            Asset,
            func.count(Complaint.id).label('complaint_count')
        ).join(Complaint, Complaint.asset_id == Asset.id)\
         .group_by(Asset.id)\
         .order_by(func.count(Complaint.id).desc())\
         .limit(limit)\
         .all()

        return [
            {
                'asset': r[0],
                'count': r[1],
                'criticality': r[0].criticality,
                'condition': r[0].condition
            }
            for r in results
        ]
