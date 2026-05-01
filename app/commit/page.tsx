"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COLLEGES, College } from "@/lib/colleges";

const CANVAS_W = 1080;
const CANVAS_H = 1350;

// Map college IDs to logos-real slugs where they differ
const LOGO_SLUG_MAP: Record<string, string> = {
  "texas-am":   "texas-a-and-m",
  "pittsburgh": "pitt",
};

// Try logos-real first, then fall back to jersey library
async function loadLogoImage(collegeId: string): Promise<HTMLImageElement | null> {
  const slug = LOGO_SLUG_MAP[collegeId] ?? collegeId;
  const realLogo = await loadImage(`/logos-real/${slug}.png`);
  if (realLogo) return realLogo;

  // Fallback: jersey library
  const exts = ["png", "jpg", "webp", "jpeg"];
  for (const ext of exts) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = `/jerseys/${collegeId}/logo.${ext}?t=${Date.now()}`;
      });
      return img;
    } catch { /* try next */ }
  }
  return null;
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  } catch {
    return null;
  }
}

// Scan an image's pixel data to find the tight bounding box of non-transparent pixels
function getOpaqueBounds(img: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  const oc = document.createElement("canvas");
  oc.width  = img.naturalWidth;
  oc.height = img.naturalHeight;
  const octx = oc.getContext("2d")!;
  octx.drawImage(img, 0, 0);
  const { data } = octx.getImageData(0, 0, oc.width, oc.height);

  let minX = oc.width, minY = oc.height, maxX = 0, maxY = 0;
  for (let y = 0; y < oc.height; y++) {
    for (let x = 0; x < oc.width; x++) {
      if (data[(y * oc.width + x) * 4 + 3] > 8) {   // alpha threshold
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX) return { sx: 0, sy: 0, sw: oc.width, sh: oc.height }; // fully transparent fallback
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

// Scan a PNG's pixel data to find the four corner points of a trapezoid shape
function getTrapezoidCorners(img: HTMLImageElement): {
  tl: [number, number]; tr: [number, number];
  bl: [number, number]; br: [number, number];
} {
  const oc = document.createElement("canvas");
  oc.width  = img.naturalWidth;
  oc.height = img.naturalHeight;
  const octx = oc.getContext("2d")!;
  octx.drawImage(img, 0, 0);
  const { data } = octx.getImageData(0, 0, oc.width, oc.height);
  const IW = oc.width, IH = oc.height;
  const a = (x: number, y: number) => data[(y * IW + x) * 4 + 3];

  let topRow = 0;
  topSearch: for (let y = 0; y < IH; y++) {
    for (let x = 0; x < IW; x++) { if (a(x, y) > 8) { topRow = y; break topSearch; } }
  }
  let botRow = IH - 1;
  botSearch: for (let y = IH - 1; y >= 0; y--) {
    for (let x = 0; x < IW; x++) { if (a(x, y) > 8) { botRow = y; break botSearch; } }
  }

  let tlX = 0, trX = IW - 1;
  for (let x = 0; x < IW; x++)      { if (a(x, topRow) > 8) { tlX = x; break; } }
  for (let x = IW - 1; x >= 0; x--) { if (a(x, topRow) > 8) { trX = x; break; } }

  let blX = 0, brX = IW - 1;
  for (let x = 0; x < IW; x++)      { if (a(x, botRow) > 8) { blX = x; break; } }
  for (let x = IW - 1; x >= 0; x--) { if (a(x, botRow) > 8) { brX = x; break; } }

  return { tl: [tlX, topRow], tr: [trX, topRow], bl: [blX, botRow], br: [brX, botRow] };
}

// Stroke a rounded polygon through an array of points using arcTo for each corner
function drawRoundedPoly(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  r: number
) {
  const n = pts.length;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const A = pts[(i - 1 + n) % n];
    const B = pts[i];
    const C = pts[(i + 1) % n];
    const abLen = Math.hypot(B.x - A.x, B.y - A.y);
    const cr = Math.min(r, abLen / 2);
    const p1 = {
      x: B.x - (B.x - A.x) / abLen * cr,
      y: B.y - (B.y - A.y) / abLen * cr,
    };
    if (i === 0) ctx.moveTo(p1.x, p1.y);
    else         ctx.lineTo(p1.x, p1.y);
    ctx.arcTo(B.x, B.y, C.x, C.y, cr);
  }
  ctx.closePath();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
  borderRadius: number
) {
  const imgAspect = img.naturalWidth / img.naturalHeight;
  const frameAspect = w / h;
  let srcX = 0, srcY = 0, srcW = img.naturalWidth, srcH = img.naturalHeight;

  if (imgAspect > frameAspect) {
    srcW = img.naturalHeight * frameAspect;
    srcX = (img.naturalWidth - srcW) / 2;
  } else {
    srcH = img.naturalWidth / frameAspect;
    srcY = 0; // anchor top
  }

  ctx.save();
  roundedRect(ctx, x, y, w, h, borderRadius);
  ctx.clip();
  ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
  ctx.restore();
}

// True topographic contour lines via Gaussian height field + marching squares
function drawTopoLines(
  ctx: CanvasRenderingContext2D,
  clipFn: () => void,
  startY: number,
  centerY: number
) {
  void centerY;
  ctx.save();
  clipFn();
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.50)";
  ctx.lineWidth = 2.0;

  const bandTop = startY;
  const bandH   = 530;

  // Seeded PRNG — fixed pattern, same every render
  let seed = 0x4a9f3c;
  const rnd = () => {
    seed = (seed ^ (seed << 13)) >>> 0;
    seed = (seed ^ (seed >> 7))  >>> 0;
    seed = (seed ^ (seed << 17)) >>> 0;
    return seed / 0xffffffff;
  };

  // --- Height field: sum of Gaussian hills ---
  const hills = Array.from({ length: 13 }, () => ({
    cx : rnd() * CANVAS_W,
    cy : bandTop + rnd() * bandH,
    amp: 0.5 + rnd() * 0.5,
    sx : 90  + rnd() * 280,
    sy : 50  + rnd() * 140,
  }));

  // --- Pre-compute height at every grid vertex ---
  const COLS = 108, ROWS = 54;
  const cw = CANVAS_W / COLS;
  const ch = bandH   / ROWS;

  const grid: number[][] = [];
  let maxVal = 0;
  for (let r = 0; r <= ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c <= COLS; c++) {
      const x = c * cw;
      const y = bandTop + r * ch;
      let v = 0;
      for (const hill of hills) {
        const dx = (x - hill.cx) / hill.sx;
        const dy = (y - hill.cy) / hill.sy;
        v += hill.amp * Math.exp(-(dx * dx + dy * dy) / 2);
      }
      // Sine-wave noise layer — warps contours without breaking topology
      v += 0.18 * Math.sin(x * 0.022 + y * 0.011)
         + 0.13 * Math.sin(x * 0.013 - y * 0.028)
         + 0.09 * Math.sin(x * 0.038 + y * 0.019)
         + 0.06 * Math.sin(x * 0.009 + y * 0.042);
      grid[r][c] = v;
      if (v > maxVal) maxVal = v;
    }
  }

  // --- Marching squares — 28 evenly-spaced contour levels ---
  const LEVELS = 28;
  for (let lvl = 1; lvl <= LEVELS; lvl++) {
    const threshold = (lvl / (LEVELS + 1)) * maxVal;

    ctx.beginPath();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tl = grid[r][c],         tr = grid[r][c + 1];
        const br = grid[r + 1][c + 1], bl = grid[r + 1][c];
        const x0 = c * cw,             x1 = x0 + cw;
        const y0 = bandTop + r * ch,   y1 = y0 + ch;

        // Linear interpolation along an edge; null = no threshold crossing
        const cross = (
          va: number, vb: number,
          ax: number, ay: number,
          bx: number, by: number
        ): [number, number] | null => {
          if ((va < threshold) === (vb < threshold)) return null;
          const p = (threshold - va) / (vb - va);
          return [ax + p * (bx - ax), ay + p * (by - ay)];
        };

        const pts = [
          cross(tl, tr, x0, y0, x1, y0), // top edge
          cross(tr, br, x1, y0, x1, y1), // right edge
          cross(br, bl, x1, y1, x0, y1), // bottom edge
          cross(bl, tl, x0, y1, x0, y0), // left edge
        ].filter((p): p is [number, number] => p !== null);

        // 2 pts = normal cell, 4 pts = saddle point
        for (let i = 0; i + 1 < pts.length; i += 2) {
          ctx.moveTo(pts[i][0],     pts[i][1]);
          ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
        }
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

async function drawGraphic(
  ctx: CanvasRenderingContext2D,
  opts: {
    primaryHex: string;
    secondaryHex: string;
    logoImg: HTMLImageElement | null;
    photoImg: HTMLImageElement | null;
    recruitName: string;
    position: string;
    stars: number;
    photoOffset: { x: number; y: number };
    photoZoom: number;
    borderColorHex: string;
    showFilterOverlay: boolean;
  }
) {
  const { primaryHex, logoImg, photoImg, recruitName, position, stars, photoOffset, photoZoom, borderColorHex, showFilterOverlay } = opts;
  const W = CANVAS_W, H = CANVAS_H;

  try {
    await document.fonts.load('160px "Teko"');
  } catch { /* ignore */ }

  // ── 1. Background: white + commit-texture.png overlay ───────────────────
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const textureImg = await loadImage("/commit-texture.png");
  if (textureImg) {
    ctx.drawImage(textureImg, 0, 0, W, H);
  }

  // ── Layout constants ─────────────────────────────────────────────────────
  const photoTopY  = 330;
  const photoH     = 790;
  const photoBotY  = photoTopY + photoH;   // 1120
  const photoBotX  = (W - 630) / 2;        // 225
  const photoBotW  = 630;
  const bandCenterY = photoTopY + photoH / 2 - 45;

  // ── 2. commit-bar.png + Linear Dodge (Add) for school color ────────────
  const barImg = await loadImage("/commit-bar.png");
  if (barImg) {
    const barH = W * (barImg.naturalHeight / barImg.naturalWidth);
    const barY = bandCenterY - barH / 2 - 19;

    // Offscreen: lighter (Linear Dodge) recolors black → primary while keeping topo pattern,
    // then destination-in clips result to bar's opaque shape only.
    const off = document.createElement("canvas");
    off.width  = W;
    off.height = Math.ceil(barH);
    const offCtx = off.getContext("2d")!;

    offCtx.drawImage(barImg, 0, 0, W, barH);
    offCtx.globalCompositeOperation = "lighter";
    offCtx.fillStyle = primaryHex;
    offCtx.fillRect(0, 0, W, barH);

    // Light filter overlay — drawn before destination-in so it gets clipped to bar shape
    if (showFilterOverlay) {
      const filterOverlayImg = await loadImage("/filter-overlay.png");
      if (filterOverlayImg) {
        offCtx.globalCompositeOperation = "source-over";
        offCtx.globalAlpha = 0.2;
        offCtx.drawImage(filterOverlayImg, 0, 0, W, barH);
        offCtx.globalAlpha = 1.0;
      }
    }

    offCtx.globalCompositeOperation = "destination-in";
    offCtx.drawImage(barImg, 0, 0, W, barH);

    ctx.drawImage(off, 0, barY);
  }

  // ── 3. School logo ───────────────────────────────────────────────────────
  const logoH    = 140;
  const logoTopY = 22;

  if (logoImg) {
    const { sx, sy, sw, sh } = getOpaqueBounds(logoImg);
    const lW = logoH * (sw / sh);
    ctx.drawImage(logoImg, sx, sy, sw, sh, W / 2 - lW / 2, logoTopY, lW, logoH);
  } else {
    const logoCX = W / 2;
    const logoCY = logoTopY + logoH / 2;
    ctx.beginPath();
    ctx.arc(logoCX, logoCY, logoH / 2, 0, Math.PI * 2);
    ctx.fillStyle = primaryHex;
    ctx.fill();
  }

  // ── 4. committed.png ─────────────────────────────────────────────────────
  const committedImg = await loadImage("/committed.png");
  if (committedImg) {
    const cH = 100;
    const cW = cH * (committedImg.naturalWidth / committedImg.naturalHeight);
    ctx.drawImage(committedImg, W / 2 - cW / 2, 195, cW, cH);
  }

  // ── 5. Photo clipped to exact shape of commit-photo-frame.png ───────────
  // The frame PNG is a shape reference only — it is NEVER drawn to the canvas.
  // We use it as an alpha mask: draw frame on offscreen, then source-in clips
  // the photo to exactly the frame's opaque pixels.
  const photoFrameImg = await loadImage("/commit-photo-frame.png");
  const fH = photoH;
  const fW = photoFrameImg
    ? fH * (photoFrameImg.naturalWidth / photoFrameImg.naturalHeight)
    : photoBotW;
  const fX = W / 2 - fW / 2;
  const fY = photoTopY;

  const off = document.createElement("canvas");
  off.width  = W;
  off.height = H;
  const offCtx = off.getContext("2d")!;

  if (photoFrameImg) {
    // Step 1: paint the frame shape onto the offscreen canvas
    offCtx.drawImage(photoFrameImg, fX, fY, fW, fH);
    // Step 2: source-in — only pixels that overlap the frame shape survive
    offCtx.globalCompositeOperation = "source-in";
  }

  if (photoImg) {
    const imgAspect   = photoImg.naturalWidth / photoImg.naturalHeight;
    const frameAspect = fW / fH;
    let drawW, drawH;
    if (imgAspect > frameAspect) { drawH = fH; drawW = fH * imgAspect; }
    else                         { drawW = fW; drawH = fW / imgAspect; }
    drawW *= photoZoom; drawH *= photoZoom;
    const maxOffsetX = Math.max(0, (drawW - fW) / 2);
    const maxOffsetY = Math.max(0, (drawH - fH) / 2);
    const clampedX   = Math.max(-maxOffsetX, Math.min(maxOffsetX, photoOffset.x));
    const clampedY   = Math.max(-maxOffsetY, Math.min(maxOffsetY, photoOffset.y));
    const drawX      = fX - (drawW - fW) / 2 + clampedX;
    const drawY      = fY - (drawH - fH) / 2 + clampedY;
    offCtx.drawImage(photoImg, 0, 0, photoImg.naturalWidth, photoImg.naturalHeight, drawX, drawY, drawW, drawH);
  } else {
    offCtx.fillStyle = "#2a2a2a";
    offCtx.fillRect(fX, fY, fW, fH);
  }

  // Step 3: composite the masked result onto the main canvas
  ctx.save();
  ctx.shadowColor   = "rgba(0,0,0,0.55)";
  ctx.shadowBlur    = 32;
  ctx.shadowOffsetX = 6;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(off, 0, 0);
  ctx.restore();

  // ── 5b. Vector stroke border with rounded corners ────────────────────────
  if (photoFrameImg) {
    const corners = getTrapezoidCorners(photoFrameImg);
    const scaleX  = fW / photoFrameImg.naturalWidth;
    const scaleY  = fH / photoFrameImg.naturalHeight;

    const pts = [
      { x: fX + corners.tl[0] * scaleX, y: fY + corners.tl[1] * scaleY },
      { x: fX + corners.tr[0] * scaleX, y: fY + corners.tr[1] * scaleY },
      { x: fX + corners.br[0] * scaleX, y: fY + corners.br[1] * scaleY },
      { x: fX + corners.bl[0] * scaleX, y: fY + corners.bl[1] * scaleY },
    ];

    drawRoundedPoly(ctx, pts, 14);
    ctx.strokeStyle = borderColorHex;
    ctx.lineWidth   = 7;
    ctx.stroke();
    ctx.lineWidth   = 1;
  }

  // ── 6. Recruit name — Teko font ──────────────────────────────────────────
  const nameY    = photoBotY + 93;
  const nameText = recruitName ? recruitName.toUpperCase() : "RECRUIT NAME";
  const maxNameW = W - 220;
  let nameFontSize = 85;
  ctx.letterSpacing = "6px";
  ctx.font = `400 ${nameFontSize}px "Teko", sans-serif`;
  const nw = ctx.measureText(nameText).width;
  if (nw > maxNameW) {
    nameFontSize = Math.max(Math.floor(nameFontSize * maxNameW / nw), 40);
    ctx.font = `400 ${nameFontSize}px "Teko", sans-serif`;
  }
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(nameText, W / 2, nameY);
  ctx.letterSpacing = "0px";

  // ── 7. Position | Stars — Teko font ──────────────────────────────────────
  const starsFull = "★".repeat(stars);
  const starsText = starsFull;
  const posText   = position ? position.toUpperCase() : "";
  const lineY     = nameY + 72;

  // Use alphabetic baseline + actual bounding box metrics so both elements
  // share the exact same visual center line regardless of font size or glyph shape.
  ctx.textBaseline = "alphabetic";
  ctx.textAlign    = "left";

  const capCenter  = lineY - 16;
  const sepH       = 44;
  const sepW       = 4;
  const sepGap     = 14;
  const starsFontSize = 54;

  // Measure each element and compute the y that places its visual center at capCenter.
  // With alphabetic baseline: visual center = y - (asc - desc) / 2
  // So y = capCenter + (asc - desc) / 2
  ctx.font = `400 54px "Teko", sans-serif`;
  let posW = 0, posY = capCenter;
  if (posText) {
    const m = ctx.measureText(posText);
    posW = m.width;
    posY = capCenter + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  }

  ctx.font = `400 ${starsFontSize}px "Teko", sans-serif`;
  let starsW = 0, starsY = capCenter;
  if (starsText) {
    const m = ctx.measureText(starsText);
    starsW = m.width;
    starsY = capCenter + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  }

  const totalW = posW + (posText && starsText ? sepGap * 2 + sepW : 0) + starsW;
  let x = W / 2 - totalW / 2;

  if (posText) {
    ctx.font = `400 54px "Teko", sans-serif`;
    ctx.fillStyle = "#111111";
    ctx.fillText(posText, x, posY);
    x += posW;
  }

  if (posText && starsText) {
    x += sepGap;
    ctx.fillStyle = "#111111";
    ctx.fillRect(x, capCenter - sepH / 2, sepW, sepH);
    x += sepW + sepGap;
  }

  if (starsText) {
    ctx.font = `400 ${starsFontSize}px "Teko", sans-serif`;
    ctx.fillStyle = "#a68a50";
    ctx.fillText(starsText, x, starsY);
  }

  ctx.textBaseline = "alphabetic";
  ctx.textAlign    = "center";

  // ── 8. Rivals watermark ──────────────────────────────────────────────────
  const rivalsImg = await loadImage("/rivals.png");
  if (rivalsImg) {
    const rH = 51;
    const rW = rH * (rivalsImg.naturalWidth / rivalsImg.naturalHeight);
    ctx.drawImage(rivalsImg, W - rW - 10, H - rH - 10, rW, rH);
  }
}

export default function CommitPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [college, setCollege] = useState<College | null>(null);
  const [recruitName, setRecruitName] = useState("");
  const [position, setPosition] = useState("");
  const [stars, setStars] = useState(3);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [sessionPhotoData, setSessionPhotoData] = useState<{ imageData: string; mimeType: string; collegeName: string; collegeId: string } | null>(null);
  const [search, setSearch] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [borderUseSecondary, setBorderUseSecondary] = useState(false);
  const [showFilterOverlay, setShowFilterOverlay] = useState(true);

  const CONF_ORDER: Record<string, number> = { SEC: 0, "Big Ten": 1, ACC: 2, "Big 12": 3, Independent: 4 };
  const sortedColleges = [...COLLEGES].sort((a, b) => {
    const cd = (CONF_ORDER[a.conference] ?? 99) - (CONF_ORDER[b.conference] ?? 99);
    return cd !== 0 ? cd : a.name.localeCompare(b.name);
  });
  const filteredColleges = sortedColleges.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Load session photo on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("commitPhoto");
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setSessionPhotoData(data);
        // Auto-select the college if it matches
        const matchedCollege = COLLEGES.find(c => c.id === data.collegeId);
        if (matchedCollege) setCollege(matchedCollege);
      } catch { /* ignore */ }
    }
  }, []);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoDragging, setPhotoDragging] = useState(false);

  // Photo pan offset and zoom within the canvas frame
  const [photoOffset, setPhotoOffset] = useState({ x: 0, y: 0 });
  const [photoZoom, setPhotoZoom] = useState(1.0);
  const isPanning = useRef(false);
  const panLastPos = useRef({ x: 0, y: 0 });
  const [isPanningState, setIsPanningState] = useState(false);

  const hasPhoto = !!(sessionPhotoData || photoPreviewUrl);

  const getCanvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasPhoto) return;
    isPanning.current = true;
    setIsPanningState(true);
    panLastPos.current = getCanvasXY(e);
    e.preventDefault();
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning.current) return;
    const pos = getCanvasXY(e);
    const dx = pos.x - panLastPos.current.x;
    const dy = pos.y - panLastPos.current.y;
    panLastPos.current = pos;
    setPhotoOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleCanvasMouseUp = () => {
    isPanning.current = false;
    setIsPanningState(false);
  };

  // Scroll-wheel zoom on canvas
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!hasPhoto) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setPhotoZoom(prev => Math.max(1.0, Math.min(4.0, Math.round((prev + delta) * 10) / 10)));
  }, [hasPhoto]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setSessionPhotoData(null);
    setPhotoOffset({ x: 0, y: 0 });
    setPhotoZoom(1.0);
  };

  // Handle new file upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPhotoDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePhotoFile(file);
  };

  const clearSessionPhoto = () => {
    setSessionPhotoData(null);
    sessionStorage.removeItem("commitPhoto");
  };

  // Render canvas whenever inputs change
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsRendering(true);
    try {
      // Load photo image
      let photoImg: HTMLImageElement | null = null;
      if (sessionPhotoData) {
        photoImg = await loadImage(`data:${sessionPhotoData.mimeType};base64,${sessionPhotoData.imageData}`);
      } else if (photoPreviewUrl) {
        photoImg = await loadImage(photoPreviewUrl);
      }

      // Load logo
      const logoImg = college ? await loadLogoImage(college.id) : null;

      await drawGraphic(ctx, {
        primaryHex: college?.primaryHex ?? "#1a1a1a",
        secondaryHex: college?.secondaryHex ?? "#FFFFFF",
        logoImg,
        photoImg,
        recruitName,
        position,
        stars,
        photoOffset,
        photoZoom,
        borderColorHex: borderUseSecondary ? (college?.secondaryHex ?? "#ffffff") : "#ffffff",
        showFilterOverlay,
      });
    } finally {
      setIsRendering(false);
    }
  }, [college, recruitName, position, stars, photoPreviewUrl, sessionPhotoData, photoOffset, photoZoom, borderUseSecondary, showFilterOverlay]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${recruitName.replace(/\s+/g, "-") || "recruit"}-committed-${college?.id || "graphic"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const conferenceColors: Record<string, string> = {
    SEC: "bg-blue-900/60 text-blue-300",
    "Big Ten": "bg-red-900/60 text-red-300",
    "Big 12": "bg-orange-900/60 text-orange-300",
    ACC: "bg-purple-900/60 text-purple-300",
    Independent: "bg-gray-700 text-gray-300",
  };

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-lg">Commit Graphic</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <a href="/visits" className="hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Official Visits
            </a>
            <a href="/news" className="hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
              News
            </a>
            <a href="/" className="hover:text-white transition-colors">← Jersey Swap</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: controls */}
          <div className="flex flex-col gap-6">

            {/* School selector */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">School</h2>
              <input
                type="text"
                placeholder="Search programs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm mb-2"
              />
              <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {filteredColleges.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCollege(c)}
                    className={`text-left rounded-lg px-3 py-2 text-sm transition-all border ${
                      college?.id === c.id
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "bg-gray-800 border-gray-700 text-white hover:border-gray-500"
                    }`}
                  >
                    <div className="font-medium truncate">{c.name}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${conferenceColors[c.conference] ?? "bg-gray-700 text-gray-300"}`}>
                      {c.conference}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Recruit Photo</h2>

              {sessionPhotoData && (
                <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3 mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-purple-300 text-sm font-medium">Using Jersey Swap photo</p>
                    <p className="text-purple-400 text-xs">{sessionPhotoData.collegeName} jersey{sessionPhotoData.mimeType === "image/png" ? " (background removed)" : ""}</p>
                  </div>
                  <button onClick={clearSessionPhoto} className="text-purple-400 hover:text-white text-xs underline">
                    Remove
                  </button>
                </div>
              )}

              <div
                onClick={() => photoInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setPhotoDragging(true); }}
                onDragLeave={() => setPhotoDragging(false)}
                onDrop={handlePhotoDrop}
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden relative
                  ${photoDragging
                    ? "border-purple-400 bg-purple-950/30"
                    : "border-gray-700 hover:border-gray-500 bg-gray-800"}`}
              >
                {photoPreviewUrl && !sessionPhotoData ? (
                  <>
                    <img src={photoPreviewUrl} alt="preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm font-medium">Click or drop to change</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-gray-400 text-sm">
                      {photoDragging ? "Drop it!" : "Drop photo here or click to browse"}
                    </span>
                  </>
                )}
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>

              {/* Zoom slider */}
              {hasPhoto && (
                <div className="mt-3 flex items-center gap-3">
                  <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  <input
                    type="range" min="1.0" max="4.0" step="0.05"
                    value={photoZoom}
                    onChange={e => setPhotoZoom(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500"
                  />
                  <span className="text-gray-400 text-xs w-8 text-right">{photoZoom.toFixed(1)}×</span>
                </div>
              )}

              {/* Frame border color */}
              <div className="mt-3">
                <label className="block text-gray-400 text-sm mb-1.5">Frame Border Color</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBorderUseSecondary(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                      !borderUseSecondary
                        ? "bg-gray-100 border-gray-100 text-gray-900 font-medium"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full border border-gray-400 bg-white inline-block shrink-0" />
                    White
                  </button>
                  <button
                    onClick={() => setBorderUseSecondary(true)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                      borderUseSecondary
                        ? "bg-purple-600 border-purple-500 text-white font-medium"
                        : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full inline-block shrink-0 border border-gray-500"
                      style={{ background: college?.secondaryHex ?? "#888" }}
                    />
                    School Color
                  </button>
                </div>
              </div>
            </div>

              {/* Filter overlay toggle */}
              <div className="mt-3">
                <button
                  onClick={() => setShowFilterOverlay(prev => !prev)}
                  className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    showFilterOverlay
                      ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${showFilterOverlay ? "bg-yellow-400" : "bg-gray-600"}`} />
                  Bar overlay {showFilterOverlay ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            {/* Recruit info */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Recruit Info</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Recruit Name</label>
                  <input
                    type="text"
                    value={recruitName}
                    onChange={e => setRecruitName(e.target.value)}
                    placeholder="e.g. John Smith"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Position</label>
                  <input
                    type="text"
                    value={position}
                    onChange={e => setPosition(e.target.value)}
                    placeholder="e.g. QB, WR, OL"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Star Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        onClick={() => setStars(n)}
                        className={`text-2xl transition-transform hover:scale-110 ${n <= stars ? "text-yellow-400" : "text-gray-600"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isRendering}
              className="w-full py-3.5 rounded-xl font-semibold text-base bg-purple-600 hover:bg-purple-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Graphic
            </button>

            <p className="text-gray-600 text-xs text-center">
              Upload school logos in the <a href="/admin" className="text-gray-500 underline hover:text-gray-400">Jersey Library</a> for best results
            </p>
          </div>

          {/* Right: canvas preview */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Preview</h2>
              {isRendering && <span className="text-gray-500 text-xs">Rendering…</span>}
            </div>
            <div className="relative bg-gray-900 rounded-xl overflow-hidden">
              <style>{`
                @font-face {
                  font-family: 'Teko';
                  src: url('/Teko-VariableFont_wght.ttf') format('truetype');
                }
              `}</style>
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className={`w-full h-auto select-none ${hasPhoto ? (isPanningState ? "cursor-grabbing" : "cursor-grab") : ""}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
              {hasPhoto && (photoOffset.x !== 0 || photoOffset.y !== 0 || photoZoom !== 1.0) && (
                <button
                  onClick={() => { setPhotoOffset({ x: 0, y: 0 }); setPhotoZoom(1.0); }}
                  className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Reset photo
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
