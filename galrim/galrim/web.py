from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .page import render_home, render_item, render_message
from .pipeline import load, refresh


class Handler(BaseHTTPRequestHandler):
    def _send(self, body: str, status: int = 200) -> None:
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/":
            self._send(render_home(load()))
            return
        if path.startswith("/item/"):
            result = load() or {"items": []}
            item_id = path.removeprefix("/item/")
            item = next((row for row in result.get("items") or [] if row["id"] == item_id), None)
            if item is None:
                self._send(render_message("사건이 없습니다", "목록으로 돌아가 다시 받아 주세요."), 404)
                return
            self._send(render_item(item))
            return
        self._send(render_message("페이지가 없습니다", "목록으로 돌아가 주세요."), 404)

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/refresh":
            self._send(render_message("페이지가 없습니다", "목록으로 돌아가 주세요."), 404)
            return
        try:
            result = refresh()
        except Exception as error:
            self._send(render_message("기사를 모으지 못했습니다", str(error)), 502)
            return
        self._send(render_home(result))

    def log_message(self, fmt: str, *args) -> None:
        print(f"{self.address_string()} {fmt % args}")


def serve(port: int = 8775) -> None:
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"http://127.0.0.1:{port}")
    server.serve_forever()
