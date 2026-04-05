import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type VisemeEvent = { viseme: string; time: number };

const LERP_SPEED = 0.12; // fraction to move per frame toward target (at 60fps)

/**
 * Each frame, finds the currently active viseme (most recent one whose time
 * has passed) and smoothly lerps viseme_* morph target weights toward it.
 * Only touches viseme_* targets — emotion and expression targets are left alone
 * so useEmotion can run in parallel without fighting.
 */
export function useLipSync(
  meshesRef: React.RefObject<THREE.Mesh[]>,
  visemes: VisemeEvent[],
  audioStartWallTime: number,
  isSpeaking: boolean
) {
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const meshes = meshesRef.current;
    if (!isSpeaking || !meshes || meshes.length === 0 || visemes.length === 0) return;

    const lastEventTime = visemes[visemes.length - 1].time;

    const tick = () => {
      const elapsed = (performance.now() - audioStartWallTime) / 1000;

      // Find the currently active viseme — the most recent one that has started
      let activeViseme = '';
      for (let i = 0; i < visemes.length; i++) {
        if (visemes[i].time <= elapsed) activeViseme = visemes[i].viseme;
        else break;
      }

      for (const mesh of meshes) {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;
        if (!dict || !influences) continue;

        // Decay only viseme_* targets toward 0 — leave emotion targets untouched
        for (const [name, idx] of Object.entries(dict)) {
          if (name.startsWith('viseme_')) {
            influences[idx] += (0 - influences[idx]) * LERP_SPEED;
          }
        }

        // Lerp the active viseme toward 1 (rise)
        if (activeViseme) {
          const idx = dict[activeViseme];
          if (idx !== undefined) {
            influences[idx] += (1.0 - influences[idx]) * LERP_SPEED;
          }
        }
      }

      // Keep running until 0.5s after the last viseme, then fade out
      if (elapsed < lastEventTime + 0.5) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Only zero viseme_* targets on fadeout — don't touch emotion targets
        for (const mesh of meshes) {
          const dict = mesh.morphTargetDictionary;
          const influences = mesh.morphTargetInfluences;
          if (!dict || !influences) continue;
          for (const [name, idx] of Object.entries(dict)) {
            if (name.startsWith('viseme_')) influences[idx] = 0;
          }
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      // Only zero viseme_* targets on cleanup
      const m = meshesRef.current;
      if (m) for (const mesh of m) {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;
        if (!dict || !influences) continue;
        for (const [name, idx] of Object.entries(dict)) {
          if (name.startsWith('viseme_')) influences[idx] = 0;
        }
      }
    };
  }, [isSpeaking, visemes, audioStartWallTime, meshesRef]);
}
