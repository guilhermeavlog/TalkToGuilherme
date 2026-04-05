import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '@/lib/persona';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type Emotion = 'neutral' | 'happy' | 'proud' | 'thinking' | 'surprised' | 'enthusiastic';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const formattedMessages = messages.map((m: { role: string; text: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.text,
    }));

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();

    let message: string;
    let emotion: Emotion;
    try {
      // Strip markdown code fences if Claude wraps the JSON
      const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      // Strip any em/en dashes that slipped through — replace with a space
      message = (parsed.message ?? raw).replace(/[—–]/g, ' ');
      emotion = parsed.emotion ?? 'neutral';
    } catch {
      // Fallback: treat entire response as plain message
      console.warn('[/api/chat] Failed to parse JSON from Claude, using raw text');
      message = raw;
      emotion = 'neutral';
    }

    return NextResponse.json({ reply: message, emotion });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/chat]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
