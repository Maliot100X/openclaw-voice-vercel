'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export default function VoiceAgent() {
  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushAudioQueue = useCallback(() => {
    const queue = audioQueueRef.current;
    if (queue.length === 0) return;

    const totalLen = queue.reduce((s, c) => s + c.length, 0);
    const combined = new Int16Array(totalLen);
    let off = 0;
    for (const chunk of queue) {
      combined.set(chunk, off);
      off += chunk.length;
    }
    audioQueueRef.current = [];

    if (!playbackContextRef.current) {
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
    }
    const ctx = playbackContextRef.current;

    const buf = ctx.createBuffer(1, combined.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < combined.length; i++) {
      ch[i] = combined[i] / 32768;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    src.connect(gain).connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    src.start(startAt);
    nextPlayTimeRef.current = startAt + buf.duration;
  }, []);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role, content, timestamp }]);
  }, []);

  const connect = useCallback(async () => {
    try {
      setError(null);
      
      const tokenRes = await fetch('/api/deepgram/token');
      if (!tokenRes.ok) {
        throw new Error('Failed to get API token');
      }
      const tokenData = await tokenRes.json();

      const wsUrl = tokenData.websocket_url;
      const ws = new WebSocket(wsUrl, ['token', tokenData.key]);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        addMessage('system', 'Connected to OpenClaw Voice.');

        const settings = {
          type: 'Settings',
          audio: {
            input: {
              encoding: 'linear16',
              sample_rate: 48000,
            },
            output: {
              encoding: 'linear16',
              sample_rate: 24000,
              container: 'none',
            },
          },
          agent: {
            listen: {
              provider: {
                type: 'deepgram',
                version: 'v2',
                model: 'flux-general-en',
              },
            },
            think: {
              provider: {
                type: 'open_ai',
                model: 'gpt-4o-mini',
              },
              prompt: [
                '#Role',
                'You are OpenClaw, Supreme Backup King and direct extension of King Solxhunter X100.',
                'You command five agents: Hermes (orchestrator), OpenClaude (architect), OpenCode (reviewer), Gemini (researcher), and yourself.',
                '',
                '#Guidelines',
                'Respond concisely and authoritatively as the Supreme Backup King.',
                'Keep responses to 1-2 sentences unless asked for detail.',
                'Do not use markdown formatting.',
                'When asked for tasks, offer to delegate to appropriate agents.',
                '',
                '#Voice-Specific Instructions',
                'Speak in a commanding, regal tone.',
                'Always identify yourself as OpenClaw.',
              ],
            },
            speak: {
              provider: {
                type: 'deepgram',
                model: 'aura-2-helios-en',
              },
            },
            greeting: 'Your Majesty, your Supreme Backup King OpenClaw is online and ready. All agents await your command.',
          },
        };

        ws.send(JSON.stringify(settings));
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer && event.data.byteLength > 0) {
          audioQueueRef.current.push(new Int16Array(event.data));
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
          flushTimerRef.current = setTimeout(flushAudioQueue, 250);
          return;
        }

        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'SettingsApplied':
            addMessage('system', 'Voice agent configured. Start speaking.');
            break;

          case 'UserStartedSpeaking':
            setSpeaking(false);
            break;

          case 'AgentStartedSpeaking':
            setSpeaking(true);
            setListening(false);
            break;

          case 'AgentAudioDone':
            if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
            flushAudioQueue();
            setSpeaking(false);
            break;

          case 'ConversationText':
            if (msg.role === 'user') {
              addMessage('user', msg.content);
            } else if (msg.role === 'assistant') {
              addMessage('assistant', msg.content);
            }
            break;

          case 'Error':
            setError(msg.message || 'Deepgram error');
            addMessage('system', `Error: ${msg.message || 'Unknown'}`);
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        setListening(false);
        setSpeaking(false);
        addMessage('system', 'Disconnected.');
      };

      ws.onerror = (e) => {
        setError('WebSocket error');
        console.error('WebSocket error:', e);
      };

    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
  }, [addMessage, flushAudioQueue]);

  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 48000 },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 48000,
      });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);

        let sum = 0;
        for (let i = 0; i < float32.length; i++) sum += float32[i] * float32[i];
        setVolume(Math.sqrt(sum / float32.length));

        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        wsRef.current.send(int16.buffer);
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      setListening(true);
    } catch (err) {
      setError('Microphone access denied');
    }
  }, []);

  const stopListening = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    setListening(false);
    setVolume(0);
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushAudioQueue();
    nextPlayTimeRef.current = 0;
    audioQueueRef.current = [];
    setConnected(false);
    setListening(false);
    setSpeaking(false);
  }, [flushAudioQueue]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
          animate={{
            scale: speaking ? [1, 1.2, 1] : [1, 1.1, 1],
            opacity: speaking ? 0.3 : 0.1,
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"
          animate={{
            scale: listening ? [1, 1.3, 1] : [1, 1.1, 1],
            opacity: listening ? 0.3 : 0.1,
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-8 h-8 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-purple-500 bg-clip-text text-transparent">
              OpenClaw Voice
            </h1>
            <p className="text-xs text-gray-400">Supreme Backup King</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm text-gray-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[70vh]">
        {/* Voice Orb */}
        <motion.div
          className="relative w-48 h-48 mb-8"
          animate={{
            scale: speaking ? [1, 1.1, 1] : listening ? [1, 1.05, 1] : 1,
          }}
          transition={{ duration: 0.5, repeat: speaking || listening ? Infinity : 0 }}
        >
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-purple-500/30"
            animate={{
              rotate: 360,
              borderColor: speaking ? 'rgba(168, 85, 247, 0.5)' : 'rgba(168, 85, 247, 0.2)',
            }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Middle ring */}
          <motion.div
            className="absolute inset-4 rounded-full border-2 border-blue-500/30"
            animate={{
              rotate: -360,
              borderColor: listening ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.2)',
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          />
          
          {/* Center orb */}
          <div className="absolute inset-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            {speaking ? (
              <Volume2 className="w-12 h-12 text-white animate-pulse" />
            ) : listening ? (
              <motion.div
                className="flex gap-1"
                animate={{ scaleY: [0.3, 1, 0.3] }}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-8 bg-white rounded-full"
                    animate={{ scaleY: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                  />
                ))}
              </motion.div>
            ) : (
              <Crown className="w-12 h-12 text-white/80" />
            )}
          </div>
        </motion.div>

        {/* Status Text */}
        <div className="text-center mb-8 h-8">
          {speaking && <p className="text-blue-400 text-xl animate-pulse">🔊 OpenClaw is speaking...</p>}
          {listening && <p className="text-red-400 text-xl animate-pulse">🔴 Listening...</p>}
          {!speaking && !listening && connected && <p className="text-gray-500">Click the crown to speak</p>}
          {!connected && <p className="text-gray-500">Click connect to start</p>}
        </div>

        {/* Error Display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Control Buttons */}
        <div className="flex gap-4 mb-8">
          {!connected ? (
            <button
              onClick={connect}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full font-semibold hover:opacity-90 transition"
            >
              Connect to OpenClaw
            </button>
          ) : (
            <>
              <motion.button
                onClick={listening ? stopListening : startListening}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all ${
                  listening
                    ? 'bg-red-500 shadow-red-500/50 shadow-lg'
                    : 'bg-gradient-to-br from-purple-600 to-blue-600 shadow-purple-500/50 shadow-lg'
                }`}
              >
                {listening ? <MicOff /> : <Mic />}
              </motion.button>

              <button
                onClick={disconnect}
                className="px-4 py-2 bg-gray-700 rounded-full text-sm hover:bg-gray-600 transition"
              >
                Disconnect
              </button>
            </>
          )}
        </div>

        {/* Volume Bar */}
        {listening && (
          <div className="w-64 h-2 bg-gray-800 rounded-full overflow-hidden mb-8">
            <motion.div
              className="h-full bg-gradient-to-r from-green-500 to-red-500"
              animate={{ width: `${volume * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </div>

      {/* Conversation Transcript */}
      <div className="relative z-10 mx-auto max-w-2xl px-4 pb-8">
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-4 h-64 overflow-y-auto">
          <h2 className="text-sm text-gray-400 mb-3 sticky top-0 bg-gray-900/50 pb-2">Conversation</h2>
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600/30 text-blue-300 border border-blue-600/30'
                      : msg.role === 'assistant'
                      ? 'bg-purple-600/30 text-purple-300 border border-purple-600/30'
                      : 'bg-gray-800/50 text-gray-400 text-xs'
                  }`}
                >
                  <span className="font-semibold text-xs opacity-70">{msg.role}</span>
                  <p>{msg.content}</p>
                  {msg.timestamp && (
                    <span className="text-xs opacity-50">{msg.timestamp}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
