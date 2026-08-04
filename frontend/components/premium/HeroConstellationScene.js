"use client";
/**
 * HeroConstellationScene.js — the hero's real showpiece: the brand mark
 * (the bridge from potential to opportunity) at the center of a small
 * constellation of what Noviq actually does, each piece tied back to the
 * mark by a thin connecting line:
 *
 *   · A resume card — the document itself, avatar + name + a few lines.
 *   · A people network — three linked nodes, the "find people, connect"
 *     side of the app (the artisan directory, hiring, being hired).
 *   · A stack of building blocks — a tiny skyline, "build something" —
 *     literalizing the tagline's own metaphor (taller = brighter, same
 *     gradient logic as the mark's own tall pillar reaching the light).
 *
 * Never import this file statically; it's only ever reached through
 * HeroScene3D.js's next/dynamic(ssr:false) call, same isolation pattern as
 * Logo3DScene.js.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center, Line } from "@react-three/drei";
import { useMarkGeometry, gradientColor } from "./markGeometry";

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

// Wraps a satellite piece with a small independent bob + spin, on top of
// its fixed constellation position — the position itself stays put (so the
// connecting line's endpoint is always correct) while this inner group
// drifts a few units around it.
function Satellite({ position, reducedMotion, children }) {
  const innerRef = useRef(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame((state, delta) => {
    const g = innerRef.current;
    if (!g || reducedMotion) return;
    const t = state.clock.elapsedTime;
    g.position.y = Math.sin(t * 0.55 + phase) * 2.4;
    g.rotation.y += delta * 0.3;
  });
  return (
    <group position={position}>
      <group ref={innerRef}>{children}</group>
    </group>
  );
}

// ── The resume card — avatar, name bar, a few paragraph lines ──────────────
function ResumeCard() {
  const lines = [
    { y: 3.2, w: 13.5 },
    { y: -0.6, w: 13.5 },
    { y: -4.4, w: 13.5 },
    { y: -8.2, w: 8.5 },
  ];
  return (
    <group scale={0.85}>
      <mesh>
        <boxGeometry args={[18, 24, 1.4]} />
        <meshStandardMaterial color="#F3E9D2" roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[-5.6, 8.6, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.4, 2.4, 0.5, 20]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[1.9, 8.6, 0.9]}>
        <boxGeometry args={[8.6, 1.8, 0.4]} />
        <meshStandardMaterial color="#8a6a2c" roughness={0.5} />
      </mesh>
      {lines.map((l) => (
        <mesh key={l.y} position={[-9 + l.w / 2 + 1, l.y, 0.9]}>
          <boxGeometry args={[l.w, 1.1, 0.35]} />
          <meshStandardMaterial color="#c9b587" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

// ── The people network — a hub with three connected nodes ──────────────────
function PeopleNetwork() {
  const nodes = [
    [10, 6, 4],
    [-9.5, 4.5, -3],
    [2, -10.5, 2],
  ];
  return (
    <group scale={0.95}>
      <mesh>
        <sphereGeometry args={[2, 24, 24]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.35} metalness={0.6} />
      </mesh>
      {nodes.map((n, i) => (
        <group key={i}>
          <Line points={[[0, 0, 0], n]} color="#F6E6B3" transparent opacity={0.4} lineWidth={1} />
          <mesh position={n}>
            <sphereGeometry args={[2.7, 20, 20]} />
            <meshStandardMaterial color="#F6E6B3" roughness={0.5} metalness={0.25} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Building blocks — a tiny skyline, taller reaches brighter (same logic
// as the mark's own tall pillar) ────────────────────────────────────────────
function BuildingBlocks() {
  const blocks = [
    { x: -8, h: 10 },
    { x: -2, h: 17 },
    { x: 4, h: 7 },
    { x: 10, h: 14 },
  ];
  const maxH = Math.max(...blocks.map((b) => b.h));
  return (
    <group scale={0.8}>
      {blocks.map((b) => {
        const color = gradientColor(1 - b.h / maxH, new THREE.Color());
        return (
          <mesh key={b.x} position={[b.x, -9 + b.h / 2, 0]}>
            <boxGeometry args={[5, b.h, 5]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

const RESUME_POS = [46, 28, 16];
const PEOPLE_POS = [-42, -4, 22];
const BUILDING_POS = [52, -30, 24];
const ANCHOR = [0, -4, 0];

function Constellation() {
  const groupRef = useRef(null);
  const markGeometry = useMarkGeometry();
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    if (reducedMotion) {
      g.rotation.set(0, 0.4, 0);
      return;
    }
    g.rotation.y += delta * 0.08; // slower than a solo mark — more to read now
    const targetX = state.pointer.y * 0.12;
    const targetZ = -state.pointer.x * 0.1;
    const k = Math.min(1, delta * 3);
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.z += (targetZ - g.rotation.z) * k;
  });

  return (
    <group ref={groupRef}>
      <Center>
        <mesh geometry={markGeometry}>
          <meshStandardMaterial vertexColors roughness={0.4} metalness={0.65} />
        </mesh>
      </Center>

      <Line points={[ANCHOR, RESUME_POS]} color="#f59e0b" transparent opacity={0.32} lineWidth={1} />
      <Line points={[ANCHOR, PEOPLE_POS]} color="#f59e0b" transparent opacity={0.32} lineWidth={1} />
      <Line points={[ANCHOR, BUILDING_POS]} color="#f59e0b" transparent opacity={0.32} lineWidth={1} />

      <Satellite position={RESUME_POS} reducedMotion={reducedMotion}><ResumeCard /></Satellite>
      <Satellite position={PEOPLE_POS} reducedMotion={reducedMotion}><PeopleNetwork /></Satellite>
      <Satellite position={BUILDING_POS} reducedMotion={reducedMotion}><BuildingBlocks /></Satellite>
    </group>
  );
}

export default function HeroConstellationScene({ style, className, onContextLost }) {
  return (
    <div style={style} className={className}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 195], fov: 40 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onContextLost?.();
          });
        }}
      >
        <ambientLight intensity={0.4} color="#2a1f10" />
        <directionalLight position={[40, 60, 80]} intensity={1.5} color="#fff2d9" />
        <directionalLight position={[-60, -20, 40]} intensity={0.55} color="#f59e0b" />
        <directionalLight position={[0, -40, 60]} intensity={0.35} color="#8a6a2c" />
        <Constellation />
      </Canvas>
    </div>
  );
}
