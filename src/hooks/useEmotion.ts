import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export type Emotion = 'neutral' | 'happy' | 'proud' | 'thinking' | 'surprised' | 'enthusiastic';

// Morph target names confirmed from model-4.glb (Head_Mesh is in visemeMeshesRef).
// If you change models: check Object.keys(mesh.morphTargetDictionary) in the console.
// All brow/emotion morph control lives here — Avatar.tsx owns bones only.
// Viseme_* targets are handled exclusively by useLipSync and never touched here.
const EMOTION_TARGETS: Record<Emotion, Record<string, number>> = {
  // Resting face — everything zeroed, brows relaxed
  neutral: {
    mouthSmileLeft:   0,
    mouthSmileRight:  0,
    cheekSquintLeft:  0,
    cheekSquintRight: 0,
    eyeSquintLeft:    0,
    eyeSquintRight:   0,
    mouthPressLeft:   0,
    mouthPressRight:  0,
    noseSneerLeft:    0,
    noseSneerRight:   0,
    eyeWideLeft:      0,
    eyeWideRight:     0,
    browDownLeft:     0,
    browDownRight:    0,
    browInnerUp:      0,
    browOuterUpLeft:  0,
    browOuterUpRight: 0,
    mouthFrownLeft:   0,
    mouthFrownRight:  0,
  },

  // Warm conversational smile — clearly visible, Duchenne (cheeks lift with eyes)
  happy: {
    mouthSmileLeft:   0.58,
    mouthSmileRight:  0.58,
    cheekSquintLeft:  0.42,
    cheekSquintRight: 0.42,
    eyeSquintLeft:    0.22,
    eyeSquintRight:   0.22,
    mouthPressLeft:   0,
    mouthPressRight:  0,
    noseSneerLeft:    0,
    noseSneerRight:   0,
    eyeWideLeft:      0,
    eyeWideRight:     0,
    browDownLeft:     0,
    browDownRight:    0,
    browInnerUp:      0.20,
    browOuterUpLeft:  0.16,
    browOuterUpRight: 0.16,
    mouthFrownLeft:   0,
    mouthFrownRight:  0,
  },

  // Quiet pride — controlled smile, tightened lips, slight brow furrow
  proud: {
    mouthSmileLeft:   0.36,
    mouthSmileRight:  0.36,
    cheekSquintLeft:  0.26,
    cheekSquintRight: 0.26,
    eyeSquintLeft:    0.14,
    eyeSquintRight:   0.14,
    mouthPressLeft:   0.40,
    mouthPressRight:  0.40,
    noseSneerLeft:    0.10,
    noseSneerRight:   0.10,
    eyeWideLeft:      0,
    eyeWideRight:     0,
    browDownLeft:     0.30,
    browDownRight:    0.30,
    browInnerUp:      0,
    browOuterUpLeft:  0,
    browOuterUpRight: 0,
    mouthFrownLeft:   0,
    mouthFrownRight:  0,
  },

  // Deep focus — strong brow furrow, pressed lips, squint
  thinking: {
    mouthSmileLeft:   0,
    mouthSmileRight:  0,
    cheekSquintLeft:  0,
    cheekSquintRight: 0,
    eyeSquintLeft:    0.22,
    eyeSquintRight:   0.22,
    mouthPressLeft:   0.45,
    mouthPressRight:  0.45,
    noseSneerLeft:    0,
    noseSneerRight:   0,
    eyeWideLeft:      0,
    eyeWideRight:     0,
    browDownLeft:     0.62,
    browDownRight:    0.62,
    browInnerUp:      0.22,
    browOuterUpLeft:  0,
    browOuterUpRight: 0,
    mouthFrownLeft:   0.16,
    mouthFrownRight:  0.16,
  },

  // Genuine surprise — wide eyes, brows raised high, slight jaw drop
  surprised: {
    mouthSmileLeft:   0,
    mouthSmileRight:  0,
    cheekSquintLeft:  0,
    cheekSquintRight: 0,
    eyeSquintLeft:    0,
    eyeSquintRight:   0,
    mouthPressLeft:   0,
    mouthPressRight:  0,
    noseSneerLeft:    0,
    noseSneerRight:   0,
    eyeWideLeft:      0.88,
    eyeWideRight:     0.88,
    browDownLeft:     0,
    browDownRight:    0,
    browInnerUp:      0.72,
    browOuterUpLeft:  0.60,
    browOuterUpRight: 0.60,
    mouthFrownLeft:   0,
    mouthFrownRight:  0,
  },

  // Lit up — big smile, cheeks high, eyes bright
  enthusiastic: {
    mouthSmileLeft:   0.70,
    mouthSmileRight:  0.70,
    cheekSquintLeft:  0.55,
    cheekSquintRight: 0.55,
    eyeSquintLeft:    0.28,
    eyeSquintRight:   0.28,
    mouthPressLeft:   0,
    mouthPressRight:  0,
    noseSneerLeft:    0,
    noseSneerRight:   0,
    eyeWideLeft:      0.18,
    eyeWideRight:     0.18,
    browDownLeft:     0,
    browDownRight:    0,
    browInnerUp:      0.34,
    browOuterUpLeft:  0.28,
    browOuterUpRight: 0.28,
    mouthFrownLeft:   0,
    mouthFrownRight:  0,
  },
};

// Slower lerp = more gradual, more human-like emotion transitions
const LERP_SPEED = 0.06;
// Brow morphs lerp faster so speech emphasis feels snappy
const BROW_LERP_SPEED = 0.09;

