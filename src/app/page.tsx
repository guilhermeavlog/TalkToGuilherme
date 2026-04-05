'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import StatusIndicator from '@/components/StatusIndicator';
import ChatTranscript from '@/components/ChatTranscript';
import { useAutoVoice } from '@/hooks/useAutoVoice';
import { Emotion } from '@/hooks/useEmotion';
import SuggestedQuestions from '@/components/SuggestedQuestions';

const Scene = dynamic(() => import('@/components/Scene'), { ssr: false });

export type Message = { role: 'user' | 'assistant'; text: string };

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [visemes, setVisemes] = useState<{ viseme: string; time: number }[]>([]);
  const [audioStartTime, setAudioStartTime] = useState<number>(0);
  const [emotion, setEmotion] = useState<Emotion>('neutral');

  // Single shared AudioContext — created once, reused across all responses.
  // Must be resumed after a user gesture to satisfy browser autoplay policy.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  }, []);

  // Track current in-flight request and playing source so we can cancel both
  const abortRef        = useRef<AbortController | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const cancelCurrent = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.onended = null; currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // Any click/touch on the page unlocks audio for the whole session
  const unlockAudio = useCallback(() => {
    getAudioCtx().resume();
  }, [getAudioCtx]);

  const handleTranscript = useCallback(async (userText: string) => {
    // Cancel any in-progress fetch or playing audio before starting fresh
    cancelCurrent();
    setIsSpeaking(false);

    const abort = new AbortController();
    abortRef.current = abort;

    // 1. Add user message, reset emotion to thinking while waiting
    let currentMessages: Message[] = [];
    setMessages((prev) => {
      currentMessages = prev;
      return [...prev, { role: 'user', text: userText }];
    });
    setEmotion('thinking');

    try {
      // 2. Claude
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...currentMessages, { role: 'user', text: userText }] }),
        signal: abort.signal,
      });
      const { reply, emotion: responseEmotion, error: chatError } = await chatRes.json();
      if (chatError) throw new Error(chatError);
      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
      setEmotion((responseEmotion as Emotion) ?? 'neutral');

      // 3. TTS
      const speakRes = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply }),
        signal: abort.signal,
      });
      const { audio, visemes: visemeData, error: speakError } = await speakRes.json();
      if (speakError) throw new Error(speakError);

      // 4. Play audio — resume first to satisfy autoplay policy
      if (abort.signal.aborted) return;
      const audioCtx = getAudioCtx();
      await audioCtx.resume();

      const binaryStr = atob(audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const buffer = await audioCtx.decodeAudioData(bytes.buffer);

      if (abort.signal.aborted) return;
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      currentSourceRef.current = source;

      setVisemes(visemeData ?? []);
      setIsSpeaking(true);
      setAudioStartTime(performance.now());
      source.start();
      source.onended = () => {
        currentSourceRef.current = null;
        setIsSpeaking(false);
        setEmotion('neutral');
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // cancelled — ignore
      console.error('Pipeline error:', err);
      setIsSpeaking(false);
      setEmotion('neutral');
    }
  }, [getAudioCtx, cancelCurrent]);

  const { status } = useAutoVoice(handleTranscript, isSpeaking);

  const [textInput, setTextInput] = useState('');
  const submitText = useCallback(() => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    setTextInput('');
    handleTranscript(trimmed);
  }, [textInput, handleTranscript]);

  return (
    <main
      className="relative h-screen text-gray-900 overflow-hidden" style={{ backgroundColor: '#0F172A' }}
      onClick={unlockAudio}
      onTouchStart={unlockAudio}
    >
      {/* ── DESKTOP LAYOUT (md+) ── */}

      {/* Name + tagline — fixed top-left, desktop only */}
      <div className="hidden md:block fixed top-10 left-10 z-10">
        <p className="text-white/60 text-sm font-medium tracking-widest uppercase mb-2">Guilherme Loges</p>
        <p className="text-white font-bold text-xl tracking-tight leading-snug max-w-xs">Full-Stack Engineer specializing in AI</p>
        <p className="text-white/50 text-sm mt-2">Enable microphone and chat with my AI clone by voice</p>
        <ul className="mt-3 flex flex-col gap-1.5">
          <li className="flex items-center gap-2 text-white/70 text-xs">
            <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
            Whisper STT → Claude LLM → ElevenLabs TTS → 3D lip-sync pipeline
          </li>
          <li className="flex items-center gap-2 text-white/70 text-xs">
            <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
            Real-time viseme morph targets in React Three Fiber · voice cloning
          </li>
          <li className="flex items-center gap-2 text-white/70 text-xs">
            <span className="w-1 h-1 rounded-full bg-violet-400 flex-shrink-0" />
            Next.js App Router · server-side AI keys · sub-2s response latency
          </li>
        </ul>
        <div className="flex gap-3 mt-5">
          <a
            href="/resume.pdf"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-violet-600/80 hover:bg-violet-600 text-white text-sm font-medium transition-all duration-200 backdrop-blur-sm border border-violet-500/50 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 hover:-translate-y-0.5 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM12 17l-4-4h2.5v-3h3v3H16l-4 4z" />
            </svg>
            Resume
          </a>
          <a
            href="https://github.com/guilhermeavlog"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all duration-200 backdrop-blur-sm border border-white/10 shadow-lg shadow-black/20 hover:shadow-black/40 hover:-translate-y-0.5 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            GitHub
          </a>
          <a
            href="https://linkedin.com/in/guilhermeloges"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A66C2] hover:bg-[#0952a0] text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-[#0A66C2]/30 hover:shadow-[#0A66C2]/50 hover:-translate-y-0.5 active:scale-95"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
        </div>
      </div>

      {/* Canvas — desktop: anchored to bottom; mobile: full screen behind content */}
      <div className="fixed bottom-0 left-0 right-0 h-[70vh] md:h-[70vh]">
        <Scene isSpeaking={isSpeaking} visemes={visemes} audioStartTime={audioStartTime} />
      </div>

      {/* Conversation — fixed top-right, desktop only */}
      <div className="hidden md:block fixed top-4 right-4 w-80 z-10">
        <ChatTranscript messages={messages} />
      </div>

      {/* Suggested questions — fixed left-center, desktop only */}
      <div className="hidden md:block fixed left-10 top-80 z-10">
        <SuggestedQuestions onSelect={handleTranscript} />
      </div>

      {/* Status indicator — fixed bottom-center, desktop only */}
      <div className="hidden md:block fixed bottom-8 left-1/2 -translate-x-1/2 z-10">
        <StatusIndicator status={status} />
      </div>

      {/* Text input — fixed bottom-right, desktop only */}
      <div className="hidden md:flex fixed bottom-8 right-8 z-10 flex-col items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); submitText(); }}
          className="flex items-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-5 py-3 gap-3 w-80"
        >
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-gray-700 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 translate-x-px">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <p className="text-white/70 text-xs">or speak using the microphone</p>
      </div>

      {/* ── MOBILE LAYOUT (below md) ── */}
      <div className="md:hidden fixed inset-0 z-10 flex flex-col pointer-events-none">
        {/* Top: name + buttons */}
        <div className="pointer-events-auto px-5 pt-10 pb-2">
          <p className="text-white/60 text-xs font-medium tracking-widest uppercase">Guilherme Loges</p>
          <p className="text-white font-bold text-base leading-snug mt-0.5">Full-Stack Engineer · AI & Real-time Systems</p>
          <div className="flex gap-2 mt-3">
            <a
              href="/resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/80 text-white text-xs font-medium active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM12 17l-4-4h2.5v-3h3v3H16l-4 4z" />
              </svg>
              Resume
            </a>
            <a
              href="https://github.com/guilhermeavlog"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
            <a
              href="https://linkedin.com/in/guilhermeloges"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A66C2] text-white text-xs font-medium active:scale-95"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
          </div>
        </div>

        {/* Spacer — avatar shows through here */}
        <div className="flex-1" />

        {/* Bottom: chat + input + status */}
        <div className="pointer-events-auto px-4 pb-6 flex flex-col gap-3">
          {/* Conversation */}
          {messages.length > 0 && (
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-3 max-h-40 overflow-y-auto flex flex-col gap-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-xs px-3 py-1.5 rounded-lg max-w-[85%] ${
                    msg.role === 'user'
                      ? 'self-end bg-gray-100 text-gray-800'
                      : 'self-start bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          )}

          {/* Suggested questions — horizontal scroll on mobile */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {["Tell me about yourself", "Your experience?", "Your projects?", "Role you're seeking?"].map((q) => (
              <button
                key={q}
                onClick={() => handleTranscript(q)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/90 text-gray-800 text-xs font-medium active:scale-95"
              >
                {q}
              </button>
            ))}
            <a
              href="mailto:guilhermeloges@gmail.com"
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-semibold active:scale-95"
            >
              Hire Me
            </a>
          </div>

          {/* Text input + status */}
          <div className="flex items-center gap-2">
            <StatusIndicator status={status} />
            <form
              onSubmit={(e) => { e.preventDefault(); submitText(); }}
              className="flex-1 flex items-center bg-white/90 backdrop-blur-sm rounded-full shadow-lg px-4 py-2.5 gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"
              />
              <button
                type="submit"
                disabled={!textInput.trim()}
                className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              >
                <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5 translate-x-px">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
