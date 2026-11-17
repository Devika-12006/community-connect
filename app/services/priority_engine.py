from datetime import datetime, timedelta
from app.config import Config
from app.models.complaint import Complaint

class PriorityEngine:
    """
    Intelligent Priority Calculation Engine
    Formula: P = 7S + 5A + 4W + 4R
    Where:
        S = Severity (1-5)
        A = Asset Criticality (1-5)
        W = Work Impact (1-5)
        R = Recurrence (1-5)
    Theoretical Range:
        Min = 7(1) + 5(1) + 4(1) + 4(1) = 20
        Max = 7(5) + 5(5) + 4(5) + 4(5) = 100
    """

    WEIGHTS = Config.PRIORITY_WEIGHTS
    THRESHOLDS = Config.PRIORITY_THRESHOLDS

    @classmethod
    def calculate_recurrence_score(cls, asset_id=None, category_id=None, location=None, days=60):
        """
        Dynamically calculates recurrence score R (1 to 5) based on database history.
        Counts complaints on the same asset (or category in the same building/location)
        over the specified lookback window.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        recent_count = 0

        if asset_id:
            recent_count = Complaint.query.filter(
                Complaint.asset_id == asset_id,
                Complaint.created_at >= cutoff_date
            ).count()
        elif category_id and location:
            recent_count = Complaint.query.filter(
                Complaint.category_id == category_id,
                Complaint.location_details.ilike(f'%{location}%'),
                Complaint.created_at >= cutoff_date
            ).count()

        # Scale 1-5 mapping
        if recent_count == 0:
            return 1  # First occurrence
        elif recent_count == 1:
            return 2  # Repeat issue
        elif recent_count == 2:
            return 3  # Frequent issue
        elif 3 <= recent_count <= 4:
            return 4  # Chronic issue
        else:
            return 5  # Critical failure pattern

    @classmethod
    def compute_priority(cls, severity, asset_criticality, work_impact, recurrence_score):
        """
        Calculates P = 7S + 5A + 4W + 4R
        Ensures all inputs are clamped to the 1-5 scale.
        """
        s = max(1, min(5, int(severity)))
        a = max(1, min(5, int(asset_criticality)))
        w = max(1, min(5, int(work_impact)))
        r = max(1, min(5, int(recurrence_score)))

        p_score = (
            cls.WEIGHTS['severity'] * s +
            cls.WEIGHTS['criticality'] * a +
            cls.WEIGHTS['work_impact'] * w +
            cls.WEIGHTS['recurrence'] * r
        )

        p_level = cls.get_priority_level(p_score)

        return {
            'severity': s,
            'asset_criticality': a,
            'work_impact': w,
            'recurrence_score': r,
            'priority_score': p_score,
            'priority_level': p_level,
            'breakdown': {
                'severity_term': cls.WEIGHTS['severity'] * s,
                'criticality_term': cls.WEIGHTS['criticality'] * a,
                'work_impact_term': cls.WEIGHTS['work_impact'] * w,
                'recurrence_term': cls.WEIGHTS['recurrence'] * r
            }
        }

    @classmethod
    def get_priority_level(cls, score):
        if score >= cls.THRESHOLDS['Critical']:
            return 'Critical'
        elif score >= cls.THRESHOLDS['High']:
            return 'High'
        elif score >= cls.THRESHOLDS['Medium']:
            return 'Medium'
        else:
            return 'Low'

    @classmethod
    def get_explanation(cls, calculation_result, asset_name=None):
        """
        Generates an auditable, human-readable justification for the priority score.
        """
        s = calculation_result['severity']
        a = calculation_result['asset_criticality']
        w = calculation_result['work_impact']
        r = calculation_result['recurrence_score']
        score = calculation_result['priority_score']
        level = calculation_result['priority_level']
        b = calculation_result['breakdown']

        severity_desc = {
            1: "Minor / Cosmetic",
            2: "Low Functional Impact",
            3: "Moderate Inconvenience",
            4: "Major Disruption",
            5: "Safety Hazard / Emergency"
        }.get(s, "Standard")

        impact_desc = {
            1: "Single Apartment",
            2: "Multiple Flats / Corridor",
            3: "Wing / Entire Floor",
            4: "Entire Building Block",
            5: "Entire Community"
        }.get(w, "Standard")

        recurrence_desc = {
            1: "Isolated Event (0 recent incidents)",
            2: "Repeat Incident (1 recent incident)",
            3: "Frequent Fault (2 recent incidents)",
            4: "Chronic Failure (3-4 recent incidents)",
            5: "Systemic Reliability Hazard (5+ recent incidents)"
        }.get(r, "Standard")

        asset_info = f"linked to asset '{asset_name}' (Criticality: {a}/5)" if asset_name else f"with category criticality {a}/5"

        formula_text = (
            f"P = (7 × {s}) + (5 × {a}) + (4 × {w}) + (4 × {r}) = "
            f"{b['severity_term']} + {b['criticality_term']} + {b['work_impact_term']} + {b['recurrence_term']} = {score}"
        )

        rationale = (
            f"Evaluated as {level} Priority ({score}/100). The issue is classified as '{severity_desc}' (S={s}), "
            f"{asset_info}, impacting '{impact_desc}' (W={w}), with recurrence assessment '{recurrence_desc}' (R={r})."
        )

        return {
            'formula_expression': formula_text,
            'rationale': rationale,
            'details': {
                'severity_description': severity_desc,
                'impact_description': impact_desc,
                'recurrence_description': recurrence_desc
            }
        }
