# OpenClaw Voice

A cinematic voice AI interface built with Next.js, Tailwind CSS, and Framer Motion.

## Design System

This project follows the [Stitch DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/) format. See `DESIGN.md` for the complete design specification.

## Quick Start

```bash
npm install
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variable: `DEEPGRAM_API_KEY`
4. Deploy

## WebSocket Server

The frontend connects to a WebSocket server on your Ubuntu machine at `ws://194.195.215.135:8081`. Make sure the server is running before connecting.

## Design Inspiration

Built using design patterns from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md), specifically adapted from:
- **ElevenLabs** — audio-waveform aesthetics
- **Raycast** — dark macOS-native feel
- **RunwayML** — cinematic motion

## License

MIT
