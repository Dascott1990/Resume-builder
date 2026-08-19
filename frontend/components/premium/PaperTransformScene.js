"use client";
/**
 * PaperTransformScene.js — a pen visibly writing an old, handwritten
 * resume line by line, then a sweep of light transforms the whole page
 * into the clean, structured resume Noviq actually produces. The "before"
 * — an actual pen tracing real, readable handwriting onto aged parchment —
 * versus the "after" — a clean, typeset card with real printed text —
 * makes the pitch in a few silent seconds instead of a paragraph of copy:
 * rough draft in, polished resume out. Lives in its own section below the
 * Hero (see PaperTransformSection.js), not the Hero itself — the Hero
 * stays on the original constellation mark and its own two buttons,
 * deliberately uncluttered.
 *
 * Both the "before" and "after" text are real canvas-rendered words (a
 * cursive Google Font for the handwriting, a plain system sans for the
 * typeset version), not solid-color placeholder bars — see makeTextTexture
 * below. Each handwritten line reveals left-to-right via a shader wipe
 * timed to the pen's position, so it reads as the pen actually writing the
 * words rather than a line simply fading or growing in.
 *
 * Also the Hero's own 3D showcase (see landing/Hero.js) — both mount this
 * same scene independently rather than sharing one instance, so each gets
 * its own write→transform→hold cycle timed to when IT scrolled into view.
 *
 * Never import this file statically; it's only ever reached through
 * PaperTransformScene3D.js's next/dynamic(ssr:false) call, same isolation
 * pattern every other 3D scene in this app uses.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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

// Caveat is loaded as a real <link> stylesheet in app/layout.js (a plain
// canvas 2d context can only resolve a font by name once the browser has
// actually loaded it — document.fonts.load lets us wait for that instead
// of racing it and silently falling back to a generic sans-serif).
function useHandwritingFont() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      setReady(true);
      return;
    }
    let cancelled = false;
    Promise.all([document.fonts.load('700 100px "Caveat"'), document.fonts.load('600 100px "Caveat"')])
      .catch(() => {})
      .finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);
  return ready;
}

// Renders `text` onto a tightly-cropped canvas and returns a texture plus
// its aspect ratio, so callers can size a plane to match the real rendered
// glyphs instead of guessing a width.
function makeTextTexture(text, { weight = 600, size = 80, color = "#2b2013", font = '"Caveat", cursive' } = {}) {
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = `${weight} ${size}px ${font}`;
  const textWidth = Math.max(1, Math.ceil(probe.measureText(text).width));
  const padX = size * 0.22;
  const canvas = document.createElement("canvas");
  canvas.width = textWidth + padX * 2;
  canvas.height = Math.ceil(size * 1.5);
  const ctx = canvas.getContext("2d");
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, padX, canvas.height * 0.68);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, aspect: canvas.width / canvas.height };
}

// ── Writing sequence — real resume-note content, one line at a time, so
// the pen visibly moves from one to the next rather than everything
// appearing at once. Fast/confident pacing on purpose: this has to read in
// a couple of seconds on a landing page, not play out like real
// handwriting speed. ─────────────────────────────────────────────────────
const HEADING_LINE = { text: "Jordan Blake", weight: 700, size: 130 };
const BODY_LINES = [
  { text: "Marketing Coordinator, 5 yrs", weight: 600, size: 78 },
  { text: "Led campaigns for 3 brands", weight: 600, size: 78 },
  { text: "Grew engagement 40% in 2023", weight: 600, size: 78 },
  { text: "Managed a team of 6", weight: 600, size: 78 },
  { text: "Fluent in Figma + analytics", weight: 600, size: 78 },
  { text: "References on request", weight: 600, size: 78 },
];
const HEADING_ROW = { y: 9.3, h: 1.9, dur: 0.4 };
const BODY_ROWS = [
  { y: 3.8, h: 1.05, dur: 0.34 },
  { y: 1.4, h: 1.05, dur: 0.34 },
  { y: -1, h: 1.05, dur: 0.34 },
  { y: -3.4, h: 1.05, dur: 0.34 },
  { y: -5.8, h: 1.05, dur: 0.34 },
  { y: -8.2, h: 1.05, dur: 0.34 },
];
const START_X = -8.4;
const GAP = 0.05;

function useLineTextures(fontReady) {
  return useMemo(() => {
    if (!fontReady || typeof document === "undefined") return null;
    return [HEADING_LINE, ...BODY_LINES].map((l) => makeTextTexture(l.text, { weight: l.weight, size: l.size }));
  }, [fontReady]);
}

function useStrokes(textures) {
  return useMemo(() => {
    if (!textures) return null;
    let t = 0;
    const build = (row, tex) => {
      const w = row.h * tex.aspect;
      const def = { x: START_X, y: row.y, w, h: row.h, texture: tex.texture, start: t, end: t + row.dur };
      t = def.end + GAP;
      return def;
    };
    const heading = build(HEADING_ROW, textures[0]);
    const body = BODY_ROWS.map((row, i) => build(row, textures[i + 1]));
    return { heading, body, writeEnd: t };
  }, [textures]);
}

const REVEAL_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// Left-to-right wipe in the plane's own UV space — a soft-edged reveal
// boundary at uProgress, independent of the group's world rotation, so the
// "ink appearing" edge always tracks the pen regardless of the scene's
// continuous tilt/spin.
const REVEAL_FRAGMENT = `
  uniform sampler2D map;
  uniform float uProgress;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec4 texColor = texture2D(map, vUv);
    float edge = 0.05;
    float reveal = 1.0 - smoothstep(uProgress - edge, uProgress + edge, vUv.x);
    float alpha = texColor.a * reveal * uOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(texColor.rgb, alpha);
  }
`;

// A handwritten-text plane, pre-translated so its pivot sits at the LEFT
// edge (mesh position = the line's start point), and revealed via a
// left-to-right shader wipe as the pen passes over it — real legible
// glyphs "being written," instead of a solid bar growing.
function TextStroke({ strokeRef, x, y, w, h, texture }) {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(w / 2, 0, 0);
    return g;
  }, [w, h]);
  const uniforms = useMemo(() => ({ map: { value: texture }, uProgress: { value: 0 }, uOpacity: { value: 1 } }), [texture]);
  return (
    <mesh ref={strokeRef} geometry={geometry} position={[x, y, 0.76]}>
      <shaderMaterial uniforms={uniforms} vertexShader={REVEAL_VERTEX} fragmentShader={REVEAL_FRAGMENT} transparent depthWrite={false} />
    </mesh>
  );
}

// A plain, always-fully-rendered text plane — used for the typeset "after"
// resume, where nothing needs a reveal wipe, just a normal opacity
// crossfade the existing transition traversal already drives.
function TexturedPlane({ x, y, h, texture, aspect }) {
  const w = h * aspect;
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(w / 2, 0, 0);
    return g;
  }, [w, h]);
  return (
    <mesh geometry={geometry} position={[x, y, 0.9]}>
      <meshBasicMaterial map={texture} transparent />
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

const RESUME_NAME = { text: "Jordan Blake", weight: 700, size: 130, font: "system-ui, -apple-system, sans-serif", color: "#3d2e1a" };
const RESUME_BULLETS = [
  { text: "Marketing Coordinator · 5 yrs", weight: 600, size: 76, font: "system-ui, -apple-system, sans-serif", color: "#6b5636" },
  { text: "Led campaigns for 3 brands", weight: 600, size: 76, font: "system-ui, -apple-system, sans-serif", color: "#6b5636" },
  { text: "Grew engagement 40% in 2023", weight: 600, size: 76, font: "system-ui, -apple-system, sans-serif", color: "#6b5636" },
  { text: "Figma · Analytics · Copywriting", weight: 600, size: 76, font: "system-ui, -apple-system, sans-serif", color: "#6b5636" },
];

function useCleanResumeTextures() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    return {
      name: makeTextTexture(RESUME_NAME.text, RESUME_NAME),
      bullets: RESUME_BULLETS.map((b) => makeTextTexture(b.text, b)),
    };
  }, []);
}

// ── The clean resume — same structured, typeset card the rest of the
// marketing site already implies this app produces, now with real printed
// text instead of solid-color placeholder bars. ────────────────────────────
function CleanResume({ groupRef }) {
  const tex = useCleanResumeTextures();
  const bulletY = [3.2, -0.6, -4.4, -8.2];
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
      {tex && <TexturedPlane x={-2.9} y={8.6} h={1.7} texture={tex.name.texture} aspect={tex.name.aspect} />}
      {tex && bulletY.map((y, i) => (
        <TexturedPlane key={i} x={-8} y={y} h={1.05} texture={tex.bullets[i].texture} aspect={tex.bullets[i].aspect} />
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
  const fontReady = useHandwritingFont();
  const textures = useLineTextures(fontReady);
  const strokes = useStrokes(textures);

  // Small pause after the last stroke finishes, sitting on the completed
  // handwritten page, before the shine/transform kicks in. Falls back to a
  // reasonable estimate before the font/textures are ready so the cycle
  // length doesn't jump once they load in.
  const OLD_HOLD = (strokes?.writeEnd ?? 2.6) + 0.35;
  const TRANSITION = 1.1;
  const NEW_HOLD = 9;
  const CYCLE = OLD_HOLD + TRANSITION + NEW_HOLD;

  useFrame((state, delta) => {
    const root = rootRef.current;
    const oldGroup = oldGroupRef.current;
    const resume = newRef.current;
    const shine = shineRef.current;
    const pen = penRef.current;
    if (!root || !oldGroup || !resume || !shine || !pen) return;

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
    const headingMesh = headingRef.current;

    if (t < OLD_HOLD) {
      oldGroup.visible = true;
      resume.visible = false;
      shine.visible = false;
      oldGroup.scale.setScalar(0.85);

      if (strokes && headingMesh) {
        // Drive each stroke's left-to-right reveal wipe and figure out
        // which one the pen should currently be tracking.
        const allStrokes = [{ mesh: headingMesh, def: strokes.heading }, ...bodyRefs.current.map((mesh, i) => ({ mesh, def: strokes.body[i] }))];
        let active = null;
        for (const s of allStrokes) {
          if (!s.mesh) continue;
          const local = t < s.def.start ? 0 : t > s.def.end ? 1 : (t - s.def.start) / (s.def.end - s.def.start);
          s.mesh.material.uniforms.uProgress.value = easeOutQuad(local);
          if (t >= s.def.start && t <= s.def.end) active = { def: s.def, local };
        }

        pen.visible = true;
        if (active) {
          pen.position.set(active.def.x + active.def.w * active.local, active.def.y, 1.35);
        } else if (t < strokes.heading.start) {
          pen.position.set(strokes.heading.x, strokes.heading.y + 1.5, 1.35); // poised above the page, about to start
        } else {
          // Between strokes / after the last one — rest at the end of the
          // most recently finished stroke instead of teleporting away.
          const done = allStrokes.filter((s) => s.def.end <= t);
          const last = done[done.length - 1];
          if (last) pen.position.set(last.def.x + last.def.w, last.def.y, 1.35);
        }
      } else {
        pen.visible = false;
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
        if (!o.material) return;
        if (o.material.uniforms?.uOpacity) {
          o.material.uniforms.uOpacity.value = 1 - p;
        } else {
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
            {strokes && (
              <>
                <TextStroke strokeRef={headingRef} {...strokes.heading} />
                {strokes.body.map((s, i) => (
                  <TextStroke key={i} strokeRef={(el) => { bodyRefs.current[i] = el; }} {...s} />
                ))}
              </>
            )}
          </group>
          <CleanResume groupRef={newRef} />
          <Shine meshRef={shineRef} />
          <group scale={0.85}><Pen penRef={penRef} /></group>
        </group>
      </Center>
    </group>
  );
}
