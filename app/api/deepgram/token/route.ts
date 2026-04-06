import { NextResponse } from "next/server";

export async function GET() {
  // Return the relay tunnel URL so the frontend knows where to connect.
  // The Deepgram API key is ONLY used server-side in relay_server.py --
  // we never send it to the browser.
  const relayUrl =
    process.env.NEXT_PUBLIC_RELAY_URL ||
    "wss://leave-recorded-vernon-restructuring.trycloudflare.com";

  return NextResponse.json({
    relay_url: relayUrl,
    features: { stt: true, tts: true, voice_agent: true },
  });
}
