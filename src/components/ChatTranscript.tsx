'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/app/page';

interface ChatTranscriptProps {
  messages: Message[];
}

export default function ChatTranscript({ messages }: ChatTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div className="w-full max-h-[calc(100vh-120px)] overflow-y-auto flex flex-col gap-2 px-1 pb-2">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`text-sm px-3 py-2 rounded-lg max-w-[85%] ${
            msg.role === 'user'
              ? 'self-end bg-gray-100 text-gray-800'
              : 'self-start bg-white text-gray-800 border border-gray-200'
          }`}
        >
          {msg.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
