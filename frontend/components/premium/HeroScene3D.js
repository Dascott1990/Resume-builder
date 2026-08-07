"use client";
/**
 * HeroScene3D.js — lightweight wrapper around the heavy HeroPaperScene.js,
 * mirroring Logo3D.js's exact safety pattern (see that file's own docblock
 * for why): a WebGL preflight check, an error boundary, and a context-loss
 * listener, all falling back to the flat 2D mark rather than ever showing
 * a broken hero.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import React from "react";
import { LogoMark } from "./Logo";

const HeroPaperScene = dynamic(() => import("./HeroPaperScene"), { ssr: false, loading: () => null });

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

class HeroScene3DBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("HeroScene3D: falling back to the 2D mark after a render error", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function HeroScene3D({ style, className }) {
  const [supported, setSupported] = useState(null); // null = still checking

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  const fallback = (
    <div style={style} className={`${className || ""} flex items-center justify-center`}>
      <LogoMark size="42%" />
    </div>
  );

  if (supported !== true) return fallback; // covers both "still checking" and "unsupported"

  return (
    <HeroScene3DBoundary fallback={fallback}>
      <HeroPaperScene style={style} className={className} onContextLost={() => setSupported(false)} />
    </HeroScene3DBoundary>
  );
}
