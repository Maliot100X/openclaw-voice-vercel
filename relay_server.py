#!/usr/bin/env python3
"""
Deepgram Voice Agent Relay Server
Proxies between browser WebSocket and Deepgram Voice Agent API
"""

import asyncio
import ssl
import json
import websockets
import urllib.request

# Deepgram API key
DEEPGRAM_API_KEY = "c6c917568bc52d1d679aa04e94a71defb240969f"
DEEPGRAM_WS_URL = f"wss://api.deepgram.com/v1/agent/converse?token={DEEPGRAM_API_KEY}"

async def relay_browser_to_deepgram(browser_ws, deepgram_ws):
    """Relay messages from browser to Deepgram"""
    try:
        async for message in browser_ws:
            if isinstance(message, bytes):
                # Audio data - forward to Deepgram
                await deepgram_ws.send(message)
            else:
                # JSON messages - forward to Deepgram
                await deepgram_ws.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"Browser→Deepgram error: {e}")

async def relay_deepgram_to_browser(deepgram_ws, browser_ws):
    """Relay messages from Deepgram to browser"""
    try:
        async for message in deepgram_ws:
            if isinstance(message, bytes):
                # Audio data - forward to browser
                await browser_ws.send(message)
            else:
                # JSON messages - forward to browser
                await browser_ws.send(message)
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"Deepgram→Browser error: {e}")

async def handle_connection(browser_ws):
    """Handle a new browser connection"""
    client_ip = browser_ws.remote_address[0] if browser_ws.remote_address else "unknown"
    print(f"[{client_ip}] Browser connected")
    
    deepgram_ws = None
    
    try:
        # Connect to Deepgram Voice Agent
        print(f"[{client_ip}] Connecting to Deepgram...")
        deepgram_ws = await websockets.connect(
            DEEPGRAM_WS_URL,
            ping_interval=20,
            ping_timeout=10
        )
        print(f"[{client_ip}] Connected to Deepgram Voice Agent")
        
        # Relay both directions concurrently
        await asyncio.gather(
            relay_browser_to_deepgram(browser_ws, deepgram_ws),
            relay_deepgram_to_browser(deepgram_ws, browser_ws),
            return_exceptions=True
        )
        
    except Exception as e:
        print(f"[{client_ip}] Error: {e}")
        try:
            error_msg = json.dumps({"type": "error", "message": str(e)})
            await browser_ws.send(error_msg)
        except:
            pass
    finally:
        print(f"[{client_ip}] Disconnecting...")
        if deepgram_ws:
            await deepgram_ws.close()
        await browser_ws.close()

async def main():
    # Start WebSocket server WITHOUT SSL (cloudflared provides SSL)
    server = await websockets.serve(
        handle_connection,
        "0.0.0.0",
        8000,
        ping_interval=20,
        ping_timeout=10
    )
    
    print(f"=== Deepgram Voice Agent Relay ===")
    print(f"Listening on ws://0.0.0.0:8000 (HTTP - cloudflared handles SSL)")
    print(f"Relaying to Deepgram Voice Agent")
    print(f"Press Ctrl+C to stop")
    print(f"==================================")
    
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped")
