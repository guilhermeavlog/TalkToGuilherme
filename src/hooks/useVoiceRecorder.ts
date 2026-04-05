import { useState, useRef, useCallback } from 'react';

export function useVoiceRecorder(onRecordingComplete: (blob: Blob) => Promise<void>) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      alert('Microphone access is only available on localhost or HTTPS.');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Some browsers don't support audio/webm — fall back to default mimeType
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
      stream.getTracks().forEach((t) => t.stop());
      await onRecordingComplete(blob);
    };

    mediaRecorder.start();
    setIsRecording(true);
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording };
}
