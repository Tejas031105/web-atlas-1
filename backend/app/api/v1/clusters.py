"""API Router for Keyword Mapping & Topic Clusters Endpoints."""

import json
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import crawl_persistence
from app.schemas.keywords import (
    CrawlKeywordsResponse,
    ClusterSummaryResponse,
    ClusterDetail,
    ClusterPageItem,
    PageKeywordSummary,
)
from app.schemas.crawl import CrawlErrorResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crawls", tags=["SEO Keywords & Topic Clusters"])


@router.get(
    "/{crawl_id}/keywords",
    response_model=CrawlKeywordsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Extracted SEO Keywords for Crawl Session",
    description="Returns primary keywords, related keywords, keyword scores, and topics for all pages in a crawl.",
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record not found"},
    },
)
async def get_crawl_keywords(
    crawl_id: int, db: Session = Depends(get_db)
) -> CrawlKeywordsResponse:
    """Retrieve primary & secondary keyword mapping for all crawled pages."""
    record = crawl_persistence.get_crawl_by_id(db, crawl_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    cluster_map = {c.cluster_id: c.cluster_name for c in record.clusters} if record.clusters else {}

    keywords_list: List[PageKeywordSummary] = []
    for p in record.pages:
        rel_kws = json.loads(p.related_keywords_json) if p.related_keywords_json else []
        c_name = cluster_map.get(p.cluster_id) if p.cluster_id else None
        keywords_list.append(
            PageKeywordSummary(
                url=p.url,
                title=p.title,
                primary_keyword=p.primary_keyword,
                related_keywords=rel_kws,
                keyword_score=p.keyword_score,
                topic=p.topic,
                cluster_id=p.cluster_id,
                cluster_name=c_name,
            )
        )

    return CrawlKeywordsResponse(
        crawl_id=record.id,
        starting_url=record.starting_url,
        domain=record.domain,
        total_pages_analyzed=len(keywords_list),
        keywords=keywords_list,
    )


@router.get(
    "/{crawl_id}/clusters",
    response_model=ClusterSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Topic Clusters for Crawl Session",
    description="Returns all topic clusters, cluster keywords, and assigned pages for a crawl.",
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record not found"},
    },
)
async def get_crawl_clusters(
    crawl_id: int, db: Session = Depends(get_db)
) -> ClusterSummaryResponse:
    """Retrieve all topic clusters and page groupings for a crawl session."""
    record = crawl_persistence.get_crawl_by_id(db, crawl_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    pages_by_cluster = {}
    for p in record.pages:
        cid = p.cluster_id or "cluster_general"
        if cid not in pages_by_cluster:
            pages_by_cluster[cid] = []
        pages_by_cluster[cid].append(
            ClusterPageItem(
                url=p.url,
                title=p.title,
                primary_keyword=p.primary_keyword,
                topic=p.topic,
            )
        )

    cluster_details: List[ClusterDetail] = []
    for c in record.clusters:
        kws = json.loads(c.keywords_json) if c.keywords_json else []
        c_pages = pages_by_cluster.get(c.cluster_id, [])
        cluster_details.append(
            ClusterDetail(
                cluster_id=c.cluster_id,
                cluster_name=c.cluster_name,
                cluster_primary_topic=c.cluster_primary_topic,
                keywords=kws,
                page_count=c.page_count or len(c_pages),
                pages=c_pages,
            )
        )

    return ClusterSummaryResponse(
        crawl_id=record.id,
        starting_url=record.starting_url,
        domain=record.domain,
        total_pages_analyzed=len(record.pages),
        total_clusters=len(cluster_details),
        clusters=cluster_details,
    )


@router.get(
    "/{crawl_id}/clusters/{cluster_id}",
    response_model=ClusterDetail,
    status_code=status.HTTP_200_OK,
    summary="Get Detailed Topic Cluster",
    description="Returns detailed info and member pages for a specific topic cluster.",
    responses={
        404: {"model": CrawlErrorResponse, "description": "Crawl record or Cluster ID not found"},
    },
)
async def get_cluster_by_id(
    crawl_id: int, cluster_id: str, db: Session = Depends(get_db)
) -> ClusterDetail:
    """Retrieve a single topic cluster detail by cluster_id."""
    record = crawl_persistence.get_crawl_by_id(db, crawl_id)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crawl record with ID #{crawl_id} not found.",
        )

    target_cluster = next((c for c in record.clusters if c.cluster_id == cluster_id), None)

    member_pages = [
        ClusterPageItem(
            url=p.url,
            title=p.title,
            primary_keyword=p.primary_keyword,
            topic=p.topic,
        )
        for p in record.pages
        if p.cluster_id == cluster_id
    ]

    if not target_cluster and not member_pages:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cluster with ID '{cluster_id}' not found in crawl #{crawl_id}.",
        )

    kws = json.loads(target_cluster.keywords_json) if target_cluster and target_cluster.keywords_json else []
    c_name = target_cluster.cluster_name if target_cluster else f"{cluster_id.title()} Cluster"
    c_topic = target_cluster.cluster_primary_topic if target_cluster else "General"

    return ClusterDetail(
        cluster_id=cluster_id,
        cluster_name=c_name,
        cluster_primary_topic=c_topic,
        keywords=kws,
        page_count=len(member_pages),
        pages=member_pages,
    )
