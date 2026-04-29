"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const CANVAS_W = 1080;
const CANVAS_H = 1080;
const SPLIT_Y  = 750;   // where photo ends and dark section begins
const QM_SIZE  = 130;   // quote mark image height
const CIRCLE_R = 125;   // headshot circle radius → 250 px diameter

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  } catch { return null; }
}

// Cache the bold font as a base64 data URL so we can embed it in SVG
let _boldFontDataUrl: string | null = null;
async function getBoldFontDataUrl(): Promise<string | null> {
  if (_boldFontDataUrl !== null) return _boldFontDataUrl;
  try {
    const resp = await fetch('/fonts/Kuunari-MediumCondensed.otf');
    const blob = await resp.blob();
    _boldFontDataUrl = await new Promise<string>(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return _boldFontDataUrl;
  } catch { return null; }
}

// Measure using an inline SVG with the same embedded font + feature settings
// as the render pass, so getBBox() widths match the output exactly.
function wrapText(fontDataUrl: string, fontPx: number, text: string, maxWidth: number): string[] {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;width:10000px;height:200px;";
  const defs = document.createElementNS(ns, "defs");
  const style = document.createElementNS(ns, "style");
  style.textContent = `@font-face{font-family:'KM';src:url('${fontDataUrl}') format('opentype');}text{font-family:'KM',sans-serif;font-size:${fontPx}px;font-feature-settings:"calt" 0,"liga" 0,"clig" 0,"dlig" 0;}`;
  defs.appendChild(style);
  svg.appendChild(defs);
  const textEl = document.createElementNS(ns, "text");
  svg.appendChild(textEl);
  document.body.appendChild(svg);

  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    textEl.textContent = test;
    if (textEl.getBBox().width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  document.body.removeChild(svg);
  return lines;
}


async function drawGraphic(
  ctx: CanvasRenderingContext2D,
  opts: {
    photoImg: HTMLImageElement | null;
    photoOffset: { x: number; y: number };
    quoteText: string;
    speakerName: string;
    outlet: string;
    photoCredit: string;
    headShotImg: HTMLImageElement | null;
    headShotOffset: { x: number; y: number };
    circlePos: { x: number; y: number };
  }
) {
  const {
    photoImg, photoOffset, quoteText, speakerName, outlet, photoCredit,
    headShotImg, headShotOffset, circlePos,
  } = opts;
  const W = CANVAS_W, H = CANVAS_H;

  // Load font data URL first — used for both SVG measurement and rendering
  const fontDataUrl = await getBoldFontDataUrl();

  // ── Photo section (top) ──────────────────────────────────────────────────
  if (photoImg) {
    const imgAspect   = photoImg.naturalWidth / photoImg.naturalHeight;
    const frameAspect = W / SPLIT_Y;
    let dw: number, dh: number;
    if (imgAspect > frameAspect) {
      dh = SPLIT_Y; dw = SPLIT_Y * imgAspect;
    } else {
      dw = W; dh = W / imgAspect;
    }
    const zoom = 1.1;
    dw *= zoom; dh *= zoom;
    const maxOX = (dw - W) / 2;
    const maxOY = (dh - SPLIT_Y) / 2;
    const cx = Math.max(-maxOX, Math.min(maxOX, photoOffset.x));
    const cy = Math.max(-maxOY, Math.min(maxOY, photoOffset.y));
    const dx = (W - dw) / 2 + cx;
    const dy = (SPLIT_Y - dh) / 2 + cy;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, SPLIT_Y);
    ctx.clip();
    ctx.drawImage(photoImg, 0, 0, photoImg.naturalWidth, photoImg.naturalHeight, dx, dy, dw, dh);
    ctx.restore();

    // Gradient fade at the bottom of the photo into the dark section
    const fadeGrad = ctx.createLinearGradient(0, SPLIT_Y - 300, 0, SPLIT_Y);
    fadeGrad.addColorStop(0, "rgba(25,25,25,0)");
    fadeGrad.addColorStop(1, "rgba(25,25,25,1)");
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(0, SPLIT_Y - 300, W, 300);

    // ── On3 logo — sample top-right brightness to pick light vs dark ──────
    const logoW = 148;
    const logoPad = 24;
    const sampleX = W - logoW - logoPad;
    const sampleY = logoPad;
    const sampleW = logoW;
    const sampleH = 60;
    const sampleData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH).data;
    let totalLum = 0;
    for (let i = 0; i < sampleData.length; i += 4) {
      totalLum += 0.299 * sampleData[i] + 0.587 * sampleData[i + 1] + 0.114 * sampleData[i + 2];
    }
    const avgLum = totalLum / (sampleData.length / 4);
    const on3Src = avgLum > 140 ? "/on3-dark.png" : "/on3-light.png";
    const on3Img = await loadImage(on3Src);
    if (on3Img) {
      const on3H = logoW * (on3Img.naturalHeight / on3Img.naturalWidth);
      ctx.drawImage(on3Img, W - logoW - logoPad, logoPad, logoW, on3H);
    }

    // ── Photo credit — upper left, auto light/dark ───────────────────────
    if (photoCredit) {
      const creditPad = 12;
      const creditFontSize = 18;
      const creditText = `Photo: ${photoCredit}`;
      const creditSampleY = creditPad;
      const creditSampleData = ctx.getImageData(creditPad, creditSampleY, 280, 30).data;
      let creditLum = 0;
      for (let i = 0; i < creditSampleData.length; i += 4) {
        creditLum += 0.299 * creditSampleData[i] + 0.587 * creditSampleData[i + 1] + 0.114 * creditSampleData[i + 2];
      }
      const creditAvgLum = creditLum / (creditSampleData.length / 4);
      ctx.save();
      ctx.font = `${creditFontSize}px sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = creditAvgLum > 140 ? "rgba(0,0,0,0.75)" : "rgba(255,255,255,0.85)";
      ctx.fillText(creditText, creditPad, creditSampleY);
      ctx.restore();
    }
  } else {
    // Placeholder
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, W, SPLIT_Y);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = '28px sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Upload a photo", W / 2, SPLIT_Y / 2);
  }

  // ── Headshot circle overlay (drawn on top of photo area, before dark section) ──
  if (headShotImg) {
    const hcx = circlePos.x;
    const hcy = circlePos.y;

    // Sample brightness at circle centre to pick border colour
    const sR = 30;
    const sX = Math.max(0, Math.round(hcx - sR));
    const sY = Math.max(0, Math.round(hcy - sR));
    const sW = Math.min(sR * 2, W - sX);
    const sH = Math.min(sR * 2, H - sY);
    const hsData = ctx.getImageData(sX, sY, sW, sH).data;
    let hsLum = 0;
    for (let i = 0; i < hsData.length; i += 4) {
      hsLum += 0.299 * hsData[i] + 0.587 * hsData[i + 1] + 0.114 * hsData[i + 2];
    }
    const hsAvgLum = hsLum / (hsData.length / 4);
    const borderColor = hsAvgLum > 128 ? "#111111" : "#ffffff";
    const borderWidth = 5;

    // Scale headshot to cover the circle (same cover logic as main photo)
    const hsAspect = headShotImg.naturalWidth / headShotImg.naturalHeight;
    const diameter = CIRCLE_R * 2;
    let hsDw: number, hsDh: number;
    if (hsAspect > 1) {
      hsDh = diameter; hsDw = diameter * hsAspect;
    } else {
      hsDw = diameter; hsDh = diameter / hsAspect;
    }
    const hsZoom = 1.1;
    hsDw *= hsZoom; hsDh *= hsZoom;
    const maxOX = (hsDw - diameter) / 2;
    const maxOY = (hsDh - diameter) / 2;
    const ox = Math.max(-maxOX, Math.min(maxOX, headShotOffset.x));
    const oy = Math.max(-maxOY, Math.min(maxOY, headShotOffset.y));
    const hsDx = hcx - hsDw / 2 + ox;
    const hsDy = hcy - hsDh / 2 + oy;

    // Clip to circle, draw headshot
    ctx.save();
    ctx.beginPath();
    ctx.arc(hcx, hcy, CIRCLE_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      headShotImg,
      0, 0, headShotImg.naturalWidth, headShotImg.naturalHeight,
      hsDx, hsDy, hsDw, hsDh
    );
    ctx.restore();

    // Border ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(hcx, hcy, CIRCLE_R + borderWidth / 2, 0, Math.PI * 2);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.stroke();
    ctx.restore();
  }

  // ── Dark bottom section ───────────────────────────────────────────────────
  ctx.fillStyle = "#191919";
  ctx.fillRect(0, SPLIT_Y, W, H - SPLIT_Y);

  // ── Quote mark image ──────────────────────────────────────────────────────
  const qmImg = await loadImage("/quote.png");
  if (qmImg) {
    const qmX = (W - qmImg.naturalWidth) / 2;
    const qmY = 650;   // fixed 650px from top
    ctx.drawImage(qmImg, qmX, qmY);
  }

  // ── Quote text ────────────────────────────────────────────────────────────
  const textPad  = 72;
  const textMaxW = W - textPad * 2;
  const qmNatH   = qmImg ? qmImg.naturalHeight : QM_SIZE;
  const quoteTop = SPLIT_Y + (qmImg ? qmNatH * 0.55 : 20) - 60;

  // Disable OpenType contextual alternates and ligatures
  ctx.fontKerning = "none";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ("fontFeatureSettings" in ctx) (ctx as any).fontFeatureSettings = '"calt" 0, "liga" 0, "clig" 0, "dlig" 0';

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const displayQuote = quoteText
    ? quoteText.toUpperCase()
    : "QUOTE TEXT GOES HERE";

  // ── Layout zones within the dark region ──────────────────────────────────
  const ZONE_QUOTE_END   = H - 120;  // 960  — bottom of quote zone
  const ZONE_SPEAKER_END = H - 60;   // 1020 — bottom of speaker zone

  const SPEAKER_Y = ZONE_SPEAKER_END - 10;
  const OUTLET_Y  = ZONE_SPEAKER_END + 28;

  const PT_TO_PX = 96 / 72;
  const quoteZoneH = ZONE_QUOTE_END - SPLIT_Y;
  let fontSizePt = 96;
  let lines: string[] = [];
  let lineH = fontSizePt * PT_TO_PX * 0.98;
  while (fontSizePt > 24) {
    const px = fontSizePt * PT_TO_PX;
    lineH = px * 0.98;
    lines = fontDataUrl ? wrapText(fontDataUrl, px, displayQuote, textMaxW) : [];
    if (lines.length * lineH <= quoteZoneH) break;
    fontSizePt -= 1;
  }

  const fontSizePx = fontSizePt * PT_TO_PX;
  const quoteSpan  = (lines.length - 1) * lineH;
  const capH   = fontSizePx * 0.72;
  const startY = Math.round(SPLIT_Y + (quoteZoneH - capH - quoteSpan) / 2 + capH);

  // suppress unused warning
  void quoteTop;

  if (fontDataUrl) {
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const quoteEls = lines.map((line, i) =>
      `<text class="q" x="${W / 2}" y="${Math.round(startY + i * lineH)}" text-anchor="middle">${esc(line)}</text>`
    ).join('\n');
    const speakerEl = speakerName
      ? `<text class="spk" x="${W / 2}" y="${SPEAKER_Y}" text-anchor="middle">${esc(speakerName)}</text>`
      : '';
    const outletEl = outlet
      ? `<text class="out" x="${W / 2}" y="${OUTLET_Y}" text-anchor="middle">${esc(`to ${outlet}`)}</text>`
      : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><style>
        @font-face { font-family:'KuunariEmbed'; src:url('${fontDataUrl}') format('opentype'); }
        text { font-family:'KuunariEmbed',sans-serif;
               font-feature-settings:"calt" 0,"liga" 0,"clig" 0,"dlig" 0,"kern" 0; }
        .q   { font-size:${fontSizePx}px; fill:white; }
        .spk { font-size:32px; fill:white; }
        .out { font-size:28px; fill:rgba(255,255,255,0.5); }
      </style></defs>
      ${quoteEls}
      ${speakerEl}
      ${outletEl}
    </svg>`;
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl  = URL.createObjectURL(svgBlob);
    const svgImg  = await loadImage(svgUrl);
    URL.revokeObjectURL(svgUrl);
    if (svgImg) ctx.drawImage(svgImg, 0, 0, W, H);

  } else {
    // Fallback: direct canvas text
    ctx.font = `normal normal ${fontSizePx}px "KuunariMedCond", sans-serif`;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, startY + i * lineH);
    }
    if (speakerName) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `32px "KuunariMedCond", sans-serif`;
      ctx.fillText(speakerName, W / 2, SPEAKER_Y);
    }
    if (outlet) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `28px "KuunariMedCond", sans-serif`;
      ctx.fillText(`to ${outlet}`, W / 2, OUTLET_Y);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function QuotePage() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const photoInputRef  = useRef<HTMLInputElement>(null);
  const headShotInputRef = useRef<HTMLInputElement>(null);

  // Main photo state
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoOffset,   setPhotoOffset]   = useState({ x: 0, y: 0 });
  const [photoDragging, setPhotoDragging] = useState(false);

  // Headshot overlay state
  const [headShotUrl,     setHeadShotUrl]     = useState<string | null>(null);
  const [headShotOffset,  setHeadShotOffset]  = useState({ x: 0, y: 0 });
  const [circlePos,       setCirclePos]       = useState({ x: 200, y: 200 });
  const [headShotMode,    setHeadShotMode]    = useState<'move' | 'pan'>('move');
  const [headShotDragging, setHeadShotDragging] = useState(false); // drop-zone hover

  // Quote / attribution
  const [quoteText,     setQuoteText]     = useState("");
  const [speakerName,   setSpeakerName]   = useState("");
  const [outlet,        setOutlet]        = useState("");
  const [photoCredit,   setPhotoCredit]   = useState("");
  const [isRendering,   setIsRendering]   = useState(false);

  // Drag refs (avoid stale-closure issues)
  const isPanning          = useRef(false);
  const panLastPos         = useRef({ x: 0, y: 0 });
  const isHeadShotDragging = useRef(false);
  const headShotLastPos    = useRef({ x: 0, y: 0 });

  // Mirror drag refs as state just for cursor styling
  const [isPanningState,         setIsPanningState]         = useState(false);
  const [isHeadShotDraggingState, setIsHeadShotDraggingState] = useState(false);

  // ── Canvas coordinate helper ────────────────────────────────────────────
  const getCanvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  };

  // Returns true if pos is inside the headshot circle
  const isInHeadShotCircle = (pos: { x: number; y: number }) => {
    const dx = pos.x - circlePos.x;
    const dy = pos.y - circlePos.y;
    return Math.sqrt(dx * dx + dy * dy) <= CIRCLE_R;
  };

  // ── Canvas mouse handlers ───────────────────────────────────────────────
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasXY(e);

    if (headShotUrl && isInHeadShotCircle(pos)) {
      // Click is on the headshot circle — pan headshot or move frame
      isHeadShotDragging.current = true;
      setIsHeadShotDraggingState(true);
      headShotLastPos.current = pos;
      e.preventDefault();
    } else if (photoPreviewUrl) {
      // Click is outside circle (or no headshot) — pan main photo
      isPanning.current = true;
      setIsPanningState(true);
      panLastPos.current = pos;
      e.preventDefault();
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasXY(e);

    if (isHeadShotDragging.current) {
      const dx = pos.x - headShotLastPos.current.x;
      const dy = pos.y - headShotLastPos.current.y;
      headShotLastPos.current = pos;

      if (headShotMode === 'move') {
        // Move the circle frame, constrained to the photo area
        setCirclePos(prev => ({
          x: Math.max(CIRCLE_R, Math.min(CANVAS_W - CIRCLE_R, prev.x + dx)),
          y: Math.max(CIRCLE_R, Math.min(SPLIT_Y  - CIRCLE_R, prev.y + dy)),
        }));
      } else {
        // Pan the headshot photo inside the circle
        setHeadShotOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      }
    } else if (isPanning.current) {
      const dx = pos.x - panLastPos.current.x;
      const dy = pos.y - panLastPos.current.y;
      panLastPos.current = pos;
      setPhotoOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    }
  };

  const handleCanvasMouseUp = () => {
    isPanning.current = false;
    setIsPanningState(false);
    isHeadShotDragging.current = false;
    setIsHeadShotDraggingState(false);
  };

  // ── File handlers ───────────────────────────────────────────────────────
  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoOffset({ x: 0, y: 0 });
  };

  const handleHeadShotFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setHeadShotUrl(URL.createObjectURL(file));
    setHeadShotOffset({ x: 0, y: 0 });
    setCirclePos({ x: 200, y: 200 });
    setHeadShotMode('move');
  };

  // ── Canvas render ────────────────────────────────────────────────────────
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsRendering(true);
    try {
      const photoImg    = photoPreviewUrl ? await loadImage(photoPreviewUrl) : null;
      const headShotImg = headShotUrl     ? await loadImage(headShotUrl)     : null;
      await drawGraphic(ctx, {
        photoImg, photoOffset, quoteText, speakerName, outlet, photoCredit,
        headShotImg, headShotOffset, circlePos,
      });
    } finally {
      setIsRendering(false);
    }
  }, [photoPreviewUrl, photoOffset, quoteText, speakerName, outlet, photoCredit,
      headShotUrl, headShotOffset, circlePos]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${speakerName.replace(/\s+/g, "-") || "quote"}-graphic.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Cursor class for the canvas
  const isDraggingAnything = isPanningState || isHeadShotDraggingState;
  const canvasCursor = isDraggingAnything
    ? "cursor-grabbing"
    : (photoPreviewUrl || headShotUrl) ? "cursor-grab" : "";

  return (
    <div className="min-h-screen bg-gray-950">
      <style>{`
        @font-face { font-family: 'KuunariMedCond'; src: url('/fonts/Kuunari-MediumCondensed.otf') format('opentype'); }
      `}</style>

      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-lg">Quote Graphic</h1>
          </div>
          <a href="/" className="text-sm text-gray-400 hover:text-white transition-colors">← Home</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Controls */}
          <div className="flex flex-col gap-6">

            {/* Main Photo */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Photo</h2>
              <div
                onClick={() => photoInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setPhotoDragging(true); }}
                onDragLeave={() => setPhotoDragging(false)}
                onDrop={e => { e.preventDefault(); setPhotoDragging(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoFile(f); }}
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden relative
                  ${photoDragging ? "border-purple-400 bg-purple-950/30" : "border-gray-700 hover:border-gray-500 bg-gray-800"}`}
              >
                {photoPreviewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); }} />
              </div>
            </div>

            {/* Photo credit */}
            <div>
              <label className="block text-gray-400 text-sm mb-1.5">Photo credit</label>
              <input
                type="text"
                value={photoCredit}
                onChange={e => setPhotoCredit(e.target.value)}
                placeholder="e.g. Imagn"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
              />
            </div>

            {/* Headshot Overlay */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-lg">Headshot Overlay</h2>
                <span className="text-gray-500 text-xs">Optional</span>
              </div>
              <div
                onClick={() => headShotInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setHeadShotDragging(true); }}
                onDragLeave={() => setHeadShotDragging(false)}
                onDrop={e => { e.preventDefault(); setHeadShotDragging(false); const f = e.dataTransfer.files[0]; if (f) handleHeadShotFile(f); }}
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden relative
                  ${headShotDragging ? "border-purple-400 bg-purple-950/30" : "border-gray-700 hover:border-gray-500 bg-gray-800"}`}
              >
                {headShotUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headShotUrl} alt="headshot preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm font-medium">Click or drop to change</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6 text-gray-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-400 text-sm">
                      {headShotDragging ? "Drop it!" : "Drop headshot or click to browse"}
                    </span>
                  </>
                )}
                <input ref={headShotInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleHeadShotFile(f); }} />
              </div>

              {headShotUrl && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-gray-500 text-xs">Drag on the preview to interact. Switch modes below.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHeadShotMode('move')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        headShotMode === 'move'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      Move frame
                    </button>
                    <button
                      onClick={() => setHeadShotMode('pan')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        headShotMode === 'pan'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      Pan headshot
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setHeadShotOffset({ x: 0, y: 0 });
                      setCirclePos({ x: 200, y: 200 });
                    }}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
                  >
                    Reset position
                  </button>
                  <button
                    onClick={() => {
                      setHeadShotUrl(null);
                      setHeadShotOffset({ x: 0, y: 0 });
                      setCirclePos({ x: 200, y: 200 });
                    }}
                    className="text-xs text-red-500/70 hover:text-red-400 transition-colors text-left"
                  >
                    Remove headshot
                  </button>
                </div>
              )}
            </div>

            {/* Quote */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Quote</h2>
              <textarea
                value={quoteText}
                onChange={e => setQuoteText(e.target.value)}
                placeholder="Type the quote here…"
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm resize-none"
              />
            </div>

            {/* Attribution */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Attribution</h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Who said it</label>
                  <input
                    type="text"
                    value={speakerName}
                    onChange={e => setSpeakerName(e.target.value)}
                    placeholder="e.g. Kentucky transfer Ja'Mori Maclin"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Who they said it to</label>
                  <input
                    type="text"
                    value={outlet}
                    onChange={e => setOutlet(e.target.value)}
                    placeholder="e.g. KSR+"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                  />
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
          </div>

          {/* Canvas preview */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-lg">Preview</h2>
              {isRendering && <span className="text-gray-500 text-xs">Rendering…</span>}
            </div>
            <div className="relative bg-gray-900 rounded-xl overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className={`w-full h-auto select-none ${canvasCursor}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
              {photoPreviewUrl && (photoOffset.x !== 0 || photoOffset.y !== 0) && (
                <button
                  onClick={() => setPhotoOffset({ x: 0, y: 0 })}
                  className="absolute bottom-3 left-3 bg-black/60 hover:bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  Reset photo position
                </button>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
