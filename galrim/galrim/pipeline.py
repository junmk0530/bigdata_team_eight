"""최신 기사를 모아 갈린 보도만 남긴다."""

import json
from datetime import datetime, timezone

from .cluster import cluster
from .collect import fetch_feeds
from .compose import compose
from .diverge import divergences
from .nouns import nouns
from .paths import LIVE


def build(articles: list[dict]) -> list[dict]:
    tokens = [nouns(f"{article['title']} {article.get('summary', '')}") for article in articles]
    items = []
    for group in cluster(articles, tokens):
        found = divergences(group)
        if not found:
            continue
        written = [compose(item, group["articles"]) | item for item in found]
        stamps = [article["publishedAt"] for article in group["articles"] if article.get("publishedAt")]
        items.append({
            "id": group["id"],
            "keywords": group["keywords"],
            "updatedAt": max(stamps) if stamps else "",
            "articles": group["articles"],
            "divergences": written,
        })
    items.sort(key=lambda item: item["updatedAt"], reverse=True)
    return items


def refresh() -> dict:
    articles, feeds = fetch_feeds()
    result = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "articleCount": len(articles),
        "feeds": feeds,
        "items": build(articles),
    }
    LIVE.parent.mkdir(parents=True, exist_ok=True)
    LIVE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def load() -> dict | None:
    if not LIVE.exists():
        return None
    return json.loads(LIVE.read_text(encoding="utf-8"))
