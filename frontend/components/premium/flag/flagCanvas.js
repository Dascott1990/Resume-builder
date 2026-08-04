"use client";
/**
 * flagCanvas.js — draws each supported country's flag onto a 2D canvas,
 * procedurally, at runtime. No image assets anywhere: consistent with how
 * the rest of this app's 3D (the brand mark, the hero constellation) is
 * built from geometry rather than shipped files. Deliberately simplified
 * where a flag's real design is intricate (the Union Jack's exact diagonal
 * offsets, the US's 50-star arrangement) — recognizable, not a vexillology
 * reference.
 */
const W = 300;
const H = 200;

function drawStar(ctx, cx, cy, outerR, innerR, points, color) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// A stylized 11-point maple leaf silhouette — not botanically exact, reads
// as "the Canadian leaf" at flag scale, which is the actual job here.
function drawMapleLeaf(ctx, cx, cy, scale, color) {
  const pts = [
    [0, -42], [7, -22], [24, -26], [16, -8], [34, -2], [18, 10],
    [24, 30], [7, 22], [4, 40], [0, 30], [-4, 40], [-7, 22], [-24, 30],
    [-18, 10], [-34, -2], [-16, -8], [-24, -26], [-7, -22],
  ];
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const px = cx + x * scale, py = cy + y * scale;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

const DRAWERS = {
  CA(ctx) {
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#D80621"; ctx.fillRect(0, 0, W * 0.25, H); ctx.fillRect(W * 0.75, 0, W * 0.25, H);
    drawMapleLeaf(ctx, W / 2, H / 2, 1.05, "#D80621");
  },
  US(ctx) {
    const stripeH = H / 13;
    for (let i = 0; i < 13; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#B22234" : "#FFFFFF";
      ctx.fillRect(0, i * stripeH, W, stripeH + 0.5);
    }
    ctx.fillStyle = "#3C3B6E";
    ctx.fillRect(0, 0, W * 0.4, stripeH * 7);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const x = (W * 0.4 / 6) * (col + 0.5);
        const y = (stripeH * 7 / 5) * (row + 0.5);
        drawStar(ctx, x, y, 4.2, 1.8, 5, "#FFFFFF");
      }
    }
  },
  GB(ctx) {
    ctx.fillStyle = "#00247D"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 34;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, H); ctx.moveTo(W, 0); ctx.lineTo(0, H); ctx.stroke();
    ctx.strokeStyle = "#CF142B"; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, H); ctx.moveTo(W, 0); ctx.lineTo(0, H); ctx.stroke();
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, H / 2 - 34, W, 68); ctx.fillRect(W / 2 - 46, 0, 92, H);
    ctx.fillStyle = "#CF142B"; ctx.fillRect(0, H / 2 - 13, W, 26); ctx.fillRect(W / 2 - 17, 0, 34, H);
  },
  DE(ctx) {
    const bandH = H / 3;
    ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, W, bandH);
    ctx.fillStyle = "#DD0000"; ctx.fillRect(0, bandH, W, bandH);
    ctx.fillStyle = "#FFCE00"; ctx.fillRect(0, bandH * 2, W, bandH);
  },
  FR(ctx) {
    const bandW = W / 3;
    ctx.fillStyle = "#0055A4"; ctx.fillRect(0, 0, bandW, H);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bandW, 0, bandW, H);
    ctx.fillStyle = "#EF4135"; ctx.fillRect(bandW * 2, 0, bandW, H);
  },
  NG(ctx) {
    const bandW = W / 3;
    ctx.fillStyle = "#008751"; ctx.fillRect(0, 0, bandW, H);
    ctx.fillStyle = "#FFFFFF"; ctx.fillRect(bandW, 0, bandW, H);
    ctx.fillStyle = "#008751"; ctx.fillRect(bandW * 2, 0, bandW, H);
  },
  GH(ctx) {
    const bandH = H / 3;
    ctx.fillStyle = "#CE1126"; ctx.fillRect(0, 0, W, bandH);
    ctx.fillStyle = "#FCD116"; ctx.fillRect(0, bandH, W, bandH);
    ctx.fillStyle = "#006B3F"; ctx.fillRect(0, bandH * 2, W, bandH);
    drawStar(ctx, W / 2, H / 2, 22, 9, 5, "#000000");
  },
};

export function drawFlagCanvas(countryCode) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const draw = DRAWERS[countryCode] || DRAWERS.CA;
  draw(ctx);
  return canvas;
}
