"""Pure equal-weight score calculations, with decimal arithmetic."""

from decimal import Decimal, InvalidOperation

from .constants import CRITERIA


def validated_scores(scores):
    if not isinstance(scores, dict) or set(scores) != set(CRITERIA):
        raise ValueError("Five scores are required")
    result = {}
    for criterion in CRITERIA:
        raw = scores[criterion]
        if isinstance(raw, bool) or not isinstance(raw, (int, float, Decimal)):
            raise ValueError("Numeric scores are required")
        try:
            value = Decimal(str(raw))
            if not value.is_finite() or value not in {
                Decimal(n) / 2 for n in range(2, 11)
            }:
                raise ValueError("Scores must be 1–5 in half-star steps")
        except InvalidOperation as exc:
            raise ValueError("Invalid score") from exc
        result[criterion] = value
    return result


def overall_score(scores):
    values = validated_scores(scores)
    return float(sum(values.values(), Decimal(0)) / 5)


def club_averages(reviews):
    rows = [validated_scores(scores) for scores in reviews]
    if not rows:
        return None
    means = {
        criterion: sum((row[criterion] for row in rows), Decimal(0)) / len(rows)
        for criterion in CRITERIA
    }
    return {
        "reviewCount": len(rows),
        "overallMean": float(sum(means.values(), Decimal(0)) / 5),
        "criterionMeans": {
            criterion: float(value) for criterion, value in means.items()
        },
    }
