import { useEffect, useRef, useState } from 'react';

export type VoiceStatus = 'idle' | 'listening' | 'recording' | 'processing' | 'denied';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export function useAutoVoice(
  onTranscript: (text: string) => Promise<void>,
  muted: boolean
) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const callbackRef      = useRef(onTranscript);
  const mutedRef         = useRef(muted);
  const processingRef    = useRef(false);
  const deniedRef        = useRef(false);           // stops the restart loop on permission denial
  const recognitionRef   = useRef<SpeechRecognition | null>(null);

  useEffect(() => { callbackRef.current = onTranscript; }, [onTranscript]);

  useEffect(() => {
    mutedRef.current = muted;
    const rec = recognitionRef.current;
    if (!rec || deniedRef.current) return;

    if (muted) {
      try { rec.abort(); } catch {}
      setStatus('idle');
    } else if (!processingRef.current) {
      try { rec.start(); } catch {}
      setStatus('listening');
    }
  }, [muted]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported — use Chrome or Edge.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    recognitionRef.current = rec;

    const tryRestart = () => {
      if (deniedRef.current || mutedRef.current || processingRef.current) return;
      setStatus('listening');
      try { rec.start(); } catch {}
    };

    rec.onstart       = () => { if (!mutedRef.current && !processingRef.current) setStatus('listening'); };
    rec.onspeechstart = () => { if (!mutedRef.current && !processingRef.current) setStatus('recording'); };

    rec.onresult = async (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim();
      if (!transcript) return;

      processingRef.current = true;
      setStatus('processing');
      try {
        await callbackRef.current(transcript);
      } catch (err) {
        console.error('Pipeline error:', err);
      } finally {
        processingRef.current = false;
        tryRestart();
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // Permission denied — stop the loop immediately
        deniedRef.current = true;
        setStatus('denied');
        console.error('Microphone permission denied. Allow access in browser settings and reload.');
        return;
      }
      // 'no-speech' and 'aborted' are expected — ignore
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('SpeechRecognition error:', event.error);
      }
    };

    rec.onend = tryRestart;  // restart unless denied / muted / processing

    if (!muted) {
      try { rec.start(); } catch {}
      setStatus('listening');
    }

    return () => { try { rec.abort(); } catch {} };
  }, []);

  return { status };
}
