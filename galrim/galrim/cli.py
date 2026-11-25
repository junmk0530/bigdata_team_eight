import sys

from .pipeline import refresh


def main(argv: list[str] | None = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] not in {"refresh", "serve"}:
        raise SystemExit("사용법: python -m galrim refresh | python -m galrim serve")
    if argv[0] == "refresh":
        result = refresh()
        print(f"기사 {result['articleCount']}건, 갈린 사건 {len(result['items'])}건")
        for feed in result["feeds"]:
            if feed["error"]:
                print(f"실패 {feed['url']} {feed['error']}")
        return
    from .web import serve
    serve(int(argv[1]) if len(argv) > 1 else 8775)


if __name__ == "__main__":
    main()
