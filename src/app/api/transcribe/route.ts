import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
    }

    // Read fully into memory
    const arrayBuffer = await audioFile.arrayBuffer();

    // Call Whisper via native fetch — avoids OpenAI SDK connection issues in Next.js
    const body = new FormData();
    body.append('file', new Blob([arrayBuffer], { type: audioFile.type || 'audio/webm' }), 'recording.webm');
    body.append('model', 'whisper-1');
    body.append('language', 'en');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[/api/transcribe] OpenAI error:', response.status, errText);
      return NextResponse.json({ error: errText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ text: data.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[/api/transcribe]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
