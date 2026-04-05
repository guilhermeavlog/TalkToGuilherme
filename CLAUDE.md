# TalkToGuilherme — Project Context

## What This Is

A personal recruiter-facing website featuring a real-time 3D talking avatar of Guilherme that answers questions verbally. Recruiters visit the site, ask questions by voice, and the avatar responds with synthesized speech and lip-synced mouth animation.

## Pipeline

```
Microphone → STT → LLM (Claude) → TTS → 3D Talking Head
```

1. **Voice Capture** — browser MediaRecorder API records audio
2. **STT** — OpenAI Whisper API (server-side) transcribes audio to text
3. **LLM** — Claude API (Anthropic) generates a response as Guilherme
4. **TTS** — ElevenLabs API synthesizes speech (supports voice cloning so it sounds like Guilherme); returns audio + viseme timing data
5. **3D Talking Head** — React Three Fiber renders a GLB avatar (Ready Player Me or custom), lip-synced via viseme morph targets driven by ElevenLabs timing

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js (App Router) | API routes protect keys; React frontend; easy deployment |
| 3D Rendering | React Three Fiber + @react-three/drei | Declarative Three.js in React |
| Avatar | Custom FBX (`model.fbx`) | Guilherme's own 3D model already in the project root |
| STT | OpenAI Whisper API | Accurate, server-side (key protected) |
| LLM | Anthropic Claude API | claude-sonnet-4-6 or claude-haiku-4-5 for speed |
| TTS | ElevenLabs API | Voice cloning + returns viseme timing alongside audio |
| Lip Sync | ElevenLabs viseme data → Three.js morph targets | Syncs mouth shapes to audio frames |
| Styling | Tailwind CSS | Fast utility-first styling |

## Project Structure

```
TalkToGuilherme/
├── CLAUDE.md
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── .env.local              # API keys (never commit)
├── public/
│   └── avatar/
│       └── model.fbx       # Guilherme's custom 3D model (copy from project root)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx        # Main recruiter UI
│   │   └── api/
│   │       ├── transcribe/
│   │       │   └── route.ts    # POST: audio → Whisper → text
│   │       ├── chat/
│   │       │   └── route.ts    # POST: text → Claude → response text (streaming)
│   │       └── speak/
│   │           └── route.ts    # POST: text → ElevenLabs → audio + visemes
│   ├── components/
│   │   ├── Avatar.tsx          # React Three Fiber 3D head with morph targets
│   │   ├── Scene.tsx           # Canvas, lighting, camera setup
│   │   ├── VoiceButton.tsx     # Hold-to-talk UI button
│   │   └── ChatTranscript.tsx  # Optional: shows conversation history
│   ├── hooks/
│   │   ├── useVoiceRecorder.ts # MediaRecorder logic
│   │   └── useLipSync.ts       # Drives morph targets from viseme schedule
│   └── lib/
│       ├── anthropic.ts        # Anthropic client singleton
│       ├── elevenlabs.ts       # ElevenLabs client helpers
│       └── persona.ts          # Guilherme's system prompt / persona
```

## Environment Variables

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=          # for Whisper STT
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=     # Guilherme's cloned voice ID
```

## Persona / System Prompt

The LLM is prompted to respond as Guilherme — a software engineer. The system prompt in `src/lib/persona.ts` should include:
- His background, skills, experience, and projects
- Personality and tone (professional but friendly)
- How to handle questions he can't answer (redirect gracefully)
- Keep answers concise for voice delivery (2–4 sentences)

## Key Implementation Notes

### Lip Sync
- ElevenLabs `/v1/text-to-speech/{voice_id}/with-timestamps` endpoint returns both audio and character/phoneme timestamps
- Map phonemes → viseme IDs → Three.js morph target names on the RPM avatar
- Morph target names depend on what's baked into `model.fbx` — inspect them at load time via `Object.keys(mesh.morphTargetDictionary)` and map accordingly
- Schedule morph target weight transitions using `requestAnimationFrame` timed against `AudioContext.currentTime`

### Latency Strategy
- Use streaming for Claude response (`stream: true`) — start TTS as soon as first sentence is complete
- Sentence-chunk the stream: detect `.`, `?`, `!` → send each sentence to ElevenLabs immediately
- Queue audio chunks and viseme schedules; play sequentially

### Avatar Setup
1. Copy `model.fbx` from the project root to `public/avatar/model.fbx`
2. Load with `useFBX` from `@react-three/drei`
3. At load time, inspect morph target names: `Object.keys(mesh.morphTargetDictionary)` — build the phoneme→viseme map from whatever targets are present
4. If the FBX has no morph targets, jaw-bone animation is the fallback (animate the jaw bone rotation to open/close mouth in sync with audio)

### Audio Pipeline
- `MediaRecorder` → `Blob` (webm/ogg) → POST to `/api/transcribe` → Whisper returns text
- Text → POST to `/api/chat` (streaming) → Claude returns text chunks
- Sentence chunks → POST to `/api/speak` → ElevenLabs returns `{ audio: base64, visemes: [...] }`
- Frontend decodes audio via `Web Audio API`, plays it, drives morph targets in sync

## Build Order

1. Init Next.js project with TypeScript + Tailwind
2. Set up 3D scene with static avatar (no talking yet)
3. Add voice recording → transcription pipeline
4. Add Claude chat API route with persona system prompt
5. Add ElevenLabs TTS route
6. Wire up lip sync (visemes → morph targets)
7. Connect full pipeline end-to-end
8. Polish UI for recruiter experience
9. Deploy (Vercel recommended)

## Deployment

Vercel is the natural choice for Next.js. Add env vars in Vercel dashboard. Note: ElevenLabs audio responses can be large — ensure Vercel function timeout is sufficient (max 60s on Pro plan).
