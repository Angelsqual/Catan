#!/usr/bin/env python3
"""Lanzador local de Catan con doble click.
- Sirve el juego desde la carpeta actual del script.
- Abre el navegador automáticamente.
- Busca puerto libre si el 4173 está ocupado.
"""

from __future__ import annotations

import contextlib
import http.server
import os
import socket
import socketserver
import sys
import threading
import time
import webbrowser
from pathlib import Path

HOST_BIND = "0.0.0.0"
HOST_URL = "127.0.0.1"
DEFAULT_PORT = 4173


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


def find_free_port(start_port: int) -> int:
    port = start_port
    while port < start_port + 50:
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex((HOST_URL, port)) != 0:
                return port
        port += 1
    raise RuntimeError("No se encontró un puerto libre entre 4173 y 4222")


def main() -> int:
    root = Path(__file__).resolve().parent
    os.chdir(root)

    if not (root / "index.html").exists():
        print("Error: no se encontró index.html junto al lanzador.")
        return 1

    try:
        port = find_free_port(DEFAULT_PORT)
    except RuntimeError as exc:
        print(f"Error: {exc}")
        return 1

    with socketserver.TCPServer((HOST_BIND, port), QuietHandler) as httpd:
        httpd.allow_reuse_address = True
        url = f"http://{HOST_URL}:{port}"

        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        print("=" * 52)
        print("CATAN iniciado correctamente")
        print(f"URL: {url}")
        if port != DEFAULT_PORT:
            print(f"Nota: el puerto {DEFAULT_PORT} estaba ocupado. Se usa {port}.")
        print("Si no se abre solo, copia la URL en tu navegador.")
        print("Para cerrar el servidor: Ctrl+C")
        print("=" * 52)

        webbrowser.open(url)

        try:
            while True:
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nCerrando Catan...")
            httpd.shutdown()

    return 0


if __name__ == "__main__":
    sys.exit(main())
