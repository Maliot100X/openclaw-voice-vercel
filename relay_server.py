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
    # Create SSL context with self-signed cert
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    
    try:
        ssl_context.load_cert_chain(
            certfile='/etc/ssl/certs/selfsigned.crt',
            keyfile='/etc/ssl/private/selfsigned.key'
        )
        print("Loaded existing SSL certificates")
    except:
        print("Generating new self-signed certificates...")
        # Generate self-signed cert
        import subprocess
        subprocess.run([
            'openssl', 'req', '-x509', '-newkey', 'rsa:2048',
            '-keyout', '/tmp/selfsigned.key',
            '-out', '/tmp/selfsigned.crt',
            '-days', '365', '-nodes',
            '-subj', '/CN=194.195.215.135',
            '-addext', 'subjectAltName=IP:194.195.215.135'
        ], check=True)
        
        ssl_context.load_cert_chain(
            certfile='/tmp/selfsigned.crt',
            keyfile='/tmp/selfsigned.key'
        )
        print("Generated new SSL certificates")
    
    # Start WebSocket server
    server = await websockets.serve(
        handle_connection,
        "0.0.0.0",
        8000,
        ssl=ssl_context,
        ping_interval=20,
        ping_timeout=10
    )
    
    print(f"=== Deepgram Voice Agent Relay ===")
    print(f"Listening on wss://194.195.215.135:8000")
    print(f"Relaying to Deepgram Voice Agent")
    print(f"Press Ctrl+C to stop")
    print(f"==================================")
    
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped")
