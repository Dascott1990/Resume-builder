"use client";
/**
 * PaperTransformScene.js — a pen visibly writing an old, handwritten
 * resume line by line, then a sweep of light transforms the whole page
 * into the clean, structured resume Noviq actually produces. The "before"
 * — an actual pen tracing rough ink strokes onto aged parchment — versus
 * the "after" — a clean, typeset card — makes the pitch in a few silent
 * seconds instead of a paragraph of copy: rough draft in, polished resume
 * out. Lives in its own section below the Hero (see PaperTransformSection
 * .js), not the Hero itself — the Hero stays on the original constellation
 * mark and its own two buttons, deliberately uncluttered.
 *
 * Never import this file statically; it's only ever reached through
 * PaperTransformScene3D.js's next/dynamic(ssr:false) call, same isolation
 * pattern every other 3D scene in this app uses.
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

// ── Writing sequence — each stroke gets its own time window, sequential,
// so the pen visibly moves from one to the next rather than everything
// appearing at once. Fast/confident pacing on purpose: this has to read in
// a couple of seconds on a landing page, not play out like real
// handwriting speed. ─────────────────────────────────────────────────────
const HEADING = { y: 9.4, x: -3.4, w: 9.5, h: 1.3, rot: -0.03 };
const BODY_ROWS = [
  { y: 3.6, w: 14.5 }, { y: 1.2, w: 11 }, { y: -1.2, w: 15.2 },
  { y: -3.6, w: 9.8 }, { y: -6, w: 13 }, { y: -8.4, w: 8 },
];
const HEADING_DUR = 0.32;
const LINE_DUR = 0.34;
const GAP = 0.05;

function useStrokes() {
  return useMemo(() => {
    let t = 0;
    const heading = { ...HEADING, x: -3.4, start: t, end: t + HEADING_DUR };
    t = heading.end + GAP;
    const body = BODY_ROWS.map((row) => {
      const w = row.w + (Math.random() - 0.5) * 1.5;
      const x = -8 + Math.random() * 1.4;
      const rot = (Math.random() - 0.5) * 0.045;
      const stroke = { y: row.y + (Math.random() - 0.5) * 0.4, x, w, rot, h: 0.55 + Math.random() * 0.2, start: t, end: t + LINE_DUR };
      t = stroke.end + GAP;
      return stroke;
    });
    return { heading, body, writeEnd: t };
  }, []);
}

// A stroke mesh whose geometry is pre-translated so its pivot sits at the
// LEFT edge instead of the center — scaling scale.x from 0 to 1 then grows
// the stroke rightward from a fixed start point, the actual "being drawn"
// reveal, instead of an instant appear or a center-out expand.
function Stroke({ strokeRef, x, y, w, h, rot, color, opacity = 1 }) {
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, 0.3);
    g.translate(w / 2, 0, 0);
    return g;
  }, [w, h]);
  return (
    <mesh ref={strokeRef} geometry={geometry} position={[x, y, 0.76]} rotation={[0, 0, rot]} scale={[0, 1, 1]}>
      <meshStandardMaterial color={color} roughness={0.95} transparent opacity={opacity} />
    </mesh>
  );
}

// ── The pen — nib at the local origin (the point that tracks the current
// writing position), body angling up and away from the page. ──────────────
function Pen({ penRef }) {
  const nibGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.22, 1.4, 10);
    g.translate(0, -0.7, 0); // apex moves to local origin — that's the tracked "tip"
    return g;
  }, []);
  const bodyGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.17, 0.2, 7, 10);
    g.translate(0, -4.9, 0); // sits directly above the nib's base, continuing down from the tip
    return g;
  }, []);
  return (
    <group ref={penRef} rotation={[0.55, 0, 2.15]}>
      <mesh geometry={nibGeo}>
        <meshStandardMaterial color="#1c1c1c" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color="#2b2b2b" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, -1.4, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.4, 10]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ── Old paper shell — the aged parchment card the pen writes onto. ─────────
function PaperBase() {
  return (
    <mesh rotation={[0, 0, -0.02]}>
      <boxGeometry args={[18, 24, 1.2]} />
      <meshStandardMaterial color="#e3d5ae" roughness={0.9} metalness={0} />
    </mesh>
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
function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export default function PaperTransformScene({ style, className, onContextLost }) {
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

function Scene() {
  const rootRef = useRef(null);
  const oldGroupRef = useRef(null);
  const newRef = useRef(null);
  const shineRef = useRef(null);
  const penRef = useRef(null);
  const headingRef = useRef(null);
  const bodyRefs = useRef([]);
  const reducedMotion = usePrefersReducedMotion();
  const { heading, body, writeEnd } = useStrokes();

  // Small pause after the last stroke finishes, sitting on the completed
  // handwritten page, before the shine/transform kicks in.
  const OLD_HOLD = writeEnd + 0.35;
  const TRANSITION = 1.1;
  const NEW_HOLD = 9;
  const CYCLE = OLD_HOLD + TRANSITION + NEW_HOLD;

  useFrame((state, delta) => {
    const root = rootRef.current;
    const oldGroup = oldGroupRef.current;
    const resume = newRef.current;
    const shine = shineRef.current;
    const pen = penRef.current;
    const headingMesh = headingRef.current;
    if (!root || !oldGroup || !resume || !shine || !pen || !headingMesh) return;

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
      oldGroup.visible = true;
      resume.visible = false;
      shine.visible = false;
      oldGroup.scale.setScalar(0.85);

      // Drive each stroke's left-anchored reveal and figure out which one
      // the pen should currently be tracking.
      const allStrokes = [{ mesh: headingMesh, def: heading }, ...bodyRefs.current.map((mesh, i) => ({ mesh, def: body[i] }))];
      let active = null;
      for (const s of allStrokes) {
        if (!s.mesh) continue;
        const local = t < s.def.start ? 0 : t > s.def.end ? 1 : (t - s.def.start) / (s.def.end - s.def.start);
        s.mesh.scale.x = easeOutQuad(local);
        if (t >= s.def.start && t <= s.def.end) active = { def: s.def, local };
      }

      pen.visible = true;
      if (active) {
        pen.position.set(active.def.x + active.def.w * active.local, active.def.y, 1.35);
      } else if (t < heading.start) {
        pen.position.set(heading.x, heading.y + 1.5, 1.35); // poised above the page, about to start
      } else {
        // Between strokes / after the last one — rest at the end of the
        // most recently finished stroke instead of teleporting away.
        const done = allStrokes.filter((s) => s.def.end <= t);
        const last = done[done.length - 1];
        if (last) pen.position.set(last.def.x + last.def.w, last.def.y, 1.35);
      }
    } else if (t < OLD_HOLD + TRANSITION) {
      const p = easeInOutCubic((t - OLD_HOLD) / TRANSITION);
      oldGroup.visible = p < 1;
      resume.visible = true;
      shine.visible = true;
      pen.visible = p < 0.4;
      pen.position.z = 1.35 + p * 6; // lifts away as the page transforms

      oldGroup.scale.setScalar(0.85 * (1 - p * 0.15));
      oldGroup.traverse((o) => {
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

      shine.position.x = -12 + p * 24;
      shine.material.opacity = Math.sin(p * Math.PI) * 0.85;
    } else {
      oldGroup.visible = false;
      resume.visible = true;
      shine.visible = false;
      pen.visible = false;
      resume.scale.setScalar(0.85);
      resume.traverse((o) => { if (o.material) o.material.opacity = 1; });
    }
  });

  return (
    <group ref={rootRef}>
      <Center>
        <group>
          <group ref={oldGroupRef} scale={0.85}>
            <PaperBase />
            <Stroke strokeRef={headingRef} x={heading.x} y={heading.y} w={heading.w} h={heading.h} rot={heading.rot} color="#3d2e1a" />
            {body.map((s, i) => (
              <Stroke
                key={i}
                strokeRef={(el) => { bodyRefs.current[i] = el; }}
                x={s.x} y={s.y} w={s.w} h={s.h} rot={s.rot}
                color="#4a3822" opacity={0.85}
              />
            ))}
          </group>
          <CleanResume groupRef={newRef} />
          <Shine meshRef={shineRef} />
          <group scale={0.85}><Pen penRef={penRef} /></group>
        </group>
      </Center>
    </group>
  );
}
