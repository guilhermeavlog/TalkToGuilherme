'use client';

interface VoiceButtonProps {
  isRecording: boolean;
  isSpeaking: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function VoiceButton({ isRecording, isSpeaking, onStart, onStop }: VoiceButtonProps) {
  const disabled = isSpeaking;

  return (
    <button
      onMouseDown={onStart}
      onMouseUp={onStop}
      onTouchStart={onStart}
      onTouchEnd={onStop}
      disabled={disabled}
      className={`
        w-16 h-16 rounded-full border-2 transition-all duration-150 select-none
        flex items-center justify-center
        ${isRecording
          ? 'bg-red-600 border-red-400 scale-110 shadow-lg shadow-red-500/40'
          : disabled
          ? 'bg-gray-200 border-gray-300 opacity-50 cursor-not-allowed'
          : 'bg-gray-100 border-gray-300 hover:bg-gray-200 cursor-pointer text-gray-700'
        }
      `}
      aria-label="Hold to speak"
    >
      {/* Microphone icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-7 h-7"
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
      </svg>
    </button>
  );
}
