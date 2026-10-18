#!/usr/bin/env python3
"""
QWARDDLE LAN companion.

Run:
    py lan_server.py

Then open the printed address on the host computer and on any other computer
connected to the same local network.

This server does NOT simulate gameplay. It only:
- serves the QWARDDLE files,
- stores a tiny same-LAN room list,
- validates optional room passwords,
- relays WebRTC signaling messages between one host and one client.

The actual match simulation stays inside the host browser.
"""

from __future__ import annotations

import json
import mimetypes
import secrets
import socket
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent
HOST = "0.0.0.0"
PORT = 8765
ROOM_TTL = 60 * 60 * 2

ROOMS: dict[str, dict] = {}
LOCK = threading.RLock()


def now() -> float:
    return time.time()


def sanitize_text(value, limit=24) -> str:
    value = str(value or "").strip()
    value = "".join(ch for ch in value if ch.isprintable())
    return value[:limit]


def cleanup_rooms() -> None:
    cutoff = now() - ROOM_TTL
    with LOCK:
        stale = [room_id for room_id, room in ROOMS.items() if room["updated"] < cutoff]
        for room_id in stale:
            ROOMS.pop(room_id, None)


def make_room_id() -> str:
    with LOCK:
        while True:
            room_id = secrets.token_hex(2).upper()
            if room_id not in ROOMS:
                return room_id


def local_ip() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("10.255.255.255", 1))
            return sock.getsockname()[0]
        finally:
            sock.close()
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"


