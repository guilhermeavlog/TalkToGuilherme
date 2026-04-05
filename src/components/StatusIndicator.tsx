'use client';

import type { VoiceStatus } from '@/hooks/useAutoVoice';

const CONFIG: Record<VoiceStatus, { label: string; color: string; pulse: boolean }> = {
  idle:       { label: 'Starting…',                                      color: 'bg-gray-300',  pulse: false },
  listening:  { label: 'Listening',                                       color: 'bg-green-400', pulse: true  },
  recording:  { label: 'Hearing you…',                                    color: 'bg-red-500',   pulse: true  },
  processing: { label: 'Thinking…',                                       color: 'bg-blue-400',  pulse: true  },
  denied:     { label: 'Mic blocked — allow access in browser & reload',  color: 'bg-orange-400',pulse: false },
};

export default function StatusIndicator({ status }: { status: VoiceStatus }) {
  const { label, color, pulse } = CONFIG[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
