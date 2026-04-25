"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COLLEGES, College } from "@/lib/colleges";

const CANVAS_W = 1080;
const CANVAS_H = 1350;

type Visit = { college: College | null; date: string };

async function loadLogoImage(collegeId: string): Promise<HTMLImageElement | null> {
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
      if (data[(y * oc.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { sx: 0, sy: 0, sw: oc.width, sh: oc.height };
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
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

async function drawGraphic(
  ctx: CanvasRenderingContext2D,
  opts: {
    recruitName: string;
    position: string;
    stars: number;
    photoImg: HTMLImageElement | null;
    photoOffset: { x: number; y: number };
    visits: (Visit & { logoImg: HTMLImageElement | null })[];
  }
) {
  const { recruitName, position, stars, photoImg, photoOffset, visits } = opts;
  const W = CANVAS_W, H = CANVAS_H;

  try {
    await Promise.all([
      document.fonts.load('160px "Anton"'),
      document.fonts.load('160px "Kuunari"'),
      document.fonts.load('160px "PODIUMSharp"'),
    ]);
  } catch { /* ignore */ }

  // ── Background ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#f7f8fa";
  ctx.fillRect(0, 0, W, H);

  // Dot grid
  ctx.fillStyle = "rgba(160, 185, 210, 0.45)";
  const dotSpacing = 30;
  const dotRadius  = 2.5;
  for (let dy = dotSpacing; dy < H; dy += dotSpacing) {
    for (let dx = dotSpacing; dx < W; dx += dotSpacing) {
      ctx.beginPath();
      ctx.arc(dx, dy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── "OFFICIAL VISITS" ─────────────────────────────────────────────────────
  (ctx as unknown as Record<string, unknown>).letterSpacing = "-1px";
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = '128px "PODIUMSharp", Impact, sans-serif';
  ctx.save();
  ctx.translate(W / 2, 138);
  ctx.scale(1, 1.08);
  ctx.fillText("OFFICIAL VISITS", 0, 0);
  ctx.restore();

  // ── Recruit name line ─────────────────────────────────────────────────────
  (ctx as unknown as Record<string, unknown>).letterSpacing = "4px";
  const nameParts = [
    position ? position.toUpperCase() : "",
    recruitName ? recruitName.toUpperCase() : "RECRUIT NAME",
  ].filter(Boolean);
  const nameText = nameParts.join("  ");
  ctx.fillStyle = "#2563EB";
  ctx.font = '56px "Kuunari", Impact, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(nameText, W / 2, 208);

  // ── Stars ─────────────────────────────────────────────────────────────────
  (ctx as unknown as Record<string, unknown>).letterSpacing = "8px";
  if (stars > 0) {
    ctx.fillStyle = "#a68a50";
    ctx.font = '46px "Kuunari", Impact, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("★".repeat(stars), W / 2, 262);
  }
  (ctx as unknown as Record<string, unknown>).letterSpacing = "0px";

  // ── Content area ──────────────────────────────────────────────────────────
  const contentY = 292;
  const contentH = H - contentY - 80;   // used for card layout

  // Photo column — left and bottom borders intentionally bleed off canvas edge
  const borderW = 6;
  const photoR = 18;
  const photoX = -(photoR + borderW);        // pushes left corner fully off-canvas
  const photoW = 575 + (photoR + borderW);   // compensate so 575px is visible
  const photoFrameH = H - contentY + photoR + borderW;  // clips bottom corner too

  // Blue border behind photo
  ctx.save();
  ctx.shadowColor   = "rgba(0,0,0,0.30)";
  ctx.shadowBlur    = 22;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 10;
  roundedRect(ctx, photoX - borderW, contentY - borderW, photoW + borderW * 2, photoFrameH + borderW * 2, photoR + borderW);
  ctx.fillStyle = "#2563EB";
  ctx.fill();
  ctx.restore();

  // Photo clipped
  roundedRect(ctx, photoX, contentY, photoW, photoFrameH, photoR);
  ctx.save();
  ctx.clip();
  if (photoImg) {
    const imgAspect   = photoImg.naturalWidth / photoImg.naturalHeight;
    const frameAspect = photoW / photoFrameH;
    let drawW, drawH;
    if (imgAspect > frameAspect) {
      drawH = photoFrameH; drawW = photoFrameH * imgAspect;
    } else {
      drawW = photoW; drawH = photoW / imgAspect;
    }
    const maxOX = (drawW - photoW) / 2;
    const maxOY = (drawH - photoFrameH) / 2;
    const cx = Math.max(-maxOX, Math.min(maxOX, photoOffset.x));
    const cy = Math.max(-maxOY, Math.min(maxOY, photoOffset.y));
    ctx.drawImage(
      photoImg,
      0, 0, photoImg.naturalWidth, photoImg.naturalHeight,
      photoX - (drawW - photoW) / 2 + cx,
      contentY - (drawH - photoFrameH) / 2 + cy,
      drawW, drawH
    );
  } else {
    ctx.fillStyle = "#dde3ea";
    ctx.fillRect(photoX, contentY, photoW, photoFrameH);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.font = '30px "Anton", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("UPLOAD PHOTO", photoX + photoW / 2, contentY + photoFrameH / 2);
  }
  ctx.restore();

  // ── Visit cards ───────────────────────────────────────────────────────────
  const cardsW     = 370;
  const cardsX     = W - 28 - cardsW;
  const cardGap    = 18;
  const activeVisits = visits.filter(v => v.college !== null);
  const n          = Math.max(activeVisits.length, 1);
  const cardH      = 110;
  const totalH     = n * cardH + (n - 1) * cardGap;
  // vertically center the card stack within the content area
  const cardsStartY = contentY + Math.floor((contentH - totalH) / 2);

  for (let i = 0; i < activeVisits.length; i++) {
    const { college, date, logoImg } = activeVisits[i];
    if (!college) continue;

    const cardY = cardsStartY + i * (cardH + cardGap);
    const cardR = 14;

    // Card with shadow
    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.28)";
    ctx.shadowBlur    = 18;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 7;
    roundedRect(ctx, cardsX, cardY, cardsW, cardH, cardR);
    ctx.fillStyle = college.primaryHex;
    ctx.fill();
    ctx.restore();

    // Logo — clipped to card bounds, 50% larger than card height
    const logoSize = 143;
    const logoX    = cardsX + 1;
    const logoY    = cardY + (cardH - logoSize) / 2;
    if (logoImg) {
      ctx.save();
      roundedRect(ctx, cardsX, cardY, cardsW, cardH, cardR);
      ctx.clip();
      const { sx, sy, sw, sh } = getOpaqueBounds(logoImg);
      const aspect = sw / sh;
      const lH = logoSize;
      const lW = logoSize * aspect;
      // Shift logo left based on aspect ratio after trimming:
      // super wide (Arkansas, Missouri etc): heavy shift to show face
      // narrow/square (Indiana, Illinois etc): light shift
      let destX: number;
      if (aspect >= 1.4) {
        destX = cardsX - lW * 0.4;   // super wide: clip left 40%
      } else if (aspect >= 1.0) {
        destX = cardsX - lW * 0.15;  // moderately wide: slight shift
      } else {
        destX = logoX;                // tall/narrow: left-anchored, no shift
      }
      const destY = logoY + (logoSize - lH) / 2;

      if (college.id === "michigan-state" || college.id === "indiana") {
        // Tint logo white via offscreen canvas
        const oc = document.createElement("canvas");
        oc.width  = Math.ceil(lW);
        oc.height = Math.ceil(lH);
        const octx = oc.getContext("2d")!;
        octx.drawImage(logoImg, sx, sy, sw, sh, 0, 0, lW, lH);
        octx.globalCompositeOperation = "source-atop";
        octx.fillStyle = "#ffffff";
        octx.fillRect(0, 0, lW, lH);
        ctx.drawImage(oc, destX, destY);
      } else {
        ctx.drawImage(logoImg, sx, sy, sw, sh, destX, destY, lW, lH);
      }
      ctx.restore();
    }

    // Date text — right portion of card
    const textX = logoX + logoSize + 14;
    const textW = cardsX + cardsW - textX - 18;
    const dateStr = date ? date.toUpperCase() : "TBD";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    (ctx as unknown as Record<string, unknown>).letterSpacing = "0px";
    let fontSize = Math.floor(cardH * 0.552);
    ctx.font = `bold ${fontSize}px "Arial Narrow", Arial, sans-serif`;
    const measured = ctx.measureText(dateStr).width;
    if (measured > textW) {
      fontSize = Math.floor(fontSize * (textW / measured));
      ctx.font = `bold ${fontSize}px "Arial Narrow", Arial, sans-serif`;
    }
    // True visual centering using actual glyph bounds
    const metrics = ctx.measureText(dateStr);
    const textVisualH = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const textY = cardY + cardH / 2 + textVisualH / 2 - metrics.actualBoundingBoxDescent;
    ctx.fillText(dateStr, textX + textW / 2, textY);
  }

  // ── Rivals watermark ──────────────────────────────────────────────────────
  const rivalsImg = await loadImage("/rivals.png");
  if (rivalsImg) {
    const rH = 51;
    const rW = rH * (rivalsImg.naturalWidth / rivalsImg.naturalHeight);
    ctx.globalAlpha = 0.85;
    ctx.drawImage(rivalsImg, W - rW - 20, H - rH - 14, rW, rH);
    ctx.globalAlpha = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function VisitsPage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [recruitName,  setRecruitName]  = useState("");
  const [position,     setPosition]     = useState("");
  const [stars,        setStars]        = useState(4);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoOffset,  setPhotoOffset]  = useState({ x: 0, y: 0 });
  const [photoDragging, setPhotoDragging] = useState(false);
  const [isRendering,  setIsRendering]  = useState(false);

  const [visits, setVisits] = useState<Visit[]>([
    { college: null, date: "" },
    { college: null, date: "" },
    { college: null, date: "" },
    { college: null, date: "" },
  ]);
  const [visitSearch,      setVisitSearch]      = useState<string[]>(["", "", "", "", "", ""]);
  const [visitDropdownOpen, setVisitDropdownOpen] = useState<number | null>(null);

  const isPanning   = useRef(false);
  const panLastPos  = useRef({ x: 0, y: 0 });
  const [isPanningState, setIsPanningState] = useState(false);
  const hasPhoto = !!photoPreviewUrl;

  const CONF_ORDER: Record<string, number> = { SEC: 0, "Big Ten": 1, ACC: 2, "Big 12": 3, Independent: 4 };
  const sortedColleges = [...COLLEGES].sort((a, b) => {
    const cd = (CONF_ORDER[a.conference] ?? 99) - (CONF_ORDER[b.conference] ?? 99);
    return cd !== 0 ? cd : a.name.localeCompare(b.name);
  });

  const getCanvasXY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
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

  const setVisitCollege = (i: number, college: College | null) => {
    setVisits(prev => prev.map((v, idx) => idx === i ? { ...v, college } : v));
    setVisitDropdownOpen(null);
    setVisitSearch(prev => prev.map((s, idx) => idx === i ? "" : s));
  };
  const setVisitDate = (i: number, date: string) =>
    setVisits(prev => prev.map((v, idx) => idx === i ? { ...v, date } : v));

  const addVisit = () => {
    if (visits.length >= 6) return;
    setVisits(prev => [...prev, { college: null, date: "" }]);
    setVisitSearch(prev => [...prev, ""]);
  };
  const removeVisit = (i: number) => {
    setVisits(prev => prev.filter((_, idx) => idx !== i));
    setVisitSearch(prev => prev.filter((_, idx) => idx !== i));
    if (visitDropdownOpen === i) setVisitDropdownOpen(null);
  };

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsRendering(true);
    try {
      const photoImg = photoPreviewUrl ? await loadImage(photoPreviewUrl) : null;
      const visitsWithLogos = await Promise.all(
        visits.map(async v => ({
          ...v,
          logoImg: v.college ? await loadLogoImage(v.college.id) : null,
        }))
      );
      await drawGraphic(ctx, { recruitName, position, stars, photoImg, photoOffset, visits: visitsWithLogos });
    } finally {
      setIsRendering(false);
    }
  }, [recruitName, position, stars, photoPreviewUrl, photoOffset, visits]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);


  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${recruitName.replace(/\s+/g, "-") || "recruit"}-official-visits.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
        @font-face { font-family: 'Kuunari';    src: url('/fonts/Kuunari-MediumCondensed.otf') format('opentype'); }
        @font-face { font-family: 'PODIUMSharp'; src: url('/fonts/PODIUMSharp-6.11.otf') format('opentype'); }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-lg">Official Visits</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <a href="/commit" className="hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Commit Graphic
            </a>
            <a href="/" className="hover:text-white transition-colors">← Jersey Swap</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* ── Controls ── */}
          <div className="flex flex-col gap-6">

            {/* Recruit info */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Recruit Info</h2>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-gray-400 text-sm mb-1.5">Recruit Name</label>
                    <input
                      type="text" value={recruitName} onChange={e => setRecruitName(e.target.value)}
                      placeholder="e.g. Myles Smith"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-gray-400 text-sm mb-1.5">Position</label>
                    <input
                      type="text" value={position} onChange={e => setPosition(e.target.value)}
                      placeholder="EDGE"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1.5">Star Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setStars(n)}
                        className={`text-2xl transition-transform hover:scale-110 ${n <= stars ? "text-yellow-400" : "text-gray-600"}`}>
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Photo */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Recruit Photo</h2>
              <div
                onClick={() => photoInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setPhotoDragging(true); }}
                onDragLeave={() => setPhotoDragging(false)}
                onDrop={e => { e.preventDefault(); setPhotoDragging(false); const f = e.dataTransfer.files[0]; if (f) handlePhotoFile(f); }}
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all overflow-hidden relative
                  ${photoDragging ? "border-green-400 bg-green-950/30" : "border-gray-700 hover:border-gray-500 bg-gray-800"}`}
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

            {/* Visit slots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-lg">Official Visits</h2>
                {visits.length < 6 && (
                  <button onClick={addVisit}
                    className="text-green-400 hover:text-green-300 text-sm flex items-center gap-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Visit
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {visits.map((visit, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    {/* School picker */}
                    <div className="flex-1 relative">
                      <button
                        onClick={() => setVisitDropdownOpen(visitDropdownOpen === i ? null : i)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between hover:border-gray-500 transition-colors"
                      >
                        <span className={visit.college ? "text-white" : "text-gray-500"}>
                          {visit.college ? visit.college.name : "Select school…"}
                        </span>
                        <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {visitDropdownOpen === i && (
                        <>
                          {/* Click-outside overlay */}
                          <div className="fixed inset-0 z-40" onClick={() => setVisitDropdownOpen(null)} />
                          <div className="absolute z-50 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-gray-700">
                              <input
                                type="text"
                                placeholder="Search..."
                                value={visitSearch[i] ?? ""}
                                onChange={e => setVisitSearch(prev => prev.map((s, si) => si === i ? e.target.value : s))}
                                autoFocus
                                className="w-full bg-gray-700 rounded px-2.5 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none"
                              />
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                              {sortedColleges
                                .filter(c => !(visitSearch[i]) || c.name.toLowerCase().includes((visitSearch[i] ?? "").toLowerCase()))
                                .map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => setVisitCollege(i, c)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                      visit.college?.id === c.id
                                        ? "bg-green-700 text-white"
                                        : "text-white hover:bg-gray-700"
                                    }`}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Date */}
                    <input
                      type="text"
                      value={visit.date}
                      onChange={e => setVisitDate(i, e.target.value)}
                      placeholder="MAY 29"
                      className="w-28 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 text-sm"
                    />

                    {/* Remove */}
                    {visits.length > 1 && (
                      <button onClick={() => removeVisit(i)}
                        className="text-gray-600 hover:text-red-400 transition-colors pt-2.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={isRendering}
              className="w-full py-3.5 rounded-xl font-semibold text-base bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Graphic
            </button>
          </div>

          {/* ── Canvas preview ── */}
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
                className={`w-full h-auto select-none ${hasPhoto ? (isPanningState ? "cursor-grabbing" : "cursor-grab") : ""}`}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
              {hasPhoto && (photoOffset.x !== 0 || photoOffset.y !== 0) && (
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
