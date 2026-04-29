"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const CANVAS_W = 1080;
const CANVAS_H = 1080;
const SPLIT_Y  = 750;   // where photo ends and dark section begins
const QM_SIZE  = 130;   // quote mark image height

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
  }
) {
  const { photoImg, photoOffset, quoteText, speakerName, outlet } = opts;
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

  // Disable OpenType contextual alternates and ligatures — these can cause
  // certain glyphs to render at different heights than expected.
  ctx.fontKerning = "none";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ("fontFeatureSettings" in ctx) (ctx as any).fontFeatureSettings = '"calt" 0, "liga" 0, "clig" 0, "dlig" 0';

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const displayQuote = quoteText
    ? quoteText.toUpperCase()
    : "QUOTE TEXT GOES HERE";

  // Scale down from 72pt until the wrapped lines fit in the dark region, min 24pt
  const PT_TO_PX = 96 / 72;
  let fontSizePt = 72;
  let lines: string[] = [];
  let lineH = fontSizePt * PT_TO_PX * 0.98;
  while (fontSizePt > 24) {
    const px = fontSizePt * PT_TO_PX;
    lineH = px * 0.98;
    lines = fontDataUrl ? wrapText(fontDataUrl, px, displayQuote, textMaxW) : [];
    if (lines.length * lineH <= H - SPLIT_Y - 80) break;
    fontSizePt -= 1;
  }

  const fontSizePx = fontSizePt * PT_TO_PX;
  // Distance from first baseline to last baseline
  const quoteSpan = (lines.length - 1) * lineH;
  // Vertically center the quote block within the dark region (SPLIT_Y → H)
  const darkMid = (SPLIT_Y + H) / 2;
  const startY = Math.round(darkMid - quoteSpan / 2);

  // Attribution sits 39px below the last line's baseline,
  // but never pushes the outlet line past 50px from the bottom of the canvas.
  const lastLineY = startY + quoteSpan;
  const attrY = Math.min(lastLineY + 39, H - 90);
  if (fontDataUrl) {
    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const quoteEls = lines.map((line, i) =>
      `<text class="q" x="${W / 2}" y="${Math.round(startY + i * lineH)}" text-anchor="middle">${esc(line)}</text>`
    ).join('\n');
    const speakerEl = speakerName
      ? `<text class="spk" x="${W / 2}" y="${Math.round(attrY)}" text-anchor="middle">${esc(speakerName)}</text>`
      : '';
    const outletEl = outlet
      ? `<text class="out" x="${W / 2}" y="${Math.round(attrY + 40)}" text-anchor="middle">${esc(`to ${outlet}`)}</text>`
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
      ctx.fillText(speakerName, W / 2, attrY);
    }
    if (outlet) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `28px "KuunariMedCond", sans-serif`;
      ctx.fillText(`to ${outlet}`, W / 2, attrY + 40);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function QuotePage() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoOffset,   setPhotoOffset]   = useState({ x: 0, y: 0 });
  const [photoDragging, setPhotoDragging] = useState(false);
  const [quoteText,     setQuoteText]     = useState("");
  const [speakerName,   setSpeakerName]   = useState("");
  const [outlet,        setOutlet]        = useState("");
  const [isRendering,   setIsRendering]   = useState(false);

  const isPanning  = useRef(false);
  const panLastPos = useRef({ x: 0, y: 0 });
  const [isPanningState, setIsPanningState] = useState(false);

  const getCanvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!photoPreviewUrl) return;
    isPanning.current = true;
    setIsPanningState(true);
    panLastPos.current = getCanvasXY(e);
    e.preventDefault();
  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning.current) return;
    const pos = getCanvasXY(e);
    const dx  = pos.x - panLastPos.current.x;
    const dy  = pos.y - panLastPos.current.y;
    panLastPos.current = pos;
    setPhotoOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };
  const handleCanvasMouseUp = () => { isPanning.current = false; setIsPanningState(false); };

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoOffset({ x: 0, y: 0 });
  };

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsRendering(true);
    try {
      const photoImg = photoPreviewUrl ? await loadImage(photoPreviewUrl) : null;
      await drawGraphic(ctx, { photoImg, photoOffset, quoteText, speakerName, outlet });
    } finally {
      setIsRendering(false);
    }
  }, [photoPreviewUrl, photoOffset, quoteText, speakerName, outlet]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${speakerName.replace(/\s+/g, "-") || "quote"}-graphic.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <style>{`
        @font-face { font-family: 'KuunariMedCond'; src: url('/fonts/Kuunari-MediumCondensed.otf') format('opentype'); }
        @font-face { font-family: 'KuunariMedCond'; src: url('/fonts/Akzidenz-Grotesk%20BQ%20Medium%20Condensed.ttf') format('opentype'); }
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

            {/* Photo */}
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
                className={`w-full h-auto select-none ${photoPreviewUrl ? (isPanningState ? "cursor-grabbing" : "cursor-grab") : ""}`}
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
                  Reset position
                </button>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
