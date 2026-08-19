"use client";
/**
 * Flag3D.js — lightweight wrapper around the heavy FlagScene.js, same
 * three-layer safety pattern as Logo3D.js and PaperTransformScene3D.js: a
 * WebGL preflight check, an error boundary, and a context-loss listener,
 * all falling back to the same flag drawn flat on a plain <canvas> instead
 * of ever showing a broken badge.
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import React from "react";
import { drawFlagCanvas } from "./flagCanvas";

const FlagScene = dynamic(() => import("./FlagScene"), { ssr: false, loading: () => null });

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

function FlatFlagFallback({ countryCode, style, className }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const src = drawFlagCanvas(countryCode);
    el.width = src.width;
    el.height = src.height;
    el.getContext("2d").drawImage(src, 0, 0);
  }, [countryCode]);
  return (
    <div style={style} className={`${className || ""} flex items-center justify-center`}>
      <canvas ref={ref} className="max-h-full max-w-full rounded-sm shadow-[0_4px_16px_rgba(0,0,0,0.35)]" />
    </div>
  );
}

class Flag3DBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("Flag3D: falling back to a flat flag after a render error", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Flag3D({ countryCode, style, className }) {
  const [supported, setSupported] = useState(null);

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  const fallback = <FlatFlagFallback countryCode={countryCode} style={style} className={className} />;

  if (supported !== true) return fallback;

  return (
    <Flag3DBoundary fallback={fallback}>
      <FlagScene countryCode={countryCode} style={style} className={className} onContextLost={() => setSupported(false)} />
    </Flag3DBoundary>
  );
}
