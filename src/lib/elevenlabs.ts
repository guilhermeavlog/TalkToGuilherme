// Phoneme → viseme mapping (standard set used by most 3D rigs)
const PHONEME_TO_VISEME: Record<string, string> = {
  // Bilabials
  p: 'viseme_PP', b: 'viseme_PP', m: 'viseme_PP',
  // Labiodentals
  f: 'viseme_FF', v: 'viseme_FF',
  // Dentals
  θ: 'viseme_TH', ð: 'viseme_TH',
  // Alveolars
  t: 'viseme_DD', d: 'viseme_DD', n: 'viseme_nn', l: 'viseme_nn',
  // Velars
  k: 'viseme_kk', g: 'viseme_kk', ŋ: 'viseme_kk',
  // Affricates / sibilants
  tʃ: 'viseme_CH', dʒ: 'viseme_CH', ʃ: 'viseme_CH', ʒ: 'viseme_CH',
  s: 'viseme_SS', z: 'viseme_SS',
  // Rhotic
  r: 'viseme_RR',
  // Vowels
  æ: 'viseme_aa', a: 'viseme_aa', ɑ: 'viseme_aa',
  e: 'viseme_E', ɛ: 'viseme_E',
  i: 'viseme_I', ɪ: 'viseme_I',
  o: 'viseme_O', ɔ: 'viseme_O',
  u: 'viseme_U', ʊ: 'viseme_U',
};

export type VisemeEvent = { viseme: string; time: number };

export async function synthesizeSpeech(text: string): Promise<{
  audio: string; // base64 encoded mp3
  visemes: VisemeEvent[];
}> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();

  // data.audio_base64 — the mp3 audio
  // data.alignment.characters / .character_start_times_seconds — phoneme timing
  const characters: string[] = data.alignment?.characters ?? [];
  const times: number[] = data.alignment?.character_start_times_seconds ?? [];

  const visemes: VisemeEvent[] = characters
    .map((char, i) => {
      const viseme = PHONEME_TO_VISEME[char.toLowerCase()];
      return viseme ? { viseme, time: times[i] } : null;
    })
    .filter(Boolean) as VisemeEvent[];

  return { audio: data.audio_base64, visemes };
}
