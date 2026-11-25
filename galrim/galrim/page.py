"""갈린 보도 화면."""

import html

STYLE = """
:root { --bg:#f4f6f5; --ink:#14211c; --muted:#52605a; --line:#d8e2dc; --paper:#fff; --accent:#0f6b4c; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif; line-height:1.5; }
a { color:var(--accent); }
a:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.skip { position:absolute; left:12px; top:-40px; background:#fff; padding:8px 12px; }
.skip:focus { top:12px; }
.wrap { width:min(880px, calc(100% - 32px)); margin:0 auto; }
header { padding:28px 0 8px; }
.brand { color:var(--ink); text-decoration:none; font-weight:700; font-size:20px; }
.brand span { display:block; font-weight:400; color:var(--muted); font-size:14px; }
h1 { font-size:30px; line-height:1.3; margin:12px 0; }
.note { color:var(--muted); }
button { border:0; background:var(--accent); color:#fff; border-radius:10px; padding:10px 14px; font:inherit; }
.card { display:block; background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:16px; margin:12px 0; text-decoration:none; color:inherit; }
.card strong { display:block; font-size:18px; }
.chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px; }
.chip { background:#e7f2ec; border-radius:999px; padding:2px 8px; font-size:13px; }
.split { display:grid; gap:10px; margin-top:12px; }
.side { background:var(--bg); border-radius:10px; padding:12px; }
.side b { display:block; }
.empty { color:var(--muted); }
ul { padding-left:18px; }
"""


def _shell(title: str, body: str) -> str:
    return (
        "<!doctype html><html lang='ko'><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>{html.escape(title)}</title><style>{STYLE}</style></head><body>"
        "<a class='skip' href='#main'>본문으로 건너뛰기</a><header class='wrap'>"
        "<a class='brand' href='/'>갈린 보도<span>같은 사건에서 숫자가 다른 기사만 모읍니다</span></a>"
        "<form method='post' action='/refresh'><button type='submit'>지금 기사 다시 받기</button></form>"
        f"</header><main id='main' class='wrap'>{body}</main></body></html>"
    )


def _pair(item: dict) -> str:
    shown = []
    for side in item["sides"]:
        label = f"{side['value']}{item['unit']}"
        if label not in shown:
            shown.append(label)
    return f"{item['topic']} {' · '.join(shown)}"


def render_home(result: dict | None) -> str:
    if result is None:
        body = "<h1>아직 받은 기사가 없습니다</h1><p class='note'>버튼을 누르면 여러 매체의 최신 기사를 모아, 같은 사건에서 숫자가 갈린 것만 남깁니다.</p>"
        return _shell("갈린 보도", body)
    cards = []
    for item in result.get("items") or []:
        pairs = "".join(f"<span class='chip'>{html.escape(_pair(div))}</span>" for div in item["divergences"])
        text = item["divergences"][0]["text"]
        cards.append(
            f"<a class='card' href='/item/{html.escape(item['id'])}'><div class='chips'>{pairs}</div>"
            f"<strong>{html.escape(' '.join(item.get('keywords') or []) or '사건')}</strong>"
            f"<p>{html.escape(text)}</p></a>"
        )
    status = f"기사 {result.get('articleCount', 0)}건을 모았고, 갈린 사건은 {len(result.get('items') or [])}건입니다."
    if not cards:
        cards.append("<p class='empty'>지금 모은 기사에서는 같은 사건의 다른 숫자가 없습니다. 매체가 더 모이거나 새 기사가 들어오면 다시 받습니다.</p>")
    body = f"<h1>오늘 갈린 숫자</h1><p class='note'>{html.escape(status)} 어느 쪽이 맞는지는 정하지 않습니다.</p>{''.join(cards)}"
    return _shell("갈린 보도", body)


def render_item(item: dict) -> str:
    blocks = []
    for div in item["divergences"]:
        sides = "".join(
            f"<article class='side'><b>{html.escape(side['source'])} · {html.escape(side['value'] + div['unit'])}</b>"
            f"<p>“{html.escape(side['sentence'])}”</p></article>"
            for side in div["sides"]
        )
        blocks.append(f"<h2>{html.escape(_pair(div))}</h2><p>{html.escape(div['text'])}</p><div class='split'>{sides}</div>")
    articles = "".join(
        f"<li>{html.escape(article.get('source') or '')} · "
        + (f"<a href='{html.escape(article['url'])}'>{html.escape(article['title'])}</a>" if article.get("url") else html.escape(article["title"]))
        + "</li>"
        for article in item["articles"]
    )
    body = f"<h1>{html.escape(' '.join(item.get('keywords') or []) or '사건')}</h1>{''.join(blocks)}<h2>이 묶음의 기사</h2><ul>{articles}</ul>"
    return _shell("갈린 보도", body)


def render_message(title: str, message: str) -> str:
    return _shell(title, f"<h1>{html.escape(title)}</h1><p class='note'>{html.escape(message)}</p>")
