"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const CANVAS_W     = 1080;
const CANVAS_H     = 1350;
const PHOTO_SPLIT  = 885;
const RN_H         = 112;                       // recruiting-news.png height (1080×112)
const TEXT_PANEL_Y = PHOTO_SPLIT + RN_H;        // 997
const LOGO_PANEL_H = 140;
const LOGO_PANEL_Y = CANVAS_H - LOGO_PANEL_H;   // 1210
const TEXT_PANEL_H = LOGO_PANEL_Y - TEXT_PANEL_Y; // 213
const PT_TO_PX     = 96 / 72;
const MAX_LOGOS    = 8;

const SCHOOLS = [
  { slug: "alabama",           name: "Alabama" },
  { slug: "arizona",           name: "Arizona" },
  { slug: "arizona-state",     name: "Arizona State" },
  { slug: "arkansas",          name: "Arkansas" },
  { slug: "auburn",            name: "Auburn" },
  { slug: "baylor",            name: "Baylor" },
  { slug: "boston-college",    name: "Boston College" },
  { slug: "byu",               name: "BYU" },
  { slug: "cal",               name: "Cal" },
  { slug: "cincinnati",        name: "Cincinnati" },
  { slug: "clemson",           name: "Clemson" },
  { slug: "colorado",          name: "Colorado" },
  { slug: "duke",              name: "Duke" },
  { slug: "florida",           name: "Florida" },
  { slug: "florida-state",     name: "Florida State" },
  { slug: "georgia",           name: "Georgia" },
  { slug: "georgia-tech",      name: "Georgia Tech" },
  { slug: "houston",           name: "Houston" },
  { slug: "illinois",          name: "Illinois" },
  { slug: "indiana",           name: "Indiana" },
  { slug: "iowa",              name: "Iowa" },
  { slug: "iowa-state",        name: "Iowa State" },
  { slug: "kansas",            name: "Kansas" },
  { slug: "kansas-state",      name: "Kansas State" },
  { slug: "kentucky",          name: "Kentucky" },
  { slug: "louisville",        name: "Louisville" },
  { slug: "lsu",               name: "LSU" },
  { slug: "maryland",          name: "Maryland" },
  { slug: "miami",             name: "Miami" },
  { slug: "michigan",          name: "Michigan" },
  { slug: "michigan-state",    name: "Michigan State" },
  { slug: "minnesota",         name: "Minnesota" },
  { slug: "mississippi-state", name: "Mississippi State" },
  { slug: "missouri",          name: "Missouri" },
  { slug: "nc-state",          name: "NC State" },
  { slug: "nebraska",          name: "Nebraska" },
  { slug: "north-carolina",    name: "North Carolina" },
  { slug: "northwestern",      name: "Northwestern" },
  { slug: "notre-dame",        name: "Notre Dame" },
  { slug: "oklahoma",          name: "Oklahoma" },
  { slug: "oklahoma-state",    name: "Oklahoma State" },
  { slug: "ole-miss",          name: "Ole Miss" },
  { slug: "oregon",            name: "Oregon" },
  { slug: "oregon-state",      name: "Oregon State" },
  { slug: "penn-state",        name: "Penn State" },
  { slug: "pitt",              name: "Pitt" },
  { slug: "purdue",            name: "Purdue" },
  { slug: "rutgers",           name: "Rutgers" },
  { slug: "smu",               name: "SMU" },
  { slug: "south-carolina",    name: "South Carolina" },
  { slug: "stanford",          name: "Stanford" },
  { slug: "syracuse",          name: "Syracuse" },
  { slug: "tcu",               name: "TCU" },
  { slug: "tennessee",         name: "Tennessee" },
  { slug: "texas",             name: "Texas" },
  { slug: "texas-am",          name: "Texas A&M" },
  { slug: "texas-tech",        name: "Texas Tech" },
  { slug: "ucf",               name: "UCF" },
  { slug: "ucla",              name: "UCLA" },
  { slug: "usc",               name: "USC" },
  { slug: "utah",              name: "Utah" },
  { slug: "vanderbilt",        name: "Vanderbilt" },
  { slug: "virginia",          name: "Virginia" },
  { slug: "virginia-tech",     name: "Virginia Tech" },
  { slug: "wake-forest",       name: "Wake Forest" },
  { slug: "washington",        name: "Washington" },
  { slug: "west-virginia",     name: "West Virginia" },
  { slug: "wisconsin",         name: "Wisconsin" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

let _fontDataUrl: string | null = null;
async function getFontDataUrl(): Promise<string | null> {
  if (_fontDataUrl !== null) return _fontDataUrl;
  try {
    const resp = await fetch("/fonts/Kuunari-MediumCondensed.otf");
    const blob = await resp.blob();
    _fontDataUrl = await new Promise<string>(res => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(blob);
    });
    return _fontDataUrl;
  } catch { return null; }
}

// Measure the widest line using inline SVG + getBBox (same font/settings as render)
function measureMaxLineWidth(fontDataUrl: string, fontPx: number, lines: string[]): number {
  const ns  = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden;width:10000px;height:500px;";
  const defs  = document.createElementNS(ns, "defs");
  const style = document.createElementNS(ns, "style");
  style.textContent = `@font-face{font-family:'KM';src:url('${fontDataUrl}') format('opentype');}text{font-family:'KM',sans-serif;font-size:${fontPx}px;font-feature-settings:"calt" 0,"liga" 0,"clig" 0,"dlig" 0;}`;
  defs.appendChild(style);
  svg.appendChild(defs);
  const textEl = document.createElementNS(ns, "text");
  svg.appendChild(textEl);
  document.body.appendChild(svg);
  let maxW = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    textEl.textContent = line;
    maxW = Math.max(maxW, textEl.getBBox().width);
  }
  document.body.removeChild(svg);
  return maxW;
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

async function drawGraphic(
  ctx: CanvasRenderingContext2D,
  opts: {
    photoImg: HTMLImageElement | null;
    photoOffset: { x: number; y: number };
    photoZoom: number;
    filterEnabled: boolean;
    headlineText: string;
    logoImgs: (HTMLImageElement | null)[];
  }
) {
  const { photoImg, photoOffset, photoZoom, filterEnabled, headlineText, logoImgs } = opts;
  const W = CANVAS_W, H = CANVAS_H;
  const fontDataUrl = await getFontDataUrl();

  // ── Photo ──────────────────────────────────────────────────────────────────
  if (photoImg) {
    const imgAspect   = photoImg.naturalWidth / photoImg.naturalHeight;
    const frameAspect = W / PHOTO_SPLIT;
    let dw: number, dh: number;
    if (imgAspect > frameAspect) {
      dh = PHOTO_SPLIT; dw = PHOTO_SPLIT * imgAspect;
    } else {
      dw = W; dh = W / imgAspect;
    }
    dw *= photoZoom; dh *= photoZoom;
    const maxOX = Math.max(0, (dw - W) / 2);
    const maxOY = Math.max(0, (dh - PHOTO_SPLIT) / 2);
    const ox = Math.max(-maxOX, Math.min(maxOX, photoOffset.x));
    const oy = Math.max(-maxOY, Math.min(maxOY, photoOffset.y));
    const dx = (W - dw) / 2 + ox;
    const dy = (PHOTO_SPLIT - dh) / 2 + oy;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, PHOTO_SPLIT);
    ctx.clip();
    // Camera Raw simulation: contrast + saturation + brightness boost
    ctx.filter = filterEnabled ? "contrast(1.32) saturate(1.28) brightness(0.88)" : "none";
    ctx.drawImage(photoImg, 0, 0, photoImg.naturalWidth, photoImg.naturalHeight, dx, dy, dw, dh);
    ctx.filter = "none";
    ctx.restore();

    // Gradient fade from photo into dark panel
    const grad = ctx.createLinearGradient(0, PHOTO_SPLIT - 300, 0, PHOTO_SPLIT);
    grad.addColorStop(0, "rgba(29,37,44,0)");
    grad.addColorStop(1, "rgba(29,37,44,1)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, PHOTO_SPLIT - 300, W, 300);

    // ── Rivals logo — sample brightness top-right ────────────────────────────
    const logoW   = 148;
    const logoPad = 24;
    const sData = ctx.getImageData(W - logoW - logoPad, logoPad, logoW, 60).data;
    let lum = 0;
    for (let i = 0; i < sData.length; i += 4) {
      lum += 0.299 * sData[i] + 0.587 * sData[i + 1] + 0.114 * sData[i + 2];
    }
    const rivalsSrc = (lum / (sData.length / 4)) > 140 ? "/rivals-black1.png" : "/rivals-white1.png";
    const rivalsImg = await loadImage(rivalsSrc);
    if (rivalsImg) {
      const rH = logoW * (rivalsImg.naturalHeight / rivalsImg.naturalWidth);
      ctx.drawImage(rivalsImg, W - logoW - logoPad, logoPad, logoW, rH);
    }
  } else {
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, W, PHOTO_SPLIT);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Upload a photo", W / 2, PHOTO_SPLIT / 2);
  }

  // ── Dark panel ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#1d252c";
  ctx.fillRect(0, PHOTO_SPLIT, W, H - PHOTO_SPLIT);

  // ── Recruiting News banner ────────────────────────────────────────────────
  const rnImg = await loadImage("/recruiting-news.png");
  if (rnImg) ctx.drawImage(rnImg, 0, PHOTO_SPLIT, W, RN_H);

  // ── Headline text ─────────────────────────────────────────────────────────
  const rawLines  = headlineText
    ? headlineText.toUpperCase().split("\n").filter(l => l.trim())
    : ["HEADLINE TEXT"];
  const textPadX  = 60;
  const maxTextW  = W - textPadX * 2;

  let fontSizePt = 72;
  let lineH      = fontSizePt * PT_TO_PX * 1.08;
  if (fontDataUrl) {
    while (fontSizePt > 18) {
      const px = fontSizePt * PT_TO_PX;
      lineH = px * 1.08;
      const totalH = rawLines.length * lineH;
      if (totalH > TEXT_PANEL_H - 16) { fontSizePt--; continue; }
      const maxW = measureMaxLineWidth(fontDataUrl, px, rawLines);
      if (maxW > maxTextW) { fontSizePt--; continue; }
      break;
    }
  }

  const fontSizePx = fontSizePt * PT_TO_PX;
  const capH       = fontSizePx * 0.72;
  const span       = (rawLines.length - 1) * lineH;
  const startY     = Math.round(TEXT_PANEL_Y + (TEXT_PANEL_H - capH - span) / 2 + capH);

  if (fontDataUrl) {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const textEls = rawLines.map((line, i) =>
      `<text x="${W / 2}" y="${Math.round(startY + i * lineH)}" text-anchor="middle">${esc(line)}</text>`
    ).join("\n");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><style>
        @font-face { font-family:'KuunariEmbed'; src:url('${fontDataUrl}') format('opentype'); }
        text { font-family:'KuunariEmbed',sans-serif;
               font-size:${fontSizePx}px; fill:white;
               font-feature-settings:"calt" 0,"liga" 0,"clig" 0,"dlig" 0,"kern" 0; }
      </style></defs>
      ${textEls}
    </svg>`;
    const blob   = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url    = URL.createObjectURL(blob);
    const svgImg = await loadImage(url);
    URL.revokeObjectURL(url);
    if (svgImg) ctx.drawImage(svgImg, 0, 0, W, H);
  }

  // ── School logos ──────────────────────────────────────────────────────────
  const active = logoImgs.filter(Boolean) as HTMLImageElement[];
  if (active.length > 0) {
    const targetH  = LOGO_PANEL_H - 24;  // 116px target height
    const gap      = 32;                  // gap between logos
    const maxGroupW = W - 120;            // max total group width (60px side margin each)

    // Compute each logo's width at target height
    let dims = active.map(img => {
      const aspect = img.naturalWidth / img.naturalHeight;
      return { lw: targetH * aspect, lh: targetH };
    });

    // Total group width
    let totalW = dims.reduce((sum, d) => sum + d.lw, 0) + gap * (active.length - 1);

    // Scale down if group is too wide
    if (totalW > maxGroupW) {
      const scale = maxGroupW / totalW;
      dims = dims.map(d => ({ lw: d.lw * scale, lh: d.lh * scale }));
      totalW = maxGroupW;
    }

    // Draw centered
    let lx = (W - totalW) / 2;
    for (let i = 0; i < active.length; i++) {
      const { lw, lh } = dims[i];
      const ly = LOGO_PANEL_Y + (LOGO_PANEL_H - lh) / 2;
      ctx.drawImage(active[i], 0, 0, active[i].naturalWidth, active[i].naturalHeight, lx, ly, lw, lh);
      lx += lw + gap;
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RecruitingNewsPage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const searchRef    = useRef<HTMLDivElement>(null);

  const [photoUrl,       setPhotoUrl]       = useState<string | null>(null);
  const [photoOffset,    setPhotoOffset]    = useState({ x: 0, y: 0 });
  const [photoZoom,      setPhotoZoom]      = useState(1.0);
  const [photoDragging,  setPhotoDragging]  = useState(false);
  const [filterEnabled,  setFilterEnabled]  = useState(true);

  const [headlineText,  setHeadlineText]  = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

  const [searchQuery,   setSearchQuery]   = useState("");
  const [showDropdown,  setShowDropdown]  = useState(false);

  const [isRendering,   setIsRendering]   = useState(false);

  const isPanning        = useRef(false);
  const panLastPos       = useRef({ x: 0, y: 0 });
  const photoNaturalSize = useRef<{ w: number; h: number } | null>(null);
  const [isPanningState, setIsPanningState] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Canvas helpers ──────────────────────────────────────────────────────
  const getCanvasXY = (e: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!photoUrl) return;
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
    setPhotoOffset(prev => {
      const nx = prev.x + dx;
      const ny = prev.y + dy;
      const nat = photoNaturalSize.current;
      if (!nat) return { x: nx, y: ny };
      const imgAspect   = nat.w / nat.h;
      const frameAspect = CANVAS_W / PHOTO_SPLIT;
      let dw: number, dh: number;
      if (imgAspect > frameAspect) { dh = PHOTO_SPLIT; dw = PHOTO_SPLIT * imgAspect; }
      else                         { dw = CANVAS_W;    dh = CANVAS_W    / imgAspect; }
      dw *= photoZoom; dh *= photoZoom;
      const maxOX = Math.max(0, (dw - CANVAS_W)    / 2);
      const maxOY = Math.max(0, (dh - PHOTO_SPLIT) / 2);
      return {
        x: Math.max(-maxOX, Math.min(maxOX, nx)),
        y: Math.max(-maxOY, Math.min(maxOY, ny)),
      };
    });
  };
  const handleCanvasMouseUp = () => { isPanning.current = false; setIsPanningState(false); };

  // Scroll-wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!photoUrl) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setPhotoZoom(prev => Math.max(1.0, Math.min(4.0, Math.round((prev + delta) * 10) / 10)));
  }, [photoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ── Photo upload ────────────────────────────────────────────────────────
  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { photoNaturalSize.current = { w: img.naturalWidth, h: img.naturalHeight }; };
    img.src = url;
    setPhotoUrl(url);
    setPhotoOffset({ x: 0, y: 0 });
    setPhotoZoom(1.0);
  };

  // ── School logos ────────────────────────────────────────────────────────
  const filteredSchools = SCHOOLS.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !selectedSlugs.includes(s.slug)
  );

  const addSchool = (slug: string) => {
    if (selectedSlugs.length >= MAX_LOGOS) return;
    setSelectedSlugs(prev => [...prev, slug]);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const removeSchool = (slug: string) => {
    setSelectedSlugs(prev => prev.filter(s => s !== slug));
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsRendering(true);
    try {
      const photoImg = photoUrl ? await loadImage(photoUrl) : null;
      const logoImgs = await Promise.all(
        selectedSlugs.map(slug => loadImage(`/logos/${slug}.png`))
      );
      await drawGraphic(ctx, { photoImg, photoOffset, photoZoom, filterEnabled, headlineText, logoImgs });
    } finally {
      setIsRendering(false);
    }
  }, [photoUrl, photoOffset, photoZoom, filterEnabled, headlineText, selectedSlugs]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "recruiting-news.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const canvasCursor = isPanningState ? "cursor-grabbing" : photoUrl ? "cursor-grab" : "";

  return (
    <div className="min-h-screen bg-gray-950">
      <style>{`
        @font-face { font-family: 'KuunariMedCond'; src: url('/fonts/Kuunari-MediumCondensed.otf') format('opentype'); }
      `}</style>

      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-lg">Recruiting News</h1>
              <span className="text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5 leading-none">WIP</span>
            </div>
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
                  ${photoDragging ? "border-red-400 bg-red-950/30" : "border-gray-700 hover:border-gray-500 bg-gray-800"}`}
              >
                {photoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl} alt="preview" className="w-full h-full object-contain" />
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

              {photoUrl && (
                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <input
                      type="range" min="1.0" max="4.0" step="0.05"
                      value={photoZoom}
                      onChange={e => setPhotoZoom(parseFloat(e.target.value))}
                      className="flex-1 accent-red-500"
                    />
                    <span className="text-gray-400 text-xs w-8 text-right">{photoZoom.toFixed(1)}×</span>
                  </div>
                  <button
                    onClick={() => setFilterEnabled(prev => !prev)}
                    className={`self-start flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      filterEnabled
                        ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                        : 'bg-gray-800 border-gray-700 text-gray-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${filterEnabled ? 'bg-orange-400' : 'bg-gray-600'}`} />
                    Camera filter {filterEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              )}
            </div>

            {/* Headline */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Headline</h2>
              <textarea
                value={headlineText}
                onChange={e => setHeadlineText(e.target.value)}
                placeholder={"DL ANITONI TAHI\nSET TO COMMIT APRIL 29"}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm resize-none font-mono"
              />
              <p className="text-gray-600 text-xs mt-1">Press Enter for a new line. Text auto-sizes to fit.</p>
            </div>

            {/* School Logos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-lg">School Logos</h2>
                <span className="text-gray-500 text-xs">{selectedSlugs.length}/{MAX_LOGOS}</span>
              </div>

              {/* Search */}
              {selectedSlugs.length < MAX_LOGOS && (
                <div ref={searchRef} className="relative mb-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Search schools…"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
                  />
                  {showDropdown && searchQuery && filteredSchools.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                      {filteredSchools.slice(0, 12).map(school => (
                        <button
                          key={school.slug}
                          onMouseDown={() => addSchool(school.slug)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/logos/${school.slug}.png`}
                            alt={school.name}
                            className="w-7 h-7 object-contain"
                          />
                          <span className="text-white text-sm">{school.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selected logos */}
              {selectedSlugs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSlugs.map(slug => {
                    const school = SCHOOLS.find(s => s.slug === slug);
                    return (
                      <div key={slug} className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/logos/${slug}.png`} alt={school?.name} className="w-6 h-6 object-contain" />
                        <span className="text-white text-xs">{school?.name}</span>
                        <button
                          onClick={() => removeSchool(slug)}
                          className="text-gray-500 hover:text-red-400 transition-colors ml-0.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isRendering}
              className="w-full py-3.5 rounded-xl font-semibold text-base bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
              {photoUrl && (photoOffset.x !== 0 || photoOffset.y !== 0 || photoZoom !== 1.0) && (
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
