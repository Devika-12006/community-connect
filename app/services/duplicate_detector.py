import re
from datetime import datetime, timedelta
from app.config import Config
from app.models.complaint import Complaint
from app.models.asset import Asset

class DuplicateDetector:
    """
    Intelligent Duplicate & Recurring Issue Detection Module
    Combines deterministic rules (Asset ID, Category, Location, Time Window)
    with textual n-gram / token set similarity.
    """

    @staticmethod
    def _tokenize(text):
        if not text:
            return set()
        clean = re.sub(r'[^\w\s]', ' ', text.lower())
        tokens = [word for word in clean.split() if len(word) > 2]
        return set(tokens)

    @classmethod
    def _text_similarity(cls, text_a, text_b):
        """
        Calculates Jaccard similarity between two texts based on word tokens.
        """
        tokens_a = cls._tokenize(text_a)
        tokens_b = cls._tokenize(text_b)
        if not tokens_a or not tokens_b:
            return 0.0
        intersection = len(tokens_a.intersection(tokens_b))
        union = len(tokens_a.union(tokens_b))
        return intersection / union if union > 0 else 0.0

    @classmethod
    def detect_duplicates(cls, title, description, category_id, location_details, asset_id=None, exclude_id=None, days=None):
        """
        Scans existing complaints within the lookback window to find potential duplicates.
        Returns a list of match candidate dicts sorted by similarity score.
        """
        if days is None:
            days = Config.DUPLICATE_TIME_WINDOW_DAYS

        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query = Complaint.query.filter(
            Complaint.created_at >= cutoff_date,
            Complaint.status != 'Cancelled'
        )

        if exclude_id:
            query = query.filter(Complaint.id != exclude_id)

        candidates = query.all()
        matches = []
        new_text = f"{title} {description}"

        for item in candidates:
            item_text = f"{item.title} {item.description}"
            sim_score = cls._text_similarity(new_text, item_text)
            match_reasons = []
            confidence = 'Low'

            # Rule 1: Exact same asset ID while complaint is still active
            if asset_id and item.asset_id == asset_id:
                if item.status in ['Submitted', 'Assigned', 'In Progress', 'Pending Verification', 'Rework Required']:
                    match_reasons.append(f"Identical active asset: {item.asset.name if item.asset else asset_id}")
                    confidence = 'High'
                else:
                    match_reasons.append("Same asset previously reported in window")
                    if confidence != 'High':
                        confidence = 'Medium'

            # Rule 2: Same category and same location
            loc_match = (
                location_details and item.location_details and
                (location_details.lower() in item.location_details.lower() or item.location_details.lower() in location_details.lower())
            )
            cat_match = (item.category_id == category_id)

            if cat_match and loc_match:
                match_reasons.append("Matching category and location")
                if confidence == 'Low':
                    confidence = 'Medium'

            # Rule 3: High text similarity (> 0.45)
            if sim_score >= 0.45:
                match_reasons.append(f"Text similarity {int(sim_score * 100)}%")
                if sim_score >= 0.65 or confidence == 'Medium':
                    confidence = 'High'
                elif confidence == 'Low':
                    confidence = 'Medium'

            if match_reasons:
                matches.append({
                    'complaint': item,
                    'confidence': confidence,
                    'reasons': match_reasons,
                    'text_similarity': round(sim_score, 2),
                    'created_at': item.created_at
                })

        # Sort matches by High -> Medium -> Low, then by text similarity desc
        order = {'High': 3, 'Medium': 2, 'Low': 1}
        matches.sort(key=lambda m: (order.get(m['confidence'], 0), m['text_similarity']), reverse=True)
        return matches

    @classmethod
    def get_recurring_asset_alerts(cls, window_days=None, threshold=None):
        """
        Identifies community assets experiencing chronic or repetitive failures.
        Example: Elevator A with >= 3 complaints in 30 days.
        """
        if window_days is None:
            window_days = Config.RECURRING_WINDOW_DAYS
        if threshold is None:
            threshold = Config.RECURRING_ALERT_THRESHOLD

        cutoff_date = datetime.utcnow() - timedelta(days=window_days)
        assets = Asset.query.all()
        alerts = []

        for asset in assets:
            recent_complaints = Complaint.query.filter(
                Complaint.asset_id == asset.id,
                Complaint.created_at >= cutoff_date
            ).order_by(Complaint.created_at.desc()).all()

            count = len(recent_complaints)
            if count >= threshold:
                alerts.append({
                    'asset': asset,
                    'complaint_count': count,
                    'window_days': window_days,
                    'complaints': recent_complaints,
                    'criticality': asset.criticality,
                    'condition': asset.condition,
                    'risk_level': 'Critical' if count >= 5 or asset.criticality >= 4 else 'High',
                    'recommendation': 'Immediate scheduled overhaul and root-cause inspection advised.'
                })

        alerts.sort(key=lambda x: (x['complaint_count'], x['criticality']), reverse=True)
        return alerts
