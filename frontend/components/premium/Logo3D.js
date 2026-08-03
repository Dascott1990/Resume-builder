"use client";
/**
 * Logo3D.js — lightweight wrapper around the heavy Logo3DScene.js. This file
 * has NO three/@react-three imports at module scope, so it's safe to import
 * statically from page.js; the actual WebGL code only ever loads via the
 * next/dynamic call below.
 *
 * Three independent layers of fallback to the flat 2D LogoMark, because a
 * broken/blank hero is worse than a less flashy one:
 *   1. Preflight hasWebGL() check before ever mounting <Canvas>.
 *   2. A React error boundary around it, for anything the preflight missed.
 *   3. A webglcontextlost listener (wired in Logo3DScene) for a GPU driver
 *      crash or mobile background/foreground context loss after a
 *      successful initial mount.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import React from "react";
import { LogoMark } from "./Logo";

const Logo3DScene = dynamic(() => import("./Logo3DScene"), { ssr: false, loading: () => null });

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

class Logo3DBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("Logo3D: falling back to the 2D mark after a render error", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Logo3D({ size = "100%", style, className }) {
  const [supported, setSupported] = useState(null); // null = still checking

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  const fallback = <LogoMark size={size} style={style} className={className} />;

  if (supported !== true) return fallback; // covers both "still checking" and "unsupported"

  return (
    <Logo3DBoundary fallback={fallback}>
      <Logo3DScene style={style} className={className} onContextLost={() => setSupported(false)} />
    </Logo3DBoundary>
  );
}
