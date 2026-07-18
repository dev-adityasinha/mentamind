"""Server-side scoring for psychological assessments.

Encodes the same published scoring rules and severity bands that the frontend
questionnaire JSON uses, so a client can post either a pre-computed score or the
raw per-item answers and the server derives an authoritative score, severity,
insights and next steps.

Supported instruments (test_id -> rule):
- phq-9  : PHQ-9 depression, sum of 9 items (0-3), max 27.
- gad-7  : GAD-7 anxiety, sum of 7 items (0-3), max 21.
- pss-10 : Perceived Stress Scale, 10 items (0-4) with items 4,5,7,8 reverse
           scored (reverseMax 4), max 40.
- burnout: Maslach-style 22 items (0-6) across three subscales
           (Emotional Exhaustion, Depersonalization, Personal Accomplishment).

All thresholds mirror apps/web/src/lib/screening/data/*.json.
"""

from __future__ import annotations

# PSS-10 items that are reverse scored (1-indexed), and the reverse max.
_PSS10_REVERSE_ITEMS = {4, 5, 7, 8}
_PSS10_REVERSE_MAX = 4

# Burnout subscale item ranges (1-indexed, inclusive) matching burnout.json.
_BURNOUT_EE_ITEMS = range(1, 10)  # items 1-9
_BURNOUT_DP_ITEMS = range(10, 15)  # items 10-14
_BURNOUT_PA_ITEMS = range(15, 23)  # items 15-22


def _score_phq9(answers: list[int]) -> dict:
    score = sum(answers)
    if score >= 20:
        severity = "Severe"
        insights = "Your score indicates severe symptoms of depression."
        next_steps = "We strongly recommend seeking professional clinical support."
    elif score >= 15:
        severity = "Moderately Severe"
        insights = "Your score indicates moderately severe symptoms of depression."
        next_steps = (
            "Consider reaching out to a therapist or using our AI coach for "
            "guided reflection."
        )
    elif score >= 10:
        severity = "Moderate"
        insights = "Your score indicates moderate symptoms of depression."
        next_steps = (
            "Regular check-ins and talking to the AI coach can help manage "
            "these feelings."
        )
    elif score >= 5:
        severity = "Mild"
        insights = "Your score indicates mild symptoms of depression."
        next_steps = "Try our mindfulness exercises and daily journaling."
    else:
        severity = "Minimal"
        insights = "Your score indicates minimal or no symptoms of depression."
        next_steps = "Keep up the good habits!"
    return {
        "score": score,
        "severity": severity,
        "insights": insights,
        "next_steps": next_steps,
    }


def _score_gad7(answers: list[int]) -> dict:
    score = sum(answers)
    if score >= 15:
        severity = "Severe"
        insights = "Your score indicates severe anxiety symptoms."
        next_steps = "We strongly recommend seeking professional clinical support."
    elif score >= 10:
        severity = "Moderate"
        insights = "Your score indicates moderate anxiety symptoms."
        next_steps = (
            "Consider reaching out to a therapist or trying our guided "
            "meditations for anxiety."
        )
    elif score >= 5:
        severity = "Mild"
        insights = "Your score indicates mild anxiety symptoms."
        next_steps = "Try our deep breathing exercises and stress-relief resources."
    else:
        severity = "Minimal"
        insights = "Your score indicates minimal anxiety symptoms."
        next_steps = "Keep up the good habits!"
    return {
        "score": score,
        "severity": severity,
        "insights": insights,
        "next_steps": next_steps,
    }


def _score_pss10(answers: list[int]) -> dict:
    """Perceived Stress Scale: reverse-score items 4,5,7,8, then sum. Max 40."""
    total = 0
    for idx, value in enumerate(answers, start=1):
        if idx in _PSS10_REVERSE_ITEMS:
            total += _PSS10_REVERSE_MAX - value
        else:
            total += value

    if total >= 27:
        severity = "High stress"
        insights = "Your score indicates a high level of perceived stress."
        next_steps = (
            "Prioritise stress-relief: try our stress-relief meditations, paced "
            "breathing, and consider speaking with a professional."
        )
    elif total >= 14:
        severity = "Moderate stress"
        insights = "Your score indicates a moderate level of perceived stress."
        next_steps = (
            "Build regular relaxation into your week — meditation, journaling, "
            "and mood check-ins can help."
        )
    else:
        severity = "Low stress"
        insights = "Your score indicates a low level of perceived stress."
        next_steps = "You're managing stress well — keep up your healthy habits!"
    return {
        "score": total,
        "severity": severity,
        "insights": insights,
        "next_steps": next_steps,
    }


def _score_burnout(answers: list[int]) -> dict:
    """Maslach-style burnout across three subscales.

    Overall severity is driven by Emotional Exhaustion (the primary burnout
    dimension), consistent with the frontend interpretation bands.
    """
    ee = sum(answers[i - 1] for i in _BURNOUT_EE_ITEMS if i - 1 < len(answers))
    dp = sum(answers[i - 1] for i in _BURNOUT_DP_ITEMS if i - 1 < len(answers))
    pa = sum(answers[i - 1] for i in _BURNOUT_PA_ITEMS if i - 1 < len(answers))

    # Emotional Exhaustion bands (0-16 low, 17-26 moderate, 27-54 high).
    if ee >= 27:
        severity = "High"
        insights = "Your emotional-exhaustion score is high, a key sign of burnout."
        next_steps = (
            "Consider talking to a professional, and use our stress-relief and "
            "sleep resources to help you recover."
        )
    elif ee >= 17:
        severity = "Moderate"
        insights = "Your emotional-exhaustion score is in the moderate range."
        next_steps = (
            "Protect your recovery time — regular meditation, breaks, and mood "
            "tracking can help before this escalates."
        )
    else:
        severity = "Low"
        insights = "Your burnout indicators are currently low."
        next_steps = "Keep maintaining your work-life balance and healthy routines."

    # Overall reported score is the sum across all items (max 84), matching the
    # burnout.json maxScore, with subscale detail in metadata for reports.
    total = ee + dp + pa
    return {
        "score": total,
        "severity": severity,
        "insights": insights,
        "next_steps": next_steps,
        "subscales": {
            "emotional_exhaustion": ee,
            "depersonalization": dp,
            "personal_accomplishment": pa,
        },
    }


_SCORERS = {
    "phq-9": _score_phq9,
    "gad-7": _score_gad7,
    "pss-10": _score_pss10,
    "pss": _score_pss10,
    "stress": _score_pss10,
    "burnout": _score_burnout,
}


def calculate_screening(test_id: str, answers: list[int]) -> dict:
    """Score an assessment from raw answers.

    Falls back to a plain sum with a generic message for any unrecognised
    instrument, so unknown test ids never crash.
    """
    scorer = _SCORERS.get(test_id.lower())
    if scorer is not None:
        return scorer(answers)

    return {
        "score": sum(answers),
        "severity": "Completed",
        "insights": "Assessment completed.",
        "next_steps": "Review your results with a professional if you have concerns.",
    }
