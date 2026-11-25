"""비교 글은 기사에 있는 문장만 남긴다."""

import json
import os
import re

from .paths import PROMPT, load_local_env

DIGITS = re.compile(r"\d+(?:\.\d+)?")


def grounded_text(item: dict) -> str:
    parts = []
    for side in item["sides"]:
        last = side["source"][-1:] if side["source"] else ""
        particle = "은" if last and "가" <= last <= "힣" and (ord(last) - 0xAC00) % 28 else "는"
        parts.append(f"{side['source']}{particle} \"{side['sentence']}\"라고 썼다.")
    return " ".join(parts)


def _digits_ok(text: str, articles: list[dict]) -> bool:
    source = " ".join(f"{article.get('title', '')} {article.get('summary', '')}" for article in articles)
    allowed = set(DIGITS.findall(source.replace(",", "")))
    return all(number in allowed for number in DIGITS.findall(text.replace(",", "")))


def _quotes_ok(quotes: list, articles: list[dict]) -> bool:
    blobs = [f"{article.get('title', '')} {article.get('summary', '')}" for article in articles]
    if not quotes:
        return False
    for quote in quotes:
        sentence = quote.get("sentence") if isinstance(quote, dict) else ""
        if not isinstance(sentence, str) or not sentence.strip():
            return False
        if not any(sentence in blob for blob in blobs):
            return False
    return True


def accept_model(raw: dict, articles: list[dict]) -> dict | None:
    if not isinstance(raw, dict):
        return None
    text = raw.get("text")
    quotes = raw.get("quotes")
    if not isinstance(text, str) or not text.strip() or len(text) > 500:
        return None
    if not isinstance(quotes, list) or not _quotes_ok(quotes, articles) or not _digits_ok(text, articles):
        return None
    return {"text": text.strip(), "quotes": quotes, "model": "zai"}


def call_model(body: dict) -> dict | None:
    load_local_env()
    key = os.environ.get("ZAI_API_KEY")
    model = os.environ.get("ZAI_MODEL")
    if not key or not model:
        return None
    import urllib.request
    request = urllib.request.Request(
        "https://api.z.ai/api/paas/v4/chat/completions",
        data=json.dumps({
            "model": model,
            "temperature": 0.1,
            "max_tokens": 800,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": PROMPT.read_text(encoding="utf-8").strip()},
                {"role": "user", "content": json.dumps(body, ensure_ascii=False)},
            ],
        }).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = json.loads(response.read().decode("utf-8"))
    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


def compose(item: dict, articles: list[dict]) -> dict:
    body = {
        "topic": item["topic"],
        "unit": item["unit"],
        "sides": [{"source": side["source"], "sentence": side["sentence"]} for side in item["sides"]],
    }
    try:
        raw = call_model(body)
    except Exception:
        raw = None
    accepted = accept_model(raw, articles) if raw else None
    if accepted:
        return accepted
    return {"text": grounded_text(item), "quotes": body["sides"], "model": "quote"}
