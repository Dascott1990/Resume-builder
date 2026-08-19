"use client";
/**
 * markGeometry.js — the Noviq brand mark's 3D geometry, extracted out of
 * Logo3DScene.js (its one current consumer) rather than inlined, so a
 * second place that needs the identical mark shape later has one source to
 * import instead of a hand-copied duplicate that could drift out of sync.
 *
 * Built as always-valid primitives (a rectangular beam per segment + a
 * circular filler at each joint), not a hand-derived offset polygon of the
 * stroke — self-intersection at the joints would break triangulation.
 */
import { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MARK_STROKE } from "./Logo";

// SVG viewBox is 0 0 100 100, Y-down; three.js is Y-up — center on the
// viewBox and flip Y once here so every downstream number is in "model
// space" already.
const toModelSpace = (svgX, svgY) => [svgX - 50, 50 - svgY];
const [AX, AY] = toModelSpace(22, 90); // base of the short pillar
const [BX, BY] = toModelSpace(22, 52); // top of the short pillar / bridge start
const [CX, CY] = toModelSpace(78, 10); // bridge end / top of the tall pillar
const [DX, DY] = toModelSpace(78, 90); // base of the tall pillar

export const DEPTH = 16; // roughly square cross-section with the stroke width — reads as a solid beam, not a flat plaque
const EXTRUDE_SETTINGS = { depth: DEPTH, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 1 };

// Same 3 stops as the SVG mark's own gradient (Logo.js) — top brightest,
// base deepest, so the 3D version reads as the identical brand gesture.
const GRAD_TOP = new THREE.Color("#F6E6B3");
const GRAD_MID = new THREE.Color("#F59E0B");
const GRAD_BASE = new THREE.Color("#5C4419");
export function gradientColor(t, target) {
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

export function useMarkGeometry() {
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
