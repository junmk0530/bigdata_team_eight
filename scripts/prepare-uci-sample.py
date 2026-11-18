"""UCI News Aggregator에서 같은 사건의 여러 매체 제목을 샘플링한다.

원본 zip은 저장소에 넣지 않는다. 아래 주소에서 받아 work/raw/news-aggregator.zip에 둔다.
https://archive.ics.uci.edu/static/public/359/news+aggregator.zip
"""
import csv
import io
import json
import random
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / "work" / "raw" / "news-aggregator.zip"
SEED = 20261118
EVAL_TARGET = 1500
WEB_TARGET = 480
CATEGORIES = {"b": "Business", "t": "Tech", "e": "Entertainment", "m": "Health"}

def load_stories():
    stories = defaultdict(list)
    with zipfile.ZipFile(ZIP).open("newsCorpora.csv") as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8", errors="replace", newline="")
        for row in csv.reader(text, delimiter="\t"):
            if len(row) < 8:
                continue
            _id, title, url, publisher, category, story, host, timestamp = row[:8]
            title = " ".join(title.split())
            if not title or category not in CATEGORIES:
                continue
            if not (url.startswith("http://") or url.startswith("https://")):
                url = ""
            try:
                date = datetime.fromtimestamp(int(timestamp) / 1000, timezone.utc).date().isoformat()
            except (ValueError, OSError):
                date = ""
            stories[story].append({
                "title": title,
                "source": (publisher or host or "출처 미상").strip()[:200] or "출처 미상",
                "category": CATEGORIES[category],
                "date": date,
                "url": url,
                "story": story,
            })
    return stories

def unique_groups(stories):
    groups = []
    for story, items in stories.items():
        seen = set()
        unique = []
        for item in items:
            key = (item["title"].casefold(), item["source"].casefold())
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)
        if len(unique) >= 2:
            groups.append(unique[:6])
    return groups

def take(groups, target):
    picked = []
    used = []
    for group in groups:
        if len(picked) >= target:
            break
        chunk = group[: target - len(picked)]
        picked.extend(chunk)
        used.append(chunk)
    return picked, used

def main():
    if not ZIP.exists():
        raise SystemExit(f"원본 zip이 없습니다: {ZIP}")
    random.seed(SEED)
    groups = unique_groups(load_stories())
    random.shuffle(groups)
    eval_rows, eval_groups = take(groups, EVAL_TARGET)
    web_rows = []
    for group in eval_groups:
        if len(web_rows) >= WEB_TARGET:
            break
        room = WEB_TARGET - len(web_rows)
        web_rows.extend(group[:room])
    web_public = [{key: row[key] for key in ("title", "source", "category", "date", "url")} for row in web_rows]
    data = ROOT / "data"
    public = ROOT / "public" / "data"
    data.mkdir(exist_ok=True)
    public.mkdir(parents=True, exist_ok=True)
    (data / "uci-eval.json").write_text(json.dumps(eval_rows, ensure_ascii=False), encoding="utf-8")
    (public / "headlines.json").write_text(json.dumps(web_public, ensure_ascii=False), encoding="utf-8")
    meta = {
        "source": "UCI Machine Learning Repository, News Aggregator",
        "url": "https://archive.ics.uci.edu/dataset/359/news+aggregator",
        "license": "Public domain. 기사 본문은 포함하지 않고 제목·출처·URL·분야·시각만 사용한다.",
        "period": "2014-03-10 ~ 2014-08-10",
        "seed": SEED,
        "rule": "같은 STORY에 속한 제목이 2개 이상인 사건만 사용하고, 사건당 최대 6개 제목을 남긴다.",
        "evalArticles": len(eval_rows),
        "evalStories": len({row["story"] for row in eval_rows}),
        "evalCategories": dict(Counter(row["category"] for row in eval_rows)),
        "webArticles": len(web_public),
        "webStories": len({row["story"] for row in web_rows}),
        "webCategories": dict(Counter(row["category"] for row in web_public)),
    }
    (data / "uci-sample-meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
