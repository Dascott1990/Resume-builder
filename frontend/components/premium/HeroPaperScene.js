"use client";
/**
 * HeroPaperScene.js — the hero's showpiece: an old, worn, handwritten-
 * looking resume that catches a sweep of light and transforms into the
 * clean, structured resume Noviq actually produces. The "before" —
 * irregular, jittery ink strokes on an aged parchment card — versus the
 * "after" — the same clean, structured card HowItWorks/the constellation
 * scene already used — makes the pitch in one silent beat instead of a
 * paragraph of copy: rough draft in, polished resume out.
 *
 * Never import this file statically; it's only ever reached through
 * HeroScene3D.js's next/dynamic(ssr:false) call, same isolation pattern
 * every other 3D scene in this app uses.
 */
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center } from "@react-three/drei";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useMemo(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    mq.addEventListener("change", (e) => setReduced(e.matches));
  }, []);
  return reduced;
}

// Timing for one full cycle: sit on the old paper, sweep + morph into the
// resume, sit on the resume much longer (this is the state anyone reading
// the hero actually sees), then loop. Not a constant flicker — a slow,
// occasional "watch this" beat.
const OLD_HOLD = 2.6;
const TRANSITION = 1.1;
const NEW_HOLD = 9;
const CYCLE = OLD_HOLD + TRANSITION + NEW_HOLD;

// ── Old paper — aged parchment, irregular hand-drawn ink strokes ───────────
// Built from the same box-per-line technique as the clean resume below, but
// every line gets randomized length/rotation/offset so it reads as
// handwriting, not typesetting — real handwriting never sits on a perfectly
// straight, perfectly justified grid the way print does.
function useHandwrittenLines() {
  return useMemo(() => {
    const rows = [3.6, 1.2, -1.2, -3.6, -6, -8.4];
    return rows.map((y, i) => ({
      y: y + (Math.random() - 0.5) * 0.6,
      w: 9 + Math.random() * 6.5,
      x: -8 + Math.random() * 1.8,
      rot: (Math.random() - 0.5) * 0.05,
      h: 0.55 + Math.random() * 0.25,
    }));
  }, []);
}

function OldPaper({ groupRef }) {
  const lines = useHandwrittenLines();
  return (
    <group ref={groupRef} scale={0.85}>
      <mesh rotation={[0, 0, -0.02]}>
        <boxGeometry args={[18, 24, 1.2]} />
        <meshStandardMaterial color="#e3d5ae" roughness={0.9} metalness={0} />
      </mesh>
      {/* A rough, hand-drawn "heading" underline — a person's own name,
          scrawled, not printed. */}
      <mesh position={[-3.4, 9.4, 0.75]} rotation={[0, 0, -0.03]}>
        <boxGeometry args={[9.5, 1.3, 0.3]} />
        <meshStandardMaterial color="#3d2e1a" roughness={0.95} />
      </mesh>
      {lines.map((l, i) => (
        <mesh key={i} position={[l.x + l.w / 2, l.y, 0.75]} rotation={[0, 0, l.rot]}>
          <boxGeometry args={[l.w, l.h, 0.28]} />
          <meshStandardMaterial color="#4a3822" roughness={0.95} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ── The clean resume — same structured, typeset card the rest of the
// marketing site already implies this app produces. ────────────────────────
function CleanResume({ groupRef }) {
  const lines = [
    { y: 3.2, w: 13.5 },
    { y: -0.6, w: 13.5 },
    { y: -4.4, w: 13.5 },
    { y: -8.2, w: 8.5 },
  ];
  return (
    <group ref={groupRef} scale={0.85}>
      <mesh>
        <boxGeometry args={[18, 24, 1.4]} />
        <meshStandardMaterial color="#F3E9D2" roughness={0.5} metalness={0.05} />
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

// ── The shine — a bright, additive-blended bar that sweeps across the
// card's face during the transition, like light catching foil on a page. ───
function Shine({ meshRef }) {
  return (
    <mesh ref={meshRef} rotation={[0, 0, -0.5]} visible={false}>
      <planeGeometry args={[3.2, 34]} />
      <meshBasicMaterial color="#fff6dd" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function Scene() {
  const rootRef = useRef(null);
  const oldRef = useRef(null);
  const newRef = useRef(null);
  const shineRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state, delta) => {
    const root = rootRef.current;
    const oldPaper = oldRef.current;
    const resume = newRef.current;
    const shine = shineRef.current;
    if (!root || !oldPaper || !resume || !shine) return;

    // Gentle ambient rotation + mouse tilt, same feel as every other 3D
    // mark in the app — the transformation is the main event, but the
    // whole thing still feels alive while sitting on either state.
    if (!reducedMotion) {
      root.rotation.y += delta * 0.12;
      const targetX = state.pointer.y * 0.14;
      const targetZ = -state.pointer.x * 0.1;
      const k = Math.min(1, delta * 3);
      root.rotation.x += (targetX - root.rotation.x) * k;
      root.rotation.z += (targetZ - root.rotation.z) * k;
    } else {
      root.rotation.set(0, 0.3, 0);
    }

    const t = reducedMotion ? OLD_HOLD + TRANSITION + 0.01 : state.clock.elapsedTime % CYCLE;

    if (t < OLD_HOLD) {
      oldPaper.visible = true;
      resume.visible = false;
      shine.visible = false;
      oldPaper.scale.setScalar(0.85);
    } else if (t < OLD_HOLD + TRANSITION) {
      const p = easeInOutCubic((t - OLD_HOLD) / TRANSITION);
      oldPaper.visible = p < 1;
      resume.visible = true;
      shine.visible = true;

      // Old paper shrinks/fades out, resume grows/fades in — crossfading
      // opacity alone reads as a flat dissolve; adding a small scale
      // change on both sells an actual "becoming," not just a cut.
      oldPaper.scale.setScalar(0.85 * (1 - p * 0.15));
      oldPaper.traverse((o) => {
        if (o.material) {
          if (!o.material.transparent) o.material.transparent = true;
          o.material.opacity = 1 - p;
        }
      });

      resume.scale.setScalar(0.85 * (0.9 + p * 0.1));
      resume.traverse((o) => {
        if (o.material) {
          if (!o.material.transparent) o.material.transparent = true;
          o.material.opacity = p;
        }
      });

      // The shine sweeps left-to-right across the card once per
      // transition, brightest at the midpoint.
      shine.position.x = -12 + p * 24;
      shine.material.opacity = Math.sin(p * Math.PI) * 0.85;
    } else {
      oldPaper.visible = false;
      resume.visible = true;
      shine.visible = false;
      resume.scale.setScalar(0.85);
      resume.traverse((o) => { if (o.material) o.material.opacity = 1; });
    }
  });

  return (
    <group ref={rootRef}>
      <Center>
        <group>
          <OldPaper groupRef={oldRef} />
          <CleanResume groupRef={newRef} />
          <Shine meshRef={shineRef} />
        </group>
      </Center>
    </group>
  );
}

export default function HeroPaperScene({ style, className, onContextLost }) {
  return (
    <div style={style} className={className}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 46], fov: 40 }}
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
        <Scene />
      </Canvas>
    </div>
  );
}
