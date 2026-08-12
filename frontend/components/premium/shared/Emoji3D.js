"use client";
/**
 * Emoji3D.js — lightweight wrapper around the heavy Emoji3DScene.js. No
 * three/@react-three imports at module scope, so it's safe to import
 * statically from Settings.js; the WebGL code only loads via the
 * next/dynamic call below.
 *
 * Same three-layer fallback to the flat emoji character as Logo3D.js uses
 * for the brand mark — a broken avatar is worse than a plain one:
 *   1. Preflight hasWebGL() check before ever mounting <Canvas>.
 *   2. A React error boundary around it, for anything the preflight missed.
 *   3. A webglcontextlost listener (wired in Emoji3DScene) for a GPU
 *      driver crash or mobile background/foreground context loss after a
 *      successful initial mount.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import React from "react";

const Emoji3DScene = dynamic(() => import("./Emoji3DScene"), { ssr: false, loading: () => null });

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

class Emoji3DBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("Emoji3D: falling back to the flat emoji after a render error", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Emoji3D({ emoji, size = 44, accent = "#f59e0b" }) {
  const [supported, setSupported] = useState(null); // null = still checking

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  const fallback = (
    <span style={{ fontSize: size * 0.55, lineHeight: 1 }} aria-hidden="true">{emoji}</span>
  );

  if (!emoji) return null;
  if (supported !== true) return fallback; // covers both "still checking" and "unsupported"

  return (
    <Emoji3DBoundary fallback={fallback}>
      <Emoji3DScene
        emoji={emoji}
        accent={accent}
        style={{ width: size, height: size }}
        onContextLost={() => setSupported(false)}
      />
    </Emoji3DBoundary>
  );
}
