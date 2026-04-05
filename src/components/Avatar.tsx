'use client';

import { useRef, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useLipSync, VisemeEvent } from '@/hooks/useLipSync';
import { useEmotion, Emotion } from '@/hooks/useEmotion';

interface AvatarProps {
  isSpeaking: boolean;
  visemes: VisemeEvent[];
  audioStartTime: number;
  emotion: Emotion;
}

const BLINK_INTERVAL_MIN = 2.5;
const BLINK_INTERVAL_MAX = 6.0;
const BLINK_CLOSE        = 0.07;
const BLINK_HOLD         = 0.04;
const BLINK_OPEN         = 0.10;
const BLINK_TOTAL        = BLINK_CLOSE + BLINK_HOLD + BLINK_OPEN;

const EYE_DRIFT_SPEED    = 0.18;
const EYE_TARGET_INTERVAL = 3.2;
const EYE_RANGE_H        = 0.06;
const EYE_RANGE_V        = 0.03;

export default function Avatar({ isSpeaking, visemes, audioStartTime, emotion }: AvatarProps) {
  const { scene: fbx }   = useGLTF('/avatar/model-4.glb');
  const groupRef         = useRef<THREE.Group>(null);
  const visemeMeshesRef  = useRef<THREE.Mesh[]>([]);
  const emotionMeshesRef = useRef<THREE.Mesh[]>([]);
  const bonesRef         = useRef<Record<string, THREE.Bone>>({});
  const setupDone        = useRef(false);
  const speakBlend       = useRef(0);

  // Blink
  const nextBlinkAt  = useRef(BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN));
  const blinkStart   = useRef<number | null>(null);

  // Eye look-around
  const eyeTargetH     = useRef(0);
  const eyeTargetV     = useRef(0);
  const eyeCurrentH    = useRef(0);
  const eyeCurrentV    = useRef(0);
  const nextEyeShiftAt = useRef(EYE_TARGET_INTERVAL * Math.random());
  const leftEyeBone    = useRef<THREE.Bone | null>(null);
  const rightEyeBone   = useRef<THREE.Bone | null>(null);


  useEffect(() => {
    if (!fbx || setupDone.current) return;
    setupDone.current = true;

    // Scale & center
    const box = new THREE.Box3().setFromObject(fbx);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = Math.max(size.x, size.y, size.z) > 0 ? 2 / Math.max(size.x, size.y, size.z) : 1;
    fbx.scale.setScalar(scale);
    box.setFromObject(fbx);
    const center = new THREE.Vector3();
    box.getCenter(center);
    fbx.position.set(-center.x, -box.min.y, -1.2);

    // Collect meshes and bones
    fbx.traverse((child) => {
      if (child instanceof THREE.Mesh && child.morphTargetDictionary) {
        const keys = Object.keys(child.morphTargetDictionary);
        if (keys.some(k => k.startsWith('viseme_')))           visemeMeshesRef.current.push(child);
        if (keys.includes('mouthSmileLeft') || keys.includes('browInnerUp')) emotionMeshesRef.current.push(child);
      }

      if (!(child instanceof THREE.Bone)) return;
      const name = child.name;

      if (['Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
           'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm'].includes(name)) {
        bonesRef.current[name] = child;
      }
      if (name === 'LeftEye')  leftEyeBone.current  = child;
      if (name === 'RightEye') rightEyeBone.current = child;
    });

    // Rest pose — natural relaxed stance
    const b = bonesRef.current;
    if (b.LeftArm)      { b.LeftArm.rotation.x  = Math.PI * 0.47; b.LeftArm.rotation.y  = -1; }
    if (b.RightArm)     { b.RightArm.rotation.x = Math.PI * 0.47; b.RightArm.rotation.y =  1; }
    if (b.LeftForeArm)  b.LeftForeArm.rotation.z  = -0.15;
    if (b.RightForeArm) b.RightForeArm.rotation.z =  0.15;
    if (b.Spine)        b.Spine.rotation.x         =  0.04;
  }, [fbx]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    const b = bonesRef.current;

    // Speak blend
    speakBlend.current += ((isSpeaking ? 1 : 0) - speakBlend.current) * 0.04;
    const s    = speakBlend.current;
    const idle = 1 - s;

    // ── Breathing — always on, quieter when speaking ──────────────────────────
    const breath      = Math.sin(t * 1.6);
    const breathScale = 0.25 + idle * 0.75;
    if (b.Spine1) b.Spine1.rotation.x = (0.03 + breath * 0.02) * breathScale;
    if (b.Spine2) b.Spine2.rotation.x = (0.01 + breath * 0.01) * breathScale;
    if (b.Neck)   b.Neck.rotation.x   = Math.sin(t * 1.6 + 0.5) * 0.006 * breathScale;

    // ── Subtle shoulder rise with breath ─────────────────────────────────────
    if (b.LeftArm)  b.LeftArm.rotation.x  = Math.PI * 0.43 + breath * 0.008 * breathScale;
    if (b.RightArm) b.RightArm.rotation.x = Math.PI * 0.43 + breath * 0.008 * breathScale;

    // ── Body sway — only at idle ──────────────────────────────────────────────
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.28) * 0.03 * idle;
      groupRef.current.rotation.z = Math.sin(t * 0.7)  * 0.008 * idle;
    }

    // ── Head — always slightly alive, more active at idle ────────────────────
    const headAmt = 0.35 + idle * 0.6;
    // When speaking, head drifts side to side on a slow independent rhythm
    const speakTurnY = isSpeaking
      ? Math.sin(t * 0.3) * 0.06 + Math.sin(t * 0.7) * 0.08  // two overlapping waves = natural, not robotic
      : 0;
    const speakTiltX = isSpeaking
      ? Math.sin(t * 0.5 + 1.0) * 0.03  // slight forward/back nod when speaking
      : 0;

    if (b.Head) {
      b.Head.rotation.x = Math.sin(t * 0.6)  * 0.055 * headAmt + speakTiltX;
      b.Head.rotation.y = Math.sin(t * 0.45) * 0.045 * headAmt + speakTurnY;
      b.Head.rotation.z = Math.sin(t * 0.35) * 0.025 * headAmt;
    }

    // ── Eye look-around ───────────────────────────────────────────────────────
    if (t > nextEyeShiftAt.current) {
      // When speaking, eyes tend to look slightly more "at" the viewer (near zero)
      const range = isSpeaking ? 0.5 : 1.0;
      eyeTargetH.current = (Math.random() * 2 - 1) * EYE_RANGE_H * range;
      eyeTargetV.current = (Math.random() * 2 - 1) * EYE_RANGE_V * range;
      nextEyeShiftAt.current = t + EYE_TARGET_INTERVAL * (0.6 + Math.random() * 0.8);
    }
    eyeCurrentH.current += (eyeTargetH.current - eyeCurrentH.current) * EYE_DRIFT_SPEED * delta * 60;
    eyeCurrentV.current += (eyeTargetV.current - eyeCurrentV.current) * EYE_DRIFT_SPEED * delta * 60;

    if (leftEyeBone.current)  { leftEyeBone.current.rotation.y  = eyeCurrentH.current; leftEyeBone.current.rotation.x  = eyeCurrentV.current; }
    if (rightEyeBone.current) { rightEyeBone.current.rotation.y = eyeCurrentH.current; rightEyeBone.current.rotation.x = eyeCurrentV.current; }


    // ── Blinking ──────────────────────────────────────────────────────────────
    let blinkWeight = 0;
    if (blinkStart.current !== null) {
      const phase = t - blinkStart.current;
      if      (phase < BLINK_CLOSE)                     blinkWeight = phase / BLINK_CLOSE;
      else if (phase < BLINK_CLOSE + BLINK_HOLD)        blinkWeight = 1;
      else if (phase < BLINK_TOTAL)                     blinkWeight = 1 - (phase - BLINK_CLOSE - BLINK_HOLD) / BLINK_OPEN;
      else {
        blinkStart.current  = null;
        nextBlinkAt.current = t + BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN);
      }
    } else if (t >= nextBlinkAt.current) {
      blinkStart.current = t;
    }

    for (const mesh of emotionMeshesRef.current) {
      const dict = mesh.morphTargetDictionary;
      const inf  = mesh.morphTargetInfluences;
      if (!dict || !inf) continue;
      const lIdx = dict['eyeBlinkLeft'];
      const rIdx = dict['eyeBlinkRight'];
      if (lIdx !== undefined) inf[lIdx] = blinkWeight;
      if (rIdx !== undefined) inf[rIdx] = blinkWeight;
    }
  });

  useLipSync(visemeMeshesRef, visemes, audioStartTime, isSpeaking);
  useEmotion(emotionMeshesRef, emotion, isSpeaking);

  return <group ref={groupRef}><primitive object={fbx} /></group>;
}

useGLTF.preload('/avatar/model-4.glb');