'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Crown, Wifi, WifiOff } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// Audio Waveform Bar Component
function WaveformBar({ height, delay, isActive }: { height: number; delay: number; isActive: boolean }) {
  return (
    <motion.div
      className="w-1 bg-gradient-to-t from-amber-500 via-orange-400 to-yellow-300 rounded-full"
      initial={{ height: 4 }}
      animate={{
        height: isActive ? [4, height, 4] : 4,
        opacity: isActive ? 1 : 0.3,
      }}
      transition={{
        duration: 0.5,
        repeat: isActive ? Infinity : 0,
        repeatType: "reverse",
        delay: delay,
        ease: "easeInOut",
      }}
    />
  );
}

// 3D-style Audio Visualizer
function AudioVisualizer({ isListening, isSpeaking, volume }: { isListening: boolean; isSpeaking: boolean; volume: number }) {
  const bars = 24;
  const isActive = isListening || isSpeaking;
  
  return (
    <div className="relative w-full h-64 flex items-center justify-center">
      {/* Outer glow ring */}
      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
        }}
        animate={{
          scale: isActive ? [1, 1.2, 1] : 1,
          opacity: isActive ? [0.5, 1, 0.5] : 0.3,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      
      {/* Middle ring */}
      <motion.div
        className="absolute w-48 h-48 rounded-full border border-amber-500/20"
        animate={{
          rotate: isActive ? 360 : 0,
          scale: isActive ? [1, 1.05, 1] : 1,
        }}
        transition={{
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      
      {/* Inner ring */}
      <motion.div
        className="absolute w-32 h-32 rounded-full border border-orange-400/30"
        animate={{
          rotate: isActive ? -360 : 0,
          scale: isActive ? [1, 0.95, 1] : 1,
        }}
        transition={{
          rotate: { duration: 15, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      />
      
      {/* Waveform bars */}
      <div className="flex items-center gap-1 z-10">
        {Array.from({ length: bars }).map((_, i) => {
          const centerOffset = Math.abs(i - bars / 2);
          const maxHeight = Math.max(20, 120 - centerOffset * 8);
          const delay = i * 0.05;
          const height = isActive ? maxHeight * (0.3 + volume * 0.7) : 20;
          
          return (
            <WaveformBar
              key={i}
              height={height}
              delay={delay}
              isActive={isActive}
            />
          );
        })}
      </div>
      
      {/* Crown in center */}
      <motion.div
        className="absolute z-20"
        animate={{
          scale: isActive ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Crown className="w-12 h-12 text-amber-400" />
      </motion.div>
      
      {/* Status text */}
      <div className="absolute -bottom-8 text-center">
        <motion.p
          className="text-sm font-medium tracking-wider uppercase"
          style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '0.7px' }}
          animate={{
            color: isListening ? '#fbbf24' : isSpeaking ? '#fb923c' : '#9ca3af',
          }}
        >
          {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Ready'}
        </motion.p>
      </div>
    </div>
  );
}

export default function VoiceAgent() {
  const [connected, setConnected] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { role, content, timestamp }]);
  }, []);

  // Get Deepgram API key from token endpoint with fallback
  useEffect(() => {
    fetch('/api/deepgram/token')
      .then(res => res.json())
      .then(data => {
        if (data.token) {
          setApiKey(data.token);
        } else {
          // Fallback to hardcoded key if endpoint fails
          setApiKey('c6c917568bc52d1d679aa04e94a71defb240969f');
        }
      })
      .catch(err => {
        console.error('Failed to get token:', err);
        // Fallback to hardcoded key
        setApiKey('c6c917568bc52d1d679aa04e94a71defb240969f');
      });
  }, []);

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

  // Connect to Deepgram Voice Agent API directly
  const connect = useCallback(async () => {
    // Use provided key or fallback
    const key = apiKey || 'c6c917568bc52d1d679aa04e94a71defb240969f';
    
    if (!key) {
      setError('API key not available');
      return;
    }

    try {
      setError(null);
      setIsConnecting(true);
      
      addMessage('system', 'Connecting to Deepgram Voice Agent...');
      
      // Connect to cloudflared tunnel (valid SSL) → Ubuntu relay → Deepgram
      const ws = new WebSocket('wss://univ-downloading-jungle-located.trycloudflare.com');
      
      ws.binaryType = 'arraybuffer';

      ws.onopen = async () => {
        setConnected(true);
        setIsConnecting(false);
        addMessage('system', 'Connected to Voice Agent');
        
        // Send configuration
        const config = {
          type: 'SettingsConfiguration',
          audio: {
            input: { encoding: 'linear16', sample_rate: 16000 },
            output: { encoding: 'linear16', sample_rate: 24000, container: 'none' }
          },
          agent: {
            listen: { model: 'nova-3' },
            speak: { model: 'aura-2-helios' },
            think: { 
              provider: { type: 'open_ai' },
              model: 'gpt-4o-mini',
              instructions: 'You are OpenClaw, Supreme Backup King and extension of King Solxhunter X100. Command five agents: Hermes (orchestrator), OpenClaude (architect), OpenCode (reviewer), Gemini (researcher), and yourself. Respond concisely and authoritatively.'
            }
          }
        };
        ws.send(JSON.stringify(config));

        // Send welcome message to trigger immediate voice response
        setTimeout(() => {
          const welcomeMsg = {
            type: 'ConversationText',
            role: 'user',
            content: 'Say "OpenClaw Voice Online. I am ready to serve, King." and confirm you can hear me.'
          };
          ws.send(JSON.stringify(welcomeMsg));
          addMessage('user', '[INIT] Wake up greeting');
        }, 500);

        // Initialize audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        }
        await audioContextRef.current.resume();

        // Start recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }});
        mediaStreamRef.current = stream;

        const ctx = audioContextRef.current;
        const source = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(512, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!listening) return;
          const inputData = e.inputBuffer.getChannelData(0);
          
          // Calculate volume
          const sum = inputData.reduce((acc, val) => acc + val * val, 0);
          const rms = Math.sqrt(sum / inputData.length);
          setVolume(Math.min(rms * 3, 1));
          
          // Convert to Int16 and send
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
          }
          
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(int16Data.buffer);
          }
        };

        source.connect(processor);
        processor.connect(ctx.destination);
        
        setListening(true);
        addMessage('system', 'Microphone active - Speak to the King');
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            
            if (msg.type === 'UserTranscript') {
              addMessage('user', msg.content);
            } else if (msg.type === 'AgentTranscript') {
              addMessage('assistant', msg.content);
              setSpeaking(true);
            } else if (msg.type === 'AgentStartedSpeaking') {
              setSpeaking(true);
            } else if (msg.type === 'AgentFinishedSpeaking') {
              setSpeaking(false);
            } else if (msg.type === 'Error') {
              addMessage('system', `Error: ${msg.message}`);
            }
          } catch (e) {
            console.log('Text message:', event.data);
          }
        } else if (event.data instanceof ArrayBuffer) {
          // Audio data from agent
          const int16Data = new Int16Array(event.data);
          audioQueueRef.current.push(int16Data);
          
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushAudioQueue();
              flushTimerRef.current = null;
            }, 50);
          }
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setError('Connection error to Deepgram');
        setIsConnecting(false);
        addMessage('system', 'Connection error');
      };

      ws.onclose = () => {
        setConnected(false);
        setListening(false);
        setSpeaking(false);
        setIsConnecting(false);
        addMessage('system', 'Disconnected');
        
        // Cleanup
        processorRef.current?.disconnect();
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        
        audioContextRef.current = null;
        processorRef.current = null;
        mediaStreamRef.current = null;
      };

      wsRef.current = ws;
      
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect');
      setIsConnecting(false);
      addMessage('system', `Error: ${err.message}`);
    }
  }, [addMessage, flushAudioQueue, listening, apiKey]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ 
        background: '#0a0a0a',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* SSL Warning Banner */}
      <div 
        className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-3 text-center"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <p className="text-amber-200 text-sm">
          ⚠️ FIRST TIME? Click 
          <a 
            href="https://194.195.215.135:8000" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline font-bold mx-1 hover:text-amber-100"
          >
            HERE TO ACCEPT CERT
          </a> 
          → Click "Advanced" → "Proceed" → Come back and click "Connect"
        </p>
      </div>

      {/* Header */}
      <header 
        className="sticky top-0 z-50 border-b border-white/5"
        style={{ 
          background: 'rgba(10,10,10,0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Crown className="w-6 h-6 text-amber-500" />
              {connected && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              )}
            </div>
            <h1 
              className="text-lg font-light text-white"
              style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}
            >
              OpenClaw Voice
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-gray-500" />
              )}
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                {connected ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4">
        {/* Visualizer */}
        <div 
          className="rounded-3xl p-8 mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(20,20,20,0.8) 0%, rgba(10,10,10,0.9) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.03)',
          }}
        >
          <AudioVisualizer 
            isListening={listening} 
            isSpeaking={speaking} 
            volume={volume} 
          />
        </div>

        {/* Connection Button */}
        <div className="flex justify-center mb-8">
          <motion.button
            onClick={connected ? disconnect : connect}
            disabled={isConnecting}
            className="relative px-8 py-4 rounded-full font-medium text-sm uppercase tracking-wider"
            style={{
              background: connected 
                ? 'rgba(239,68,68,0.9)' 
                : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              color: '#000',
              boxShadow: connected
                ? '0 0 20px rgba(239,68,68,0.3)'
                : '0 0 30px rgba(251,191,36,0.3), 0 4px 14px rgba(0,0,0,0.4)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isConnecting ? (
              <span className="flex items-center gap-2">
                <motion.div 
                  className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                Connecting...
              </span>
            ) : connected ? (
              <span className="flex items-center gap-2">
                <MicOff className="w-4 h-4" />
                Disconnect
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Connect to King
              </span>
            )}
          </motion.button>
        </div>

        {/* Messages */}
        <div 
          className="rounded-2xl p-6 min-h-[200px] max-h-[400px] overflow-y-auto"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <AnimatePresence initial={false}>
            {messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-gray-500 py-12"
              >
                <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Click "Connect to King" to start voice conversation</p>
              </motion.div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`mb-4 ${msg.role === 'user' ? 'text-right' : msg.role === 'system' ? 'text-center' : 'text-left'}`}
                >
                  <div 
                    className={`inline-block max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-amber-500/20 text-amber-200' 
                        : msg.role === 'system'
                        ? 'bg-gray-800/50 text-gray-400 text-xs uppercase tracking-wider'
                        : 'bg-white/5 text-white'
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                    {msg.timestamp && (
                      <span className="text-[10px] opacity-50 mt-1 block">
                        {msg.timestamp}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
          >
            {error}
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-600 text-xs">
        <p>OpenClaw Voice Agent — Powered by Deepgram</p>
      </footer>
    </div>
  );
}
