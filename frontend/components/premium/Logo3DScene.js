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
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Canvas, useFrame } from "@react-three/fiber";
import { Center } from "@react-three/drei";
import { MARK_STROKE } from "./Logo";

// SVG viewBox is 0 0 100 100, Y-down; three.js is Y-up — center on the
// viewBox and flip Y once here so every downstream number is in "model
// space" already.
const toModelSpace = (svgX, svgY) => [svgX - 50, 50 - svgY];
const [AX, AY] = toModelSpace(22, 90); // base of the short pillar
const [BX, BY] = toModelSpace(22, 52); // top of the short pillar / bridge start
const [CX, CY] = toModelSpace(78, 10); // bridge end / top of the tall pillar
const [DX, DY] = toModelSpace(78, 90); // base of the tall pillar

const DEPTH = 16; // roughly square cross-section with the stroke width — reads as a solid beam, not a flat plaque
const EXTRUDE_SETTINGS = { depth: DEPTH, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 };

// Same 3 stops as the SVG mark's own gradient (Logo.js) — top brightest,
// base deepest, so the 3D version reads as the identical brand gesture.
const GRAD_TOP = new THREE.Color("#F6E6B3");
const GRAD_MID = new THREE.Color("#F59E0B");
const GRAD_BASE = new THREE.Color("#5C4419");
function gradientColor(t, target) {
  return t <= 0.38
    ? target.copy(GRAD_TOP).lerp(GRAD_MID, t / 0.38)
    : target.copy(GRAD_MID).lerp(GRAD_BASE, (t - 0.38) / 0.62);
}

function buildBeamGeometry(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const length = Math.sqrt(dx * dx + dy * dy);
  const hw = MARK_STROKE / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw, length);
  shape.lineTo(-hw, length);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, EXTRUDE_SETTINGS);
  geometry.translate(0, 0, -DEPTH / 2);

  // Rotate the beam (drawn pointing along local +Y) to point from (x0,y0)
  // toward (x1,y1), then move it there — a single bake so no transform
  // needs to be tracked at render time.
  const angle = Math.atan2(dy, dx) - Math.PI / 2;
  const matrix = new THREE.Matrix4().makeRotationZ(angle);
  matrix.setPosition(x0, y0, 0);
  geometry.applyMatrix4(matrix);
  return geometry;
}

function buildJointGeometry(cx, cy) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, MARK_STROKE / 2, 0, Math.PI * 2, false);
  const geometry = new THREE.ExtrudeGeometry(shape, EXTRUDE_SETTINGS);
  geometry.translate(0, 0, -DEPTH / 2);
  geometry.applyMatrix4(new THREE.Matrix4().setPosition(cx, cy, 0));
  return geometry;
}

function useMarkGeometry() {
  return useMemo(() => {
    const pieces = [
      buildBeamGeometry(AX, AY, BX, BY), // short pillar
      buildBeamGeometry(BX, BY, CX, CY), // diagonal bridge
      buildBeamGeometry(CX, CY, DX, DY), // tall pillar
      buildJointGeometry(BX, BY),        // round joint filler
      buildJointGeometry(CX, CY),        // round joint filler
    ];
    const merged = mergeGeometries(pieces);
    merged.computeVertexNormals();
    merged.computeBoundingBox();

    const { min, max } = merged.boundingBox;
    const pos = merged.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = (max.y - pos.getY(i)) / (max.y - min.y || 1);
      gradientColor(t, c);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    merged.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return merged;
  }, []);
}

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
