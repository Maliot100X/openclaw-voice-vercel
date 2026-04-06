#!/usr/bin/env python3
"""
Deepgram Voice Agent Relay Server
Proxies browser WebSocket <-> Deepgram Voice Agent API.

Run on the Ubuntu server behind cloudflared:
  python3 relay_server.py

cloudflared handles TLS termination, so this server listens on plain ws://.
"""

import asyncio
import json
import os
import http
import websockets

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEEPGRAM_API_KEY = os.environ.get(
    "DEEPGRAM_API_KEY",
    "c6c917568bc52d1d679aa04e94a71defb240969f",
)
# Deepgram Voice Agent WebSocket endpoint (no token in URL -- we use headers)
DEEPGRAM_WS_URL = "wss://agent.deepgram.com/agent"
DEEPGRAM_EXTRA_HEADERS = {"Authorization": f"Token {DEEPGRAM_API_KEY}"}
PORT = int(os.environ.get("RELAY_PORT", "8000"))

# ---------------------------------------------------------------------------
# HTTP health-check handler (GET / returns 200 OK)
# ---------------------------------------------------------------------------
async def health_check(path, request_headers):
    """Return a plain 200 for non-WebSocket requests so monitoring tools
    (and cloudflared) can verify the relay is alive."""
    if path == "/healthz" or path == "/":
        # Only intercept plain GET -- WebSocket upgrades have Upgrade header
        if "Upgrade" not in request_headers:
            return http.HTTPStatus.OK, [], b"relay ok\n"
    return None  # let websockets handle the connection normally


# ---------------------------------------------------------------------------
# Relay helpers
# ---------------------------------------------------------------------------
async def relay_browser_to_deepgram(browser_ws, deepgram_ws):
    """Forward every message from the browser to Deepgram."""
    try:
        async for message in browser_ws:
            await deepgram_ws.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"  Browser -> Deepgram error: {e}")


async def relay_deepgram_to_browser(deepgram_ws, browser_ws):
    """Forward every message from Deepgram back to the browser."""
    try:
        async for message in deepgram_ws:
            await browser_ws.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"  Deepgram -> Browser error: {e}")


# ---------------------------------------------------------------------------
# Connection handler
# ---------------------------------------------------------------------------
async def handle_connection(browser_ws):
    """Open a mirrored connection to Deepgram and relay bidirectionally."""
    client_ip = (
        browser_ws.remote_address[0] if browser_ws.remote_address else "unknown"
    )
    print(f"[{client_ip}] Browser connected")

    deepgram_ws = None

    try:
        print(f"[{client_ip}] Connecting to Deepgram...")
        deepgram_ws = await websockets.connect(
            DEEPGRAM_WS_URL,
            extra_headers=DEEPGRAM_EXTRA_HEADERS,
            ping_interval=20,
            ping_timeout=10,
        )
        print(f"[{client_ip}] Connected to Deepgram Voice Agent")

        await asyncio.gather(
            relay_browser_to_deepgram(browser_ws, deepgram_ws),
            relay_deepgram_to_browser(deepgram_ws, browser_ws),
            return_exceptions=True,
        )

    except Exception as e:
        print(f"[{client_ip}] Error: {e}")
        try:
            await browser_ws.send(
                json.dumps({"type": "Error", "message": str(e)})
            )
        except Exception:
            pass
    finally:
        print(f"[{client_ip}] Disconnecting...")
        if deepgram_ws:
            await deepgram_ws.close()
        await browser_ws.close()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
async def main():
    server = await websockets.serve(
        handle_connection,
        "0.0.0.0",
        PORT,
        ping_interval=20,
        ping_timeout=10,
        process_request=health_check,
    )

    print("=== Deepgram Voice Agent Relay ===")
    print(f"Listening on ws://0.0.0.0:{PORT}  (cloudflared handles TLS)")
    print(f"Health check: http://localhost:{PORT}/healthz")
    print("Press Ctrl+C to stop")
    print("==================================")

    await server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped")
