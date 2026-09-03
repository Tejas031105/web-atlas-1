"""Deterministic Health Score Calculator for WebAtlas Crawl Analysis."""

from typing import List, Tuple, Literal
from app.analysis.models import ScoreDeduction


def calculate_health_score(
    failed_pages: int,
    missing_titles: int,
    duplicate_title_groups: int,
    potential_orphans: int,
    crawl_errors_count: int,
) -> Tuple[int, Literal["Excellent", "Good", "Needs Attention", "Poor"], List[ScoreDeduction]]:
    """
    Calculate a deterministic health score (0-100) and deduction breakdown.
    
    Starting Score: 100
    - Broken/Failed Pages: -10 per page (max -40)
    - Missing Page Titles: -3 per page (max -15)
    - Duplicate Page Titles: -2 per group (max -10)
    - Potential Orphan Pages: -2 per page (max -10)
    - Crawl Errors & Blocks: -2 per error (max -10)
    """
    score = 100
    breakdown: List[ScoreDeduction] = []

    # 1. Broken / Failed pages deduction
    if failed_pages > 0:
        deduction = min(40, failed_pages * 10)
        score -= deduction
        breakdown.append(
            ScoreDeduction(
                reason=f"{failed_pages} failed/broken page(s) (HTTP 4xx/5xx/ERR)",
                deduction=deduction,
            )
        )

    # 2. Missing titles deduction
    if missing_titles > 0:
        deduction = min(15, missing_titles * 3)
        score -= deduction
        breakdown.append(
            ScoreDeduction(
                reason=f"{missing_titles} page(s) missing HTML titles",
                deduction=deduction,
            )
        )

    # 3. Duplicate titles deduction
    if duplicate_title_groups > 0:
        deduction = min(10, duplicate_title_groups * 2)
        score -= deduction
        breakdown.append(
            ScoreDeduction(
                reason=f"{duplicate_title_groups} group(s) of duplicate HTML page titles",
                deduction=deduction,
            )
        )

    # 4. Potential orphan pages deduction
    if potential_orphans > 0:
        deduction = min(10, potential_orphans * 2)
        score -= deduction
        breakdown.append(
            ScoreDeduction(
                reason=f"{potential_orphans} potential orphan page(s) (no internal references)",
                deduction=deduction,
            )
        )

    # 5. Crawl errors / blocks deduction
    if crawl_errors_count > 0:
        deduction = min(10, crawl_errors_count * 2)
        score -= deduction
        breakdown.append(
            ScoreDeduction(
                reason=f"{crawl_errors_count} crawl error(s) or blocked request(s)",
                deduction=deduction,
            )
        )

    # Clamp score between 0 and 100
    final_score = max(0, min(100, score))

    # Map score to human-readable health status label
    if final_score >= 90:
        status: Literal["Excellent", "Good", "Needs Attention", "Poor"] = "Excellent"
    elif final_score >= 75:
        status = "Good"
    elif final_score >= 50:
        status = "Needs Attention"
    else:
        status = "Poor"

    return final_score, status, breakdown
