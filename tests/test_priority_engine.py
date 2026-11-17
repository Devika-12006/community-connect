from app.services.priority_engine import PriorityEngine

def test_priority_calculation_critical():
    # S=5, A=5, W=4, R=3 -> 7*5 + 5*5 + 4*4 + 4*3 = 35 + 25 + 16 + 12 = 88
    res = PriorityEngine.compute_priority(severity=5, asset_criticality=5, work_impact=4, recurrence_score=3)
    assert res['priority_score'] == 88
    assert res['priority_level'] == 'Critical'
    assert res['breakdown']['severity_term'] == 35
    assert res['breakdown']['criticality_term'] == 25
    assert res['breakdown']['work_impact_term'] == 16
    assert res['breakdown']['recurrence_term'] == 12

def test_priority_calculation_high():
    # S=4, A=4, W=3, R=1 -> 7*4 + 5*4 + 4*3 + 4*1 = 28 + 20 + 12 + 4 = 64
    res = PriorityEngine.compute_priority(severity=4, asset_criticality=4, work_impact=3, recurrence_score=1)
    assert res['priority_score'] == 64
    assert res['priority_level'] == 'High'

def test_priority_calculation_medium():
    # S=3, A=3, W=2, R=1 -> 7*3 + 5*3 + 4*2 + 4*1 = 21 + 15 + 8 + 4 = 48
    res = PriorityEngine.compute_priority(severity=3, asset_criticality=3, work_impact=2, recurrence_score=1)
    assert res['priority_score'] == 48
    assert res['priority_level'] == 'Medium'

def test_priority_calculation_low():
    # S=1, A=1, W=1, R=1 -> 7*1 + 5*1 + 4*1 + 4*1 = 7 + 5 + 4 + 4 = 20 (Min possible)
    res = PriorityEngine.compute_priority(severity=1, asset_criticality=1, work_impact=1, recurrence_score=1)
    assert res['priority_score'] == 20
    assert res['priority_level'] == 'Low'

def test_clamping_out_of_bounds():
    # S=10, A=0, W=-5, R=99 -> Clamped to S=5, A=1, W=1, R=5 -> 7*5 + 5*1 + 4*1 + 4*5 = 35 + 5 + 4 + 20 = 64
    res = PriorityEngine.compute_priority(severity=10, asset_criticality=0, work_impact=-5, recurrence_score=99)
    assert res['severity'] == 5
    assert res['asset_criticality'] == 1
    assert res['work_impact'] == 1
    assert res['recurrence_score'] == 5
    assert res['priority_score'] == 64

def test_explanation_generation():
    calc = PriorityEngine.compute_priority(5, 5, 4, 3)
    explanation = PriorityEngine.get_explanation(calc, "Passenger Elevator A1")
    assert "Critical Priority" in explanation['rationale']
    assert "Passenger Elevator A1" in explanation['rationale']
    assert 'formula_expression' in explanation
