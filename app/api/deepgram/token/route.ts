import { NextResponse } from "next/server";

export async function GET() {
  // Try env var first, fallback to provided key
  const key = process.env.DEEPGRAM_API_KEY || "c6c917568bc52d1d679aa04e94a71defb240969f";

  if (!key) {
    return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 });
  }

  return NextResponse.json({
    key,
    websocket_url: "wss://agent.deepgram.com/v1/agent/converse",
    features: { stt: true, tts: true, voice_agent: true },
  });
}
