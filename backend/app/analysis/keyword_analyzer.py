"""SEO Keyword Mapping and Topic Clustering Engine for WebAtlas.

Uses deterministic NLP techniques (n-gram extraction, weighted TF-IDF, stopword filtering,
and cosine/Jaccard similarity matrix clustering) to map keywords and group pages without LLMs.
"""

import math
import re
from collections import Counter, defaultdict
from typing import Dict, List, Optional, Set, Tuple, Any

# Generic Web & English Stopwords
GENERIC_STOPWORDS: Set[str] = {
    # Standard English Stopwords
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can",
    "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't",
    "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
    "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him",
    "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't",
    "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor",
    "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
    "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
    "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to",
    "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were",
    "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's",
    "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're",
    "you've", "your", "yours", "yourself", "yourselves",
    # Generic Web / UI / Navigation Terms
    "page", "home", "website", "site", "click", "read", "learn", "contact", "login", "menu", "privacy",
    "terms", "copyright", "rights", "reserved", "view", "see", "browse", "www", "http", "https", "index",
    "html", "php", "asp", "com", "net", "org", "welcome", "email", "phone", "support", "info", "search",
    "find", "back", "next", "top", "bottom", "submit", "sign", "user", "password", "account", "portal",
    "loading", "error", "icon", "image", "photo", "img", "png", "jpg", "gif", "pdf", "css", "js", "share",
    "follow", "twitter", "facebook", "linkedin", "github", "instagram", "youtube", "media", "post", "blog",
    "article", "news", "updates", "details", "main", "body", "content", "link", "here", "more", "get",
    "started", "navigation", "toggle", "skip", "close", "open", "all", "rights", "reserved", "cookie",
    "policy", "disclaimer", "sitemap", "feed", "rss", "us", "about us", "contact us", "faq", "faqs",
}


def normalize_text(text: str) -> str:
    """Clean and normalize raw text for NLP processing."""
    if not text:
        return ""
    # Lowercase & replace hyphens/underscores with space
    cleaned = text.lower().replace("-", " ").replace("_", " ")
    # Remove non-alphanumeric chars except whitespace
    cleaned = re.sub(r"[^\w\s]", "", cleaned)
    # Collapse multiple whitespaces
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_url_keywords(url: str) -> List[str]:
    """Extract relevant word tokens from URL path."""
    if not url:
        return []
    # Parse path component
    path = url.split("://")[-1].split("/", 1)[-1].split("?")[0].split("#")[0]
    tokens = re.split(r"[/\-_.]", path.lower())
    result = []
    for token in tokens:
        cleaned = re.sub(r"[^\w]", "", token)
        if len(cleaned) > 2 and cleaned not in GENERIC_STOPWORDS and not cleaned.isdigit():
            result.append(cleaned)
    return result


def extract_ngrams(text: str, max_n: int = 3) -> List[str]:
    """Extract 1-gram, 2-gram, and 3-gram phrase candidates from normalized text."""
    words = [w for w in normalize_text(text).split() if len(w) > 1]
    if not words:
        return []

    ngrams = []
    # Unigrams (only if non-stopword)
    for word in words:
        if word not in GENERIC_STOPWORDS and not word.isdigit() and len(word) > 2:
            ngrams.append(word)

    # Bigrams & Trigrams
    for n in range(2, max_n + 1):
        for i in range(len(words) - n + 1):
            ngram_tokens = words[i : i + n]
            # Ensure at least one significant non-stopword and first/last aren't stopwords
            if ngram_tokens[0] in GENERIC_STOPWORDS or ngram_tokens[-1] in GENERIC_STOPWORDS:
                continue
            if all(t in GENERIC_STOPWORDS for t in ngram_tokens):
                continue
            phrase = " ".join(ngram_tokens)
            if len(phrase) > 3:
                ngrams.append(phrase)

    return ngrams


