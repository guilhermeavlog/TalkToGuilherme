# TalkToGuilherme

A recruiter-facing portfolio where a 3D lip-synced avatar of me answers questions by voice in real time.

## Demo

Ask anything — by voice or text. The avatar listens, thinks, and responds with synthesized speech and synchronized mouth animation.

## How It Works

```
Microphone → Whisper STT → Claude LLM → ElevenLabs TTS → 3D Lip-Sync
```

1. **Voice Capture** — browser MediaRecorder API records audio
2. **STT** — OpenAI Whisper transcribes speech to text (server-side)
3. **LLM** — Claude generates a response as me, including an emotion tag
4. **TTS** — ElevenLabs synthesizes speech with my cloned voice, returns audio + viseme timing
5. **3D Avatar** — React Three Fiber renders a GLB avatar with real-time morph target lip-sync driven by viseme data

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| 3D Rendering | React Three Fiber + @react-three/drei |
| STT | OpenAI Whisper API |
| LLM | Anthropic Claude (claude-haiku-4-5) |
| TTS + Voice Clone | ElevenLabs API |
| Lip Sync | ElevenLabs viseme timestamps → Three.js morph targets |
| Styling | Tailwind CSS |
| Deployment | Vercel |

## Running Locally

```bash
npm install
```

Create a `.env.local` file:

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

```bash
npm run dev
```

## Key Implementation Details

- **Emotion system** — Claude returns a JSON object with `message` and `emotion` fields. The avatar drives ARKit morph targets (browInnerUp, mouthSmileLeft, etc.) based on the emotion, blended in real time via `useFrame`.
- **Lip sync** — ElevenLabs `/v1/text-to-speech/{id}/with-timestamps` returns character-level timing data mapped to viseme morph targets and scheduled against `AudioContext.currentTime`.
- **Cancellation** — any new prompt immediately aborts the in-flight fetch and stops the playing audio source before starting fresh, preventing overlapping responses.
- **Server-side API routes** — all API keys are protected behind Next.js route handlers, never exposed to the client.

## Built By

Guilherme Loges — [guilhermeloges@gmail.com](mailto:guilhermeloges@gmail.com) · [LinkedIn](https://linkedin.com/in/guilhermeloges) · [GitHub](https://github.com/guilhermeavlog)