export function useEmotion(
  meshesRef: React.RefObject<THREE.Mesh[]>,
  emotion: Emotion,
  isSpeaking: boolean
) {
  const emotionRef   = useRef(emotion);
  emotionRef.current = emotion;
  const speakingRef   = useRef(isSpeaking);
  speakingRef.current = isSpeaking;

  // Phase seeds — random offsets make each brow segment move independently
  const innerPhase  = useRef(Math.random() * Math.PI * 2);
  const outerLPhase = useRef(Math.random() * Math.PI * 2 + 1.1);
  const outerRPhase = useRef(Math.random() * Math.PI * 2 + 2.3);

  // Slow random brow drift — changes every few seconds for organic baseline variation
  const driftVal     = useRef(0);
  const driftTarget  = useRef(0);
  const nextDriftAt  = useRef(1.5 + Math.random() * 2.5);

  // Micro-expression state — occasional subtle mouth/cheek twitches
  const nextMicroAt    = useRef(4 + Math.random() * 4);
  const microTarget    = useRef(0);
  const microCurrent   = useRef(0);
  // Only non-brow morphs — brows are handled above
  const microMorphName = useRef('mouthPressLeft');

  useFrame(({ clock }) => {
    const t       = clock.getElapsedTime();
    const meshes  = meshesRef.current;
    if (!meshes || meshes.length === 0) return;


    const speaking = speakingRef.current;
    const base     = EMOTION_TARGETS[emotionRef.current] ?? EMOTION_TARGETS.neutral;

    // ── Slow brow drift ─────────────────────────────────────────────────────
    if (t > nextDriftAt.current) {
      driftTarget.current = (Math.random() * 2 - 1) * 0.035;
      nextDriftAt.current = t + 1.8 + Math.random() * 3.0;
    }
    driftVal.current += (driftTarget.current - driftVal.current) * 0.018;

    // ── Speech brow targets ──────────────────────────────────────────────────
    // Two-frequency oscillation per region — feels like natural emphasis variation,
    // not a metronome. Inner brow is more reactive; outers drift more lazily.
    // Magnitudes kept small so the emotion base shape is always dominant.
    let browInnerAdd  = driftVal.current;
    let browOuterLAdd = 0;
    let browOuterRAdd = 0;
    let browDownAdd   = 0;

    if (speaking) {
      const ip = innerPhase.current;
      const lp = outerLPhase.current;
      const rp = outerRPhase.current;

      // Inner brow: faster, sharper (emphasis on stressed words)
      browInnerAdd += Math.sin(t * 2.1 + ip)       * 0.07
                    + Math.sin(t * 0.9 + ip * 1.4)  * 0.045;

      // Outer brows: slower, gentler, async from each other
      browOuterLAdd = Math.sin(t * 1.2 + lp)       * 0.045
                    + Math.sin(t * 0.5 + lp * 0.8)  * 0.03;
      browOuterRAdd = Math.sin(t * 1.2 + rp)       * 0.045
                    + Math.sin(t * 0.5 + rp * 0.8)  * 0.03;

      // Occasional micro-furrow — brows come down briefly on certain words
      const furrow = Math.max(0, Math.sin(t * 1.7 + 1.8)) * 0.05;
      browDownAdd  = furrow;
    }

    // ── Micro-expressions (mouth/cheek only) ────────────────────────────────
    if (t > nextMicroAt.current) {
      const options = ['mouthPressLeft', 'cheekSquintLeft', 'cheekSquintRight'];
      microMorphName.current = options[Math.floor(Math.random() * options.length)];
      microTarget.current    = 0.04 + Math.random() * 0.06;
      nextMicroAt.current    = t + 3.5 + Math.random() * 5;
      setTimeout(() => { microTarget.current = 0; }, 350 + Math.random() * 300);
    }
    microCurrent.current += (microTarget.current - microCurrent.current) * 0.08;

    // ── Apply to meshes ──────────────────────────────────────────────────────
    for (const mesh of meshes) {
      const dict = mesh.morphTargetDictionary;
      const inf  = mesh.morphTargetInfluences;
      if (!dict || !inf) continue;

      // Non-brow emotion morphs — standard lerp toward base target
      for (const [name, target] of Object.entries(base)) {
        if (name.startsWith('brow')) continue; // handled separately below
        const idx = dict[name];
        if (idx === undefined) continue;
        inf[idx] += (target - inf[idx]) * LERP_SPEED;
      }

      // Brow morphs — emotion base + speech/drift addition, clamped [0,1]
      const setB = (name: string, baseVal: number, add: number) => {
        const idx = dict[name];
        if (idx === undefined) return;
        const target = Math.max(0, Math.min(1, baseVal + add));
        inf[idx] += (target - inf[idx]) * BROW_LERP_SPEED;
      };

      setB('browInnerUp',      base.browInnerUp      ?? 0, browInnerAdd);
      setB('browOuterUpLeft',  base.browOuterUpLeft   ?? 0, browOuterLAdd);
      setB('browOuterUpRight', base.browOuterUpRight  ?? 0, browOuterRAdd);
      setB('browDownLeft',     base.browDownLeft      ?? 0, browDownAdd);
      setB('browDownRight',    base.browDownRight     ?? 0, browDownAdd);

      // Micro-expression (additive on top of current value, not override)
      const mIdx = dict[microMorphName.current];
      if (mIdx !== undefined) {
        inf[mIdx] += (microCurrent.current - inf[mIdx]) * 0.08;
      }
    }
  });
}
