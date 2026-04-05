import { NextRequest, NextResponse } from 'next/server';
import { synthesizeSpeech } from '@/lib/elevenlabs';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const { audio, visemes } = await synthesizeSpeech(text);
    return NextResponse.json({ audio, visemes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/speak]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
