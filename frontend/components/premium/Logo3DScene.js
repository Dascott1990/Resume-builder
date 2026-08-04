"use client";
/**
 * Logo3DScene.js — the actual WebGL scene. Never import this file statically
 * anywhere; it's only ever reached through Logo3D.js's next/dynamic(ssr:false)
 * call, so three/@react-three/fiber/@react-three/drei stay isolated to a lazy
 * chunk that only downloads on the launcher screen.
 *
 * Renders the Noviq brand mark (Logo.js's MARK_PATH — a stroked 3-segment
 * polyline: short pillar → diagonal bridge → tall pillar) as a real extruded
 * 3D solid, not a generic shape. The path is a *stroke*, not a closed
 * outline ExtrudeGeometry could use directly — rather than hand-deriving an
 * offset polygon (self-intersection risk at the joints breaks
 * triangulation), it's built as always-valid primitives instead: one
 * rectangular beam per segment plus a circular filler at each joint,
 * merged into a single geometry.
 */
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import { useMarkGeometry } from "./markGeometry";

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

function Mark() {
  const geometry = useMarkGeometry();
  const meshRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (reducedMotion) {
      // Not a dead-flat 0 — a fixed pleasant angle so a static render still
      // shows the object's depth instead of a face-on silhouette.
      mesh.rotation.x = 0;
      mesh.rotation.y = 0.4;
      mesh.rotation.z = 0;
      return;
    }
    mesh.rotation.y += delta * 0.15; // ~40s per revolution — slow, ambient
    const targetX = state.pointer.y * 0.15;
    const targetZ = -state.pointer.x * 0.12;
    const k = Math.min(1, delta * 3);
    mesh.rotation.x += (targetX - mesh.rotation.x) * k;
    mesh.rotation.z += (targetZ - mesh.rotation.z) * k;
  });

  return (
    <Center>
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial vertexColors roughness={0.4} metalness={0.65} />
      </mesh>
    </Center>
  );
}

export default function Logo3DScene({ style, className, onContextLost }) {
  return (
    <div style={style} className={className}>
      <Canvas
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        camera={{ position: [0, 0, 130], fov: 35 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => {
            e.preventDefault();
            onContextLost?.();
          });
        }}
      >
        <ambientLight intensity={0.35} color="#2a1f10" />
        <directionalLight position={[40, 60, 80]} intensity={1.4} color="#fff2d9" />
        <directionalLight position={[-60, -20, 40]} intensity={0.5} color="#f59e0b" />
        <Mark />
      </Canvas>
    </div>
  );
}
