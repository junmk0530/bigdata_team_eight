"""한 사건 묶음에서 숫자나 결론이 매체마다 다른 문장만 고른다."""

import re

from .nouns import GENERIC

NUMBER = re.compile(
    r"(?P<body>\d+(?:,\d{3})*(?:\s*천\s*\d+(?:,\d{3})*)?|\d+\s*천)\s*여?\s*"
    r"(?P<unit>억\s*원|만\s*원|천\s*원|달러|명|원|%|퍼센트|건)"
)
TOPICS = (
    "사망", "부상", "실종", "확진", "감염", "대피", "이재민", "피해액", "피해",
    "매출", "영업이익", "수주", "계약", "예산", "지원금", "지원", "벌금", "징역",
    "화재", "침수", "지급", "위자료",
)
POLES = {
    "폐쇄": "done", "중단": "done", "유지": "keep", "재개": "resume",
    "검토": "pending", "추진": "pending", "보류": "pending",
    "거부": "no", "거절": "no", "부인": "no", "반대": "no",
    "수용": "yes", "동의": "yes", "인정": "yes", "찬성": "yes",
    "상승": "up", "증가": "up", "급등": "up",
    "하락": "down", "감소": "down", "급락": "down",
    "유죄": "guilty", "무죄": "innocent", "합의": "deal", "결렬": "break",
    "확정": "fixed", "철회": "back", "함락": "fall", "사퇴": "resign", "유임": "stay",
}
NEGATED = re.compile(r"(?:(?:하|를|은|는|도)?지?)?(?:못|않|안|아니)")


def _sentence(text: str, start: int) -> str:
    left = max(text.rfind(".", 0, start), text.rfind("다", 0, start))
    right_candidates = [pos for pos in (text.find(".", start), text.find("다.", start)) if pos >= 0]
    right = min(right_candidates) + 1 if right_candidates else len(text)
    sentence = " ".join(text[max(0, left + 1):right].split())
    if len(sentence) < 8:
        sentence = " ".join(text.split())
    return sentence[:240]


def _amount(body: str) -> int:
    compact = body.replace(",", "").replace(" ", "")
    if "천" not in compact:
        return int(float(compact)) if "." in compact else int(compact)
    left, right = compact.split("천", 1)
    return int(left) * 1000 + (int(right) if right else 0)


def _money(amount: int, unit: str) -> tuple[str, str, str]:
    scale = {"억원": 100_000_000, "만원": 10_000, "천원": 1_000, "원": 1}[unit]
    won = amount * scale
    if won % 100_000_000 == 0 and won >= 100_000_000:
        return str(won // 100_000_000), "억원", str(won)
    if won % 10_000 == 0 and won >= 10_000:
        return str(won // 10_000), "만원", str(won)
    return str(won), "원", str(won)


def mentions(article: dict) -> list[dict]:
    text = " ".join(part for part in (article.get("title"), article.get("summary")) if part)
    found = []
    for match in NUMBER.finditer(text):
        window = text[max(0, match.start() - 24):match.end() + 12]
        topic = next((item for item in TOPICS if item in window), "")
        if not topic:
            continue
        unit = match.group("unit").replace(" ", "")
        amount = _amount(match.group("body"))
        if unit in {"억원", "만원", "천원", "원"}:
            value, unit, key = _money(amount, unit)
        elif unit == "퍼센트":
            value, unit, key = str(amount), "%", str(amount)
        else:
            value, key = str(amount), str(amount)
        found.append({
            "value": value,
            "unit": unit,
            "key": key,
            "topic": topic,
            "sentence": _sentence(text, match.start()),
            "source": article.get("source") or "출처 미상",
            "articleId": article["id"],
        })
    return found


def _pole(text: str, word: str, pos: int) -> str:
    after = re.sub(r"\s+", "", text[pos + len(word):pos + len(word) + 8])
    pole = POLES[word]
    if NEGATED.match(after) and pole in {"yes", "no"}:
        return "no" if pole == "yes" else "yes"
    if NEGATED.match(after):
        return "not-" + pole
    return pole


def claim_sides(article: dict) -> list[dict]:
    title = article.get("title") or ""
    found = []
    for word in POLES:
        pos = title.find(word)
        if pos < 0:
            continue
        found.append({
            "value": word,
            "unit": "",
            "key": _pole(title, word, pos),
            "topic": "결론",
            "sentence": title.strip(),
            "source": article.get("source") or "출처 미상",
            "articleId": article["id"],
        })
    poles = {item["key"] for item in found}
    if len(poles) != 1:
        return []
    return found[:1]


def _same_event(group: dict, sides: list[dict]) -> bool:
    ids = {side["articleId"] for side in sides}
    sets = [tokens for article, tokens in zip(group["articles"], group["tokens"]) if article["id"] in ids]
    if len(sets) < 2:
        return False
    return bool(set.intersection(*sets) - GENERIC)


def _splits(group: dict, rows: list[dict]) -> list[dict]:
    buckets: dict[tuple[str, str], list[dict]] = {}
    for item in rows:
        buckets.setdefault((item["topic"], item["unit"]), []).append(item)
    results = []
    for (topic, unit), items in buckets.items():
        by_source: dict[str, dict] = {}
        for item in items:
            by_source.setdefault(item["source"], item)
        if len(by_source) < 2 or len({item["key"] for item in by_source.values()}) < 2:
            continue
        sides = list(by_source.values())
        if not _same_event(group, sides) or not _same_anchor(group, sides):
            continue
        results.append({"topic": _label(group, sides, topic), "unit": unit, "sides": sides})
    return results


def _same_anchor(group: dict, sides: list[dict]) -> bool:
    if any(side.get("unit") for side in sides):
        return True
    anchors = []
    for side in sides:
        index = next(i for i, article in enumerate(group["articles"]) if article["id"] == side["articleId"])
        title = group["articles"][index]["title"]
        pos = title.find(side["value"])
        window = title[max(0, pos - 18): pos + len(side["value"]) + 6]
        anchors.append({word for word in group["tokens"][index] if word in window and word not in GENERIC})
    return bool(set.intersection(*anchors)) if len(anchors) >= 2 else False


def _label(group: dict, sides: list[dict], topic: str) -> str:
    if topic != "결론":
        return topic
    ids = {side["articleId"] for side in sides}
    titles = []
    sets = []
    for article, tokens in zip(group["articles"], group["tokens"]):
        if article["id"] in ids:
            titles.append(article.get("title") or "")
            sets.append(tokens)
    shared = set.intersection(*sets) - GENERIC if len(sets) >= 2 else set()
    shared = {word for word in shared if all(word in title for title in titles)}
    anchors = []
    for side in sides:
        index = next(i for i, article in enumerate(group["articles"]) if article["id"] == side["articleId"])
        title = group["articles"][index].get("title") or ""
        pos = title.find(side["value"])
        window = title[max(0, pos - 18): pos + len(side["value"]) + 6]
        anchors.append({word for word in group["tokens"][index] if word in window and word not in GENERIC})
    near = set.intersection(*anchors) if len(anchors) >= 2 else set()
    picked = near or shared
    if not picked:
        return "표현"
    return sorted(picked, key=lambda word: (-len(word), word))[0]


def divergences(group: dict) -> list[dict]:
    if group["size"] < 2:
        return []
    rows = [item for article in group["articles"] for item in mentions(article)]
    rows.extend(item for article in group["articles"] for item in claim_sides(article))
    results = _splits(group, rows)
    results.sort(key=lambda item: item["topic"])
    return results