class KeywordExtractor:
    """Deterministic NLP Keyword Extractor using weighted n-gram frequency analysis."""

    @classmethod
    def analyze_page(
        cls,
        url: str,
        title: Optional[str] = None,
        meta_description: Optional[str] = None,
        h1: Optional[str] = None,
        headings: Optional[List[str]] = None,
        main_text: Optional[str] = None,
        inbound_anchor_texts: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Extract primary keyword, related keywords, score, and topic for a single HTML page."""
        headings = headings or []
        inbound_anchor_texts = inbound_anchor_texts or []

        candidate_scores: Dict[str, float] = defaultdict(float)

        # 1. Weight 3.5x: Title tag n-grams
        if title:
            for phrase in extract_ngrams(title):
                boost = 1.3 if " " in phrase else 1.0
                candidate_scores[phrase] += 3.5 * boost

        # 2. Weight 2.5x: H1 tag & Meta description n-grams
        if h1:
            for phrase in extract_ngrams(h1):
                boost = 1.3 if " " in phrase else 1.0
                candidate_scores[phrase] += 2.5 * boost

        if meta_description:
            for phrase in extract_ngrams(meta_description):
                boost = 1.2 if " " in phrase else 1.0
                candidate_scores[phrase] += 2.2 * boost

        # 3. Weight 1.8x: H2/H3 Headings n-grams
        for h in headings:
            for phrase in extract_ngrams(h):
                candidate_scores[phrase] += 1.8

        # 4. Weight 1.5x: URL path tokens & Inbound anchor texts
        url_kw = extract_url_keywords(url)
        for token in url_kw:
            candidate_scores[token] += 1.5
        if len(url_kw) >= 2:
            url_bigram = " ".join(url_kw[:2])
            candidate_scores[url_bigram] += 2.0

        for anchor in inbound_anchor_texts:
            for phrase in extract_ngrams(anchor):
                candidate_scores[phrase] += 1.5

        # 5. Weight 1.0x: Visible main text body TF-IDF frequency
        if main_text:
            text_ngrams = extract_ngrams(main_text)
            counts = Counter(text_ngrams)
            for phrase, count in counts.most_common(50):
                tf_score = math.log1p(count)
                boost = 1.2 if " " in phrase else 1.0
                candidate_scores[phrase] += 1.0 * tf_score * boost

        # Filter out candidates with low score or invalid format
        valid_candidates: List[Tuple[str, float]] = []
        for phrase, score in candidate_scores.items():
            norm_p = normalize_text(phrase)
            if not norm_p or norm_p in GENERIC_STOPWORDS or len(norm_p) < 3:
                continue
            words = norm_p.split()
            if all(w.isdigit() or len(w) <= 1 for w in words):
                continue
            valid_candidates.append((norm_p.title(), round(score, 2)))

        # Sort candidates descending by score
        valid_candidates.sort(key=lambda x: x[1], reverse=True)

        if not valid_candidates:
            # Fallback when page content is minimal / empty
            url_tokens = extract_url_keywords(url)
            fallback_primary = " ".join(url_tokens).title() if url_tokens else "General Page"
            return {
                "primary_keyword": fallback_primary,
                "related_keywords": [],
                "keyword_score": 1.0,
                "topic": "General",
                "cluster_id": "cluster_general",
            }

        primary_kw, top_score = valid_candidates[0]

        # Select top 2-5 distinct related keywords
        related_kws: List[str] = []
        seen = {primary_kw.lower()}
        for kw, _ in valid_candidates[1:]:
            kw_lower = kw.lower()
            if kw_lower not in seen and not any(kw_lower in s or s in kw_lower for s in seen if len(s) > 4):
                seen.add(kw_lower)
                related_kws.append(kw)
                if len(related_kws) >= 5:
                    break

        # Generate broad topic string from primary keyword or H1/title
        topic = cls._derive_topic(primary_kw, h1, title, url)

        return {
            "primary_keyword": primary_kw,
            "related_keywords": related_kws,
            "keyword_score": top_score,
            "topic": topic,
            "cluster_id": None,
        }

    @classmethod
    def _derive_topic(cls, primary_kw: str, h1: Optional[str], title: Optional[str], url: str) -> str:
        """Derive readable topic label from top text signals."""
        words = primary_kw.split()
        if len(words) >= 2:
            return primary_kw
        if h1:
            h1_norm = normalize_text(h1)
            if h1_norm and len(h1_norm.split()) <= 4:
                return h1_norm.title()
        if title:
            clean_title = re.split(r"[|\-:]", title)[0].strip()
            if clean_title and len(clean_title) <= 30:
                return clean_title.title()
        return primary_kw


class TopicClusterer:
    """Deterministic Topic Clustering algorithm grouping pages by keyword vector similarity."""

    @classmethod
    def cluster_pages(cls, pages_data: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Cluster a list of page dicts with extracted keywords into topic clusters.
        
        Returns:
            Tuple of (updated_pages_data_list, clusters_summary_list)
        """
        if not pages_data:
            return [], []

        # 1. Build keyword set representation for each page
        page_vectors: List[Set[str]] = []
        for page in pages_data:
            kws = set()
            p_kw = page.get("primary_keyword")
            if p_kw:
                kws.add(normalize_text(p_kw))
                kws.update(normalize_text(p_kw).split())
            for r_kw in page.get("related_keywords", []):
                kws.add(normalize_text(r_kw))
                kws.update(normalize_text(r_kw).split())
            topic = page.get("topic")
            if topic:
                kws.add(normalize_text(topic))
            page_vectors.append(kws)

        num_pages = len(pages_data)
        assignments = [-1] * num_pages
        cluster_counter = 1
        clusters_map: Dict[int, List[int]] = defaultdict(list)

        # 2. Greedy graph-based clustering using Jaccard & keyword overlap
        for i in range(num_pages):
            if assignments[i] != -1:
                continue

            current_cluster_id = cluster_counter
            cluster_counter += 1
            assignments[i] = current_cluster_id
            clusters_map[current_cluster_id].append(i)

            vec_i = page_vectors[i]
            if not vec_i:
                continue

            for j in range(i + 1, num_pages):
                if assignments[j] != -1:
                    continue
                vec_j = page_vectors[j]
                if not vec_j:
                    continue

                # Compute Jaccard overlap similarity between keyword sets
                intersection = vec_i.intersection(vec_j)
                union = vec_i.union(vec_j)
                similarity = len(intersection) / len(union) if union else 0.0

                p_i = (pages_data[i].get("primary_keyword") or "").lower()
                p_j = (pages_data[j].get("primary_keyword") or "").lower()
                t_i = (pages_data[i].get("topic") or "").lower()
                t_j = (pages_data[j].get("topic") or "").lower()

                same_primary = bool(p_i and p_i == p_j)
                same_topic = bool(t_i and t_i == t_j)

                if similarity >= 0.22 or same_primary or same_topic:
                    assignments[j] = current_cluster_id
                    clusters_map[current_cluster_id].append(j)

        # 3. Format cluster summaries and assign cluster_id to pages
        clusters_summary: List[Dict[str, Any]] = []

        for cid, page_indices in clusters_map.items():
            cluster_key = f"cluster_{cid}"
            cluster_pages = [pages_data[idx] for idx in page_indices]

            kw_counts: Counter = Counter()
            topic_counts: Counter = Counter()

            for p in cluster_pages:
                p["cluster_id"] = cluster_key
                if p.get("primary_keyword"):
                    kw_counts[p["primary_keyword"]] += 2
                for rkw in p.get("related_keywords", []):
                    kw_counts[rkw] += 1
                if p.get("topic"):
                    topic_counts[p["topic"]] += 1

            most_common_kw = kw_counts.most_common(1)[0][0] if kw_counts else "General Cluster"
            most_common_topic = topic_counts.most_common(1)[0][0] if topic_counts else most_common_kw

            cluster_name = f"{most_common_kw} Cluster" if not most_common_kw.lower().endswith("cluster") else most_common_kw
            cluster_keywords = [kw for kw, _ in kw_counts.most_common(6)]

            for p in cluster_pages:
                p["cluster_name"] = cluster_name

            clusters_summary.append({
                "cluster_id": cluster_key,
                "cluster_name": cluster_name,
                "cluster_primary_topic": most_common_topic,
                "keywords": cluster_keywords,
                "page_count": len(cluster_pages),
                "pages": [
                    {
                        "url": p.get("url"),
                        "title": p.get("title"),
                        "primary_keyword": p.get("primary_keyword"),
                        "topic": p.get("topic"),
                    }
                    for p in cluster_pages
                ],
            })

        return pages_data, clusters_summary
