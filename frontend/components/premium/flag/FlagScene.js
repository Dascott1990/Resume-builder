"use client";
/**
 * FlagScene.js — the actual WebGL scene: a pole and a flag textured with
 * whichever country's canvas-drawn flag was detected, waving via per-vertex
 * sine displacement (amplitude grows from zero at the hoist edge, where it's
 * pinned to the pole, out to the free edge) and raised up the pole on
 * mount — the whole point being "here's the flag going up," not a static
 * badge. Never import this file statically; only ever reached through
 * Flag3D.js's next/dynamic(ssr:false) call, same isolation as the other
 * WebGL scenes in this app.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { drawFlagCanvas } from "./flagCanvas";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const FLAG_W = 46;
const FLAG_H = 30;
const POLE_HEIGHT = 62;
const SEGMENTS_X = 18;
const SEGMENTS_Y = 10;

function WavingFlag({ countryCode, reducedMotion }) {
  const meshRef = useRef(null);
  const groupRef = useRef(null);
  const raiseProgress = useRef(0);

  const texture = useMemo(() => {
    const canvas = drawFlagCanvas(countryCode);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [countryCode]);

  const geometry = useMemo(() => new THREE.PlaneGeometry(FLAG_W, FLAG_H, SEGMENTS_X, SEGMENTS_Y), []);
  const basePositions = useMemo(() => geometry.attributes.position.array.slice(), [geometry]);

  useEffect(() => () => { texture.dispose(); geometry.dispose(); }, [texture, geometry]);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (g) {
      raiseProgress.current = Math.min(1, raiseProgress.current + delta * (reducedMotion ? 10 : 0.9));
      const eased = 1 - Math.pow(1 - raiseProgress.current, 3);
      g.position.y = -POLE_HEIGHT * 0.32 * (1 - eased);
      g.scale.setScalar(0.85 + 0.15 * eased);
    }

    if (!reducedMotion && meshRef.current) {
      const pos = meshRef.current.geometry.attributes.position;
      const t = state.clock.elapsedTime;
      for (let i = 0; i < pos.count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const distFromHoist = (bx + FLAG_W / 2) / FLAG_W; // 0 at the pole, 1 at the free edge
        const amp = distFromHoist * 2.4;
        const wave = Math.sin(bx * 0.34 + t * 2.3) * amp + Math.sin(by * 0.5 + t * 1.6) * amp * 0.3;
        pos.setZ(i, wave);
      }
      pos.needsUpdate = true;
      meshRef.current.geometry.computeVertexNormals();
    }
  });

  return (
    <group ref={groupRef}>
      <mesh position={[-FLAG_W / 2 - 1.5, 0, -1]}>
        <cylinderGeometry args={[0.8, 0.8, POLE_HEIGHT, 12]} />
        <meshStandardMaterial color="#8a6a2c" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[-FLAG_W / 2 - 1.5, POLE_HEIGHT / 2, -1]}>
        <sphereGeometry args={[1.6, 14, 14]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh ref={meshRef} geometry={geometry} position={[0, POLE_HEIGHT / 2 - FLAG_H / 2 - 5, 0]}>
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.75} metalness={0.03} />
      </mesh>
    </group>
  );
}

export default function FlagScene({ countryCode, style, className, onContextLost }) {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div style={style} className={className}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ position: [4, 4, 128], fov: 34 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onContextLost?.();
          });
        }}
      >
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight position={[40, 60, 80]} intensity={1.15} color="#fff2d9" />
        <directionalLight position={[-40, -20, 40]} intensity={0.4} color="#f59e0b" />
        <WavingFlag countryCode={countryCode} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
