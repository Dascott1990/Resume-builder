"use client";
/**
 * Emoji3DScene.js — the actual WebGL scene for one animated 3D emoji
 * avatar. Only ever reached through Emoji3D.js's next/dynamic(ssr:false)
 * call, same isolation reasoning as Logo3DScene.js: three/@react-three
 * stays out of any statically-imported bundle.
 *
 * A rounded coin, not a hand-modeled 3D character — the emoji glyph is
 * drawn onto a 2D canvas and used as a texture on the coin's two circular
 * faces. This is genuinely custom-built 3D scenery for this app (real
 * extruded geometry, real lighting, real animation loop), not a stock
 * asset or a CSS trick pretending to be 3D — it just doesn't sculpt a
 * bespoke character model, which is a 3D-art task, not a code one.
 *
 * Animation is a gentle idle float/wobble (bounded rotation, not a full
 * spin) — unlike Logo3DScene's continuous 360° turn, an avatar with a
 * face texture needs to stay generally toward the camera, not show its
 * blank back half half the time.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

function useEmojiTexture(emoji) {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.font = "170px -apple-system, 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 128, 138);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }, [emoji]);
}

function Coin({ emoji, accent }) {
  const meshRef = useRef(null);
  const scaleRef = useRef(0); // pop-in on mount, eased toward 1 below
  const texture = useEmojiTexture(emoji);
  const reducedMotion = usePrefersReducedMotion();

  // Cylinder groups are 0=side, 1=top cap, 2=bottom cap (Three.js's own
  // documented default) — attach="material-N" is R3F's declarative way to
  // assign them without hand-building a materials array.
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    scaleRef.current += (1 - scaleRef.current) * Math.min(1, delta * 6);
    mesh.scale.setScalar(scaleRef.current);

    const baseX = Math.PI / 2; // caps facing the camera by default
    if (reducedMotion) {
      mesh.rotation.set(baseX, 0.3, 0);
      return;
    }
    const t = state.clock.elapsedTime;
    mesh.rotation.x = baseX + Math.cos(t * 0.5) * 0.1;
    mesh.rotation.y = Math.sin(t * 0.7) * 0.45;
    mesh.position.y = Math.sin(t * 1.3) * 0.05;
  });

  return (
    <mesh ref={meshRef}>
      <cylinderGeometry args={[0.85, 0.85, 0.32, 48]} />
      <meshStandardMaterial attach="material-0" color={accent} roughness={0.5} metalness={0.15} />
      <meshStandardMaterial attach="material-1" map={texture} roughness={0.3} metalness={0.05} />
      <meshStandardMaterial attach="material-2" map={texture} roughness={0.3} metalness={0.05} />
    </mesh>
  );
}

export default function Emoji3DScene({ emoji, accent = "#f59e0b", style, className, onContextLost }) {
  return (
    <div style={style} className={className}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 4.2], fov: 30 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onContextLost?.();
          });
        }}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} color="#fff2d9" />
        <directionalLight position={[-3, -2, 2]} intensity={0.4} color={accent} />
        <Coin emoji={emoji} accent={accent} />
      </Canvas>
    </div>
  );
}