class QwarddleLanHandler(SimpleHTTPRequestHandler):
    server_version = "QwarddleLAN/0.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[LAN] {self.address_string()} - {fmt % args}")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=HTTPStatus.OK):
        raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        raw = self.rfile.read(min(length, 1024 * 1024))
        try:
            value = json.loads(raw.decode("utf-8"))
            return value if isinstance(value, dict) else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            return {}

    def room_for_request(self, room_id):
        cleanup_rooms()
        with LOCK:
            return ROOMS.get(room_id)

    def authorized(self, room, role, token):
        if not room:
            return False
        if role == "host":
            return secrets.compare_digest(str(token or ""), room["host_token"])
        if role == "client":
            expected = room.get("client_token")
            return bool(expected) and secrets.compare_digest(str(token or ""), expected)
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if path == "/api/info":
            self.send_json({
                "service": "qwarddle-lan",
                "version": 1,
                "host": socket.gethostname(),
            })
            return

        if path == "/api/rooms":
            cleanup_rooms()
            with LOCK:
                rooms = []
                for room_id, room in ROOMS.items():
                    rooms.append({
                        "id": room_id,
                        "name": room["name"],
                        "hostNickname": room["host_nickname"],
                        "clientNickname": room.get("client_nickname") or "",
                        "locked": bool(room["password"]),
                        "players": 1 + (1 if room.get("client_token") else 0),
                        "capacity": 2,
                    })
            rooms.sort(key=lambda item: item["name"].lower())
            self.send_json({"rooms": rooms})
            return

        parts = [part for part in path.split("/") if part]
        if len(parts) == 4 and parts[:2] == ["api", "rooms"] and parts[3] == "signal":
            room_id = parts[2].upper()
            role = (query.get("role") or [""])[0]
            token = (query.get("token") or [""])[0]
            try:
                after = int((query.get("after") or ["0"])[0])
            except ValueError:
                after = 0

            room = self.room_for_request(room_id)
            if not self.authorized(room, role, token):
                self.send_json({"error": "unauthorized"}, HTTPStatus.FORBIDDEN)
                return

            queue_name = "to_host" if role == "host" else "to_client"
            with LOCK:
                room["updated"] = now()
                messages = [msg for msg in room[queue_name] if msg["seq"] > after]
            self.send_json({"messages": messages})
            return

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        body = self.read_json()

        if path == "/api/rooms":
            cleanup_rooms()
            room_id = make_room_id()
            host_token = secrets.token_urlsafe(18)
            nickname = sanitize_text(body.get("nickname"), 16) or "HOST"
            room_name = sanitize_text(body.get("name"), 28) or f"{nickname}'s game"
            password = sanitize_text(body.get("password"), 32)

            with LOCK:
                ROOMS[room_id] = {
                    "id": room_id,
                    "name": room_name,
                    "host_nickname": nickname,
                    "client_nickname": "",
                    "password": password,
                    "host_token": host_token,
                    "client_token": None,
                    "to_host": [],
                    "to_client": [],
                    "seq": 0,
                    "updated": now(),
                }

            self.send_json({
                "id": room_id,
                "name": room_name,
                "hostToken": host_token,
            }, HTTPStatus.CREATED)
            return

        parts = [part for part in path.split("/") if part]
        if len(parts) == 4 and parts[:2] == ["api", "rooms"]:
            room_id = parts[2].upper()
            action = parts[3]
            room = self.room_for_request(room_id)
            if not room:
                self.send_json({"error": "room not found"}, HTTPStatus.NOT_FOUND)
                return

            if action == "join":
                nickname = sanitize_text(body.get("nickname"), 16) or "GUEST"
                password = sanitize_text(body.get("password"), 32)
                with LOCK:
                    if room["password"] and not secrets.compare_digest(password, room["password"]):
                        self.send_json({"error": "wrong password"}, HTTPStatus.FORBIDDEN)
                        return
                    if room.get("client_token"):
                        self.send_json({"error": "room full"}, HTTPStatus.CONFLICT)
                        return

                    client_token = secrets.token_urlsafe(18)
                    room["client_token"] = client_token
                    room["client_nickname"] = nickname
                    room["updated"] = now()

                self.send_json({
                    "id": room_id,
                    "name": room["name"],
                    "hostNickname": room["host_nickname"],
                    "clientToken": client_token,
                })
                return

            if action == "signal":
                role = sanitize_text(body.get("role"), 8)
                token = str(body.get("token") or "")
                if not self.authorized(room, role, token):
                    self.send_json({"error": "unauthorized"}, HTTPStatus.FORBIDDEN)
                    return

                data = body.get("data")
                if not isinstance(data, dict):
                    self.send_json({"error": "invalid signal"}, HTTPStatus.BAD_REQUEST)
                    return

                target_queue = "to_client" if role == "host" else "to_host"
                with LOCK:
                    room["seq"] += 1
                    message = {
                        "seq": room["seq"],
                        "data": data,
                    }
                    room[target_queue].append(message)
                    if len(room[target_queue]) > 256:
                        room[target_queue] = room[target_queue][-128:]
                    room["updated"] = now()

                self.send_json({"ok": True, "seq": message["seq"]})
                return

            if action == "leave":
                role = sanitize_text(body.get("role"), 8)
                token = str(body.get("token") or "")
                if not self.authorized(room, role, token):
                    self.send_json({"error": "unauthorized"}, HTTPStatus.FORBIDDEN)
                    return

                with LOCK:
                    if role == "host":
                        ROOMS.pop(room_id, None)
                    else:
                        room["client_token"] = None
                        room["client_nickname"] = ""
                        room["to_host"].clear()
                        room["to_client"].clear()
                        room["updated"] = now()
                self.send_json({"ok": True})
                return

        self.send_json({"error": "not found"}, HTTPStatus.NOT_FOUND)


def main():
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("application/json", ".json")

    address = local_ip()
    print()
    print("QWARDDLE LAN")
    print("============")
    print(f"Host:  http://127.0.0.1:{PORT}")
    print(f"LAN:   http://{address}:{PORT}")
    print()
    print("Open the LAN address on the second computer.")
    print("Both computers must be on the same local network.")
    print("Press Ctrl+C to stop.")
    print()

    server = ThreadingHTTPServer((HOST, PORT), QwarddleLanHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping QWARDDLE LAN...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
