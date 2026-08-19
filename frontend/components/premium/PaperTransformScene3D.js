"use client";
/**
 * PaperTransformScene3D.js — lightweight wrapper around the heavy
 * PaperTransformScene.js, same safety pattern as every other 3D piece in
 * this app (Logo3D.js, Flag3D.js): a WebGL preflight check, an error
 * boundary, and a context-loss listener, all falling back to a flat 2D
 * placeholder rather than ever showing a broken section.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import React from "react";
import { FileText } from "lucide-react";

const PaperTransformScene = dynamic(() => import("./PaperTransformScene"), { ssr: false, loading: () => null });

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

class PaperTransformBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err) {
    console.warn("PaperTransformScene3D: falling back to a flat placeholder after a render error", err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function PaperTransformScene3D({ style, className }) {
  const [supported, setSupported] = useState(null); // null = still checking

  useEffect(() => {
    setSupported(hasWebGL());
  }, []);

  const fallback = (
    <div style={style} className={`${className || ""} flex items-center justify-center`}>
      <FileText className="size-16 text-primary/50" />
    </div>
  );

  if (supported !== true) return fallback; // covers both "still checking" and "unsupported"

  return (
    <PaperTransformBoundary fallback={fallback}>
      <PaperTransformScene style={style} className={className} onContextLost={() => setSupported(false)} />
    </PaperTransformBoundary>
  );
}
