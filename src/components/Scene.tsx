'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import Avatar from './Avatar';
import { VisemeEvent } from '@/hooks/useLipSync';

interface SceneProps {
  isSpeaking: boolean;
  visemes: VisemeEvent[];
  audioStartTime: number;
}

export default function Scene({ isSpeaking, visemes, audioStartTime }: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.8, 0], fov: 40 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.6, -1.2)}
      shadows // Enables shadow mapping for better depth
    >
      {/* 1. Ambient Light: Soft fill so shadows aren't pitch black */}
      <ambientLight intensity={0.5} />

      {/* 2. Key Light (Front Right): Main source to illuminate the face */}
      <directionalLight 
        position={[2, 3, 5]} 
        intensity={4} 
        castShadow
      />

      {/* 3. Fill Light (Left): Softens the shadows on the left side of the face */}
      <pointLight 
        position={[-3, 2, 2]} 
        intensity={200} 
        color="#5c25c1" 
      />

      {/* 4. RIM LIGHT (Behind): THIS IS THE SECRET SAUCE. 
          It creates a "halo" around the hair and shoulders so he doesn't 
          blend into the dark background. */}
      <spotLight
        position={[0, 5, -5]}           // Placed high and behind the avatar
        target-position={[0, 1.6, -1.2]} // Aimed specifically at the head/neck
        intensity={300}                  // High intensity needed for dark themes
        angle={0.6}
        penumbra={1}
        color="#b72fe5"
      />

      {/* 5. Catchlight: Placed right near the camera to put a "sparkle" in the eyes */}
      <pointLight 
        position={[0, 1.8, 0.5]} 
        intensity={22}  
        color="#00e1ff" 
      />

      {/* 6. Contact Shadows: Softly grounds the torso at the bottom of the frame */}
      <ContactShadows 
        position={[0, 0, -1.2]} 
        opacity={0.5} 
        scale={6} 
        blur={2.5} 
        far={2} 
        color="#008cff"
      />

      {/* 7. Environment: Provides realistic metallic/skin reflections */}
      <Environment preset="city" />

      <Suspense fallback={null}>
        <Avatar
          isSpeaking={isSpeaking}
          visemes={visemes}
          audioStartTime={audioStartTime}
          emotion="neutral" // Default emotion
        />
      </Suspense>
    </Canvas>
  );
}