"""여러 매체의 최신 기사 RSS를 모은다. 실패한 피드는 건너뛴다."""

import hashlib
import html
import re
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

FEEDS = [
    "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/headlines/section/topic/NATION?hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko",
    "https://news.google.com/rss/headlines/section/topic/POLITICS?hl=ko&gl=KR&ceid=KR:ko",
    "https://www.yna.co.kr/rss/news.xml",
    "https://www.yna.co.kr/rss/society.xml",
    "https://www.yna.co.kr/rss/politics.xml",
    "https://www.yna.co.kr/rss/economy.xml",
    "https://www.khan.co.kr/rss/rssdata/total_news.xml",
]
FEED_SOURCE = {
    "yna.co.kr": "연합뉴스",
    "khan.co.kr": "경향신문",
}
TAG = re.compile(r"<[^>]+>")
DATELINE = re.compile(r"\([^)]{1,16}=([^)]{2,16})\)")


def _text(value: str | None) -> str:
    return " ".join(TAG.sub(" ", html.unescape(value or "")).split())


def resolve_source(title: str, summary: str, author: str, feed_url: str) -> tuple[str, str]:
    source = author.strip()
    if source and title.endswith(" - " + source):
        title = title[: -(len(source) + 3)].strip()
    if not source and " - " in title:
        title, source = title.rsplit(" - ", 1)
        title, source = title.strip(), source.strip()
    if not source:
        source = next((name for host, name in FEED_SOURCE.items() if host in feed_url), "")
    if not source:
        found = DATELINE.search(summary)
        source = found.group(1).strip() if found else ""
    return title, source or "출처 미상"


def _items(root: ET.Element):
    items = root.findall("./channel/item")
    if items:
        return items
    ns = {"a": "http://www.w3.org/2005/Atom"}
    return root.findall("a:entry", ns)


def fetch_feeds(limit_per_feed: int = 40) -> tuple[list[dict], list[dict]]:
    articles = []
    seen = set()
    reports = []
    for url in FEEDS:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "galrim/0.1"})
            with urllib.request.urlopen(request, timeout=15) as response:
                root = ET.fromstring(response.read())
        except Exception as error:
            reports.append({"url": url, "count": 0, "error": str(error)})
            continue
        count = 0
        for item in _items(root):
            title = _text(item.findtext("title"))
            summary = _text(item.findtext("description") or item.findtext("{http://www.w3.org/2005/Atom}summary"))
            source_node = item.find("source")
            author = _text(source_node.text if source_node is not None else item.findtext("author"))
            title, source = resolve_source(title, summary, author, url)
            key = title.casefold()
            if not title or key in seen:
                continue
            seen.add(key)
            published = item.findtext("pubDate") or item.findtext("{http://www.w3.org/2005/Atom}updated") or ""
            try:
                published_at = parsedate_to_datetime(published).isoformat()
            except (TypeError, ValueError, IndexError):
                published_at = ""
            articles.append({
                "id": hashlib.sha256(key.encode("utf-8")).hexdigest()[:12],
                "title": title,
                "summary": summary,
                "source": source or "출처 미상",
                "publishedAt": published_at,
                "url": _text(item.findtext("link")),
            })
            count += 1
            if count >= limit_per_feed:
                break
        reports.append({"url": url, "count": count, "error": ""})
    return articles, reports
