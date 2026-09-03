"""Main Crawl Analyzer computing website health diagnostics and metrics."""

import json
from typing import List, Dict, Set, Union, Optional
from collections import defaultdict

from app.models.crawl import CrawlModel, PageModel
from app.schemas.crawl import CrawlResponse, PageResponse
from app.analysis.models import (
    DiagnosticsResponse,
    DiagnosticIssue,
    StatusDistribution,
    LinkStatistics,
    DepthStatistics,
    TitleStatistics,
)
from app.analysis.health_score import calculate_health_score


class CrawlAnalyzer:
    """Consumes crawl data and calculates comprehensive website health diagnostics."""

    @classmethod
    def analyze_model(cls, crawl_record: CrawlModel) -> DiagnosticsResponse:
        """Analyze a SQLAlchemy CrawlModel database record."""
        pages = crawl_record.pages
        errors = json.loads(crawl_record.errors_json) if crawl_record.errors_json else []
        return cls._run_analysis(
            crawl_id=crawl_record.id,
            starting_url=crawl_record.starting_url,
            domain=crawl_record.domain,
            total_pages=crawl_record.total_pages,
            successful_pages=crawl_record.successful_pages,
            failed_pages=crawl_record.failed_pages,
            raw_pages=pages,
            errors=errors,
        )

    @classmethod
    def analyze_response(cls, crawl_response: CrawlResponse) -> DiagnosticsResponse:
        """Analyze an in-memory CrawlResponse schema."""
        return cls._run_analysis(
            crawl_id=crawl_response.crawl_id,
            starting_url=crawl_response.starting_url,
            domain=crawl_response.domain,
            total_pages=crawl_response.total_pages,
            successful_pages=crawl_response.successful_pages,
            failed_pages=crawl_response.failed_pages,
            raw_pages=crawl_response.pages,
            errors=crawl_response.errors,
        )

    @classmethod
    def _run_analysis(
        cls,
        crawl_id: Optional[int],
        starting_url: str,
        domain: str,
        total_pages: int,
        successful_pages: int,
        failed_pages: int,
        raw_pages: List[Union[PageModel, PageResponse]],
        errors: List[str],
    ) -> DiagnosticsResponse:
        issues: List[DiagnosticIssue] = []

        # 1. Analyze HTTP status distributions
        c2xx = c3xx = c4xx = c5xx = c_other = 0
        exact_status: Dict[str, int] = defaultdict(int)

        crawled_url_map: Dict[str, Union[PageModel, PageResponse]] = {}
        all_referenced_internal: Set[str] = set()
        all_internal_links_list: List[str] = []
        all_external_links_list: List[str] = []

        depth_counts: Dict[str, int] = defaultdict(int)
        depth_sum = 0
        min_depth = 999
        max_depth = 0

        title_url_map: Dict[str, List[str]] = defaultdict(list)
        missing_title_urls: List[str] = []

        robots_blocked_count = 0

        for page in raw_pages:
            url = page.url
            norm_url = page.normalized_url
            crawled_url_map[norm_url] = page
            crawled_url_map[url] = page

            # HTTP Status Code classification
            code = page.status_code
            if code is None or not page.crawl_success:
                c_other += 1
                exact_status["ERR"] += 1
            else:
                exact_status[str(code)] += 1
                if 200 <= code < 300:
                    c2xx += 1
                elif 300 <= code < 400:
                    c3xx += 1
                elif 400 <= code < 500:
                    c4xx += 1
                elif 500 <= code < 600:
                    c5xx += 1
                else:
                    c_other += 1

            # Depth distribution
            d = page.depth if page.depth is not None else 0
            depth_counts[str(d)] += 1
            depth_sum += d
            if d < min_depth:
                min_depth = d
            if d > max_depth:
                max_depth = d

            # Title Analysis
            title = page.title
            if not title or not title.strip():
                missing_title_urls.append(url)
            else:
                clean_title = title.strip()
                title_url_map[clean_title].append(url)

            # Robots block detection
            if page.error_message and "robots" in page.error_message.lower():
                robots_blocked_count += 1

            # Extract internal & external link lists
            int_links = cls._extract_links(page, "internal_links")
            ext_links = cls._extract_links(page, "external_links")

            all_internal_links_list.extend(int_links)
            all_external_links_list.extend(ext_links)
            for il in int_links:
                all_referenced_internal.add(il)

        # Check errors list for robots blocks
        for err in errors:
            if "robots" in err.lower():
                robots_blocked_count += 1

        if not raw_pages:
            min_depth = 0

        status_dist = StatusDistribution(
            count_2xx=c2xx,
            count_3xx=c3xx,
            count_4xx=c4xx,
            count_5xx=c5xx,
            count_other=c_other,
            exact_status_counts=dict(exact_status),
        )

        # 2. Link Analysis
        unique_internal = set(all_internal_links_list)
        unique_external = set(all_external_links_list)

        verified_int_ok = 0
        verified_int_broken = 0
        unverified_int = 0

        for link in unique_internal:
            target_page = crawled_url_map.get(link)
            if target_page:
                if target_page.crawl_success and target_page.status_code and target_page.status_code < 400:
                    verified_int_ok += 1
                else:
                    verified_int_broken += 1
            else:
                unverified_int += 1

        link_stats = LinkStatistics(
            total_internal_links=len(all_internal_links_list),
            unique_internal_links=len(unique_internal),
            verified_internal_ok=verified_int_ok,
            verified_internal_broken=verified_int_broken,
            unverified_internal=unverified_int,
            total_external_links=len(all_external_links_list),
            unique_external_links=len(unique_external),
            unverified_external=len(unique_external),  # External links are not crawled by default
        )

        # 3. Depth Analysis
        avg_depth = round(depth_sum / len(raw_pages), 2) if raw_pages else 0.0
        depth_stats = DepthStatistics(
            min_depth=min_depth if min_depth != 999 else 0,
            max_depth_reached=max_depth,
            average_depth=avg_depth,
            depth_counts=dict(depth_counts),
        )

        # 4. Title Analysis
        dup_title_groups = {t: urls for t, urls in title_url_map.items() if len(urls) > 1}
        title_stats = TitleStatistics(
            total_with_title=len(raw_pages) - len(missing_title_urls),
            missing_title_count=len(missing_title_urls),
            duplicate_title_count=sum(len(urls) for urls in dup_title_groups.values()),
            missing_title_urls=missing_title_urls,
            duplicate_title_groups=dup_title_groups,
        )

        # 5. Potential Orphan Pages
        potential_orphan_urls: List[str] = []
        for page in raw_pages:
            # Root starting page is never an orphan
            if page.depth == 0 or page.url == starting_url or page.normalized_url == starting_url:
                continue

            is_referenced = (
                page.url in all_referenced_internal or page.normalized_url in all_referenced_internal
            )
            if not is_referenced:
                potential_orphan_urls.append(page.url)

        # 6. Generate Diagnostic Issues
        if c4xx > 0 or c5xx > 0 or c_other > 0:
            broken_count = c4xx + c5xx + c_other
            broken_samples = [p.url for p in raw_pages if not p.crawl_success or (p.status_code and p.status_code >= 400)][:5]
            issues.append(
                DiagnosticIssue(
                    severity="error",
                    category="HTTP Status",
                    message=f"{broken_count} page(s) failed or returned HTTP error status codes (4xx/5xx/ERR).",
                    affected_count=broken_count,
                    affected_urls=broken_samples,
                )
            )

        if missing_title_urls:
            issues.append(
                DiagnosticIssue(
                    severity="warning",
                    category="SEO Titles",
                    message=f"{len(missing_title_urls)} page(s) are missing HTML <title> elements.",
                    affected_count=len(missing_title_urls),
                    affected_urls=missing_title_urls[:5],
                )
            )

        if dup_title_groups:
            sample_dup_titles = list(dup_title_groups.keys())[:5]
            issues.append(
                DiagnosticIssue(
                    severity="warning",
                    category="SEO Titles",
                    message=f"{len(dup_title_groups)} group(s) of pages share duplicate HTML title tags.",
                    affected_count=len(dup_title_groups),
                    affected_urls=sample_dup_titles,
                )
            )

        if potential_orphan_urls:
            issues.append(
                DiagnosticIssue(
                    severity="warning",
                    category="Site Structure",
                    message=f"{len(potential_orphan_urls)} page(s) have no internal link references pointing to them.",
                    affected_count=len(potential_orphan_urls),
                    affected_urls=potential_orphan_urls[:5],
                )
            )

        if robots_blocked_count > 0:
            issues.append(
                DiagnosticIssue(
                    severity="warning",
                    category="Robots Policy",
                    message=f"{robots_blocked_count} URL(s) were blocked by robots.txt rules.",
                    affected_count=robots_blocked_count,
                    affected_urls=[],
                )
            )

        if unverified_int > 0:
            issues.append(
                DiagnosticIssue(
                    severity="info",
                    category="Crawl Limits",
                    message=f"{unverified_int} internal link(s) were discovered but unverified due to max depth or page limit boundaries.",
                    affected_count=unverified_int,
                    affected_urls=list(unique_internal - set(crawled_url_map.keys()))[:5],
                )
            )

        if len(unique_external) > 0:
            issues.append(
                DiagnosticIssue(
                    severity="info",
                    category="External References",
                    message=f"{len(unique_external)} external domain link(s) were discovered and left unverified by crawl policy.",
                    affected_count=len(unique_external),
                    affected_urls=list(unique_external)[:5],
                )
            )

        # 7. Calculate Health Score
        score, status_label, breakdown = calculate_health_score(
            failed_pages=c4xx + c5xx + c_other,
            missing_titles=len(missing_title_urls),
            duplicate_title_groups=len(dup_title_groups),
            potential_orphans=len(potential_orphan_urls),
            crawl_errors_count=len(errors) + robots_blocked_count,
        )

        return DiagnosticsResponse(
            crawl_id=crawl_id,
            starting_url=starting_url,
            domain=domain,
            health_score=score,
            health_status=status_label,
            total_pages=total_pages,
            successful_pages=successful_pages,
            failed_pages=failed_pages,
            score_breakdown=breakdown,
            status_distribution=status_dist,
            link_statistics=link_stats,
            depth_statistics=depth_stats,
            title_statistics=title_stats,
            potential_orphans_count=len(potential_orphan_urls),
            potential_orphan_urls=potential_orphan_urls,
            robots_blocked_count=robots_blocked_count,
            issues=issues,
        )

    @staticmethod
    def _extract_links(page: Union[PageModel, PageResponse], attr: str) -> List[str]:
        """Extract link list from either a PageModel or PageResponse."""
        if isinstance(page, PageResponse):
            return getattr(page, attr, [])
        else:
            json_attr = f"{attr}_json"
            val = getattr(page, json_attr, None)
            if val:
                try:
                    return json.loads(val)
                except Exception:
                    return []
            return []
