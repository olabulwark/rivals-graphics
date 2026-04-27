"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { COLLEGES, College } from "@/lib/colleges";
import { removeBackground } from "@imgly/background-removal";

const CANVAS_W = 1080;
const CANVAS_H = 1350;

type SchoolSlot = { college: College | null };

// ─── Image helpers ────────────────────────────────────────────────────────────

async function loadLogoImage(collegeId: string): Promise<HTMLImageElement | null> {
  for (const ext of ["png", "jpg", "webp", "jpeg"]) {
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = `/jerseys/${collegeId}/logo.${ext}?t=${Date.now()}`;
      });
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
  } catch { return null; }
}

function getOpaqueBounds(img: HTMLImageElement) {
  const oc = document.createElement("canvas");
  oc.width = img.naturalWidth; oc.height = img.naturalHeight;
  const octx = oc.getContext("2d")!;
  octx.drawImage(img, 0, 0);
  const { data } = octx.getImageData(0, 0, oc.width, oc.height);
  let minX = oc.width, minY = oc.height, maxX = 0, maxY = 0;
  for (let y = 0; y < oc.height; y++) {
    for (let x = 0; x < oc.width; x++) {
      if (data[(y * oc.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
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

// ─── Canvas draw ──────────────────────────────────────────────────────────────

async function drawGraphic(
  ctx: CanvasRenderingContext2D,
  opts: {
    recruitName: string;
    position: string;
    stars: number;
    teaser: string;
    source: string;
    photoImg: HTMLImageElement | null;
    bgRemovedImg: HTMLImageElement | null;
    photoOffset: { x: number; y: number };
    schools: (SchoolSlot & { logoImg: HTMLImageElement | null })[];
  }
) {
  const { recruitName, position, stars, teaser, source, photoImg, bgRemovedImg, photoOffset, schools } = opts;
  const W = CANVAS_W, H = CANVAS_H;

  try {
    await Promise.all([
      document.fonts.load('160px "Anton"'),
      document.fonts.load('160px "PODIUMSharp"'),
      document.fonts.load('160px "Kuunari"'),
      document.fonts.load('700 160px "Alumni Sans"'),
    ]);
  } catch { /* ignore */ }

  // ── Full navy background ──────────────────────────────────────────────────
  ctx.fillStyle = "#0d1b2e";
  ctx.fillRect(0, 0, W, H);

  // ── Header constants ──────────────────────────────────────────────────────
  const headerH = 234;

  // ── BREAKING badge ────────────────────────────────────────────────────────
  const badgeX = 38, badgeY = 26, badgeW = 178, badgeH = 56, badgeR = 28;
  ctx.fillStyle = "#d42028";
  roundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeR);
  ctx.fill();
  ctx.font = '700 26px "PODIUMSharp", Impact, sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("BREAKING", badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

  // ── Rivals logo (top-right) ───────────────────────────────────────────────
  const rivalsHeaderImg = await loadImage("/rivals-white.png");
  if (rivalsHeaderImg) {
    const rH = 38;
    const rW = rH * (rivalsHeaderImg.naturalWidth / rivalsHeaderImg.naturalHeight);
    ctx.drawImage(rivalsHeaderImg, W - rW - 36, badgeY + (badgeH - rH) / 2, rW, rH);
  }

  // ── RECRUITING NEWS text ──────────────────────────────────────────────────
  const rnSize = 96;
  ctx.font = `${rnSize}px "PODIUMSharp", Impact, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.save();
  ctx.translate(38, 152);
  ctx.scale(1, 1.05);
  ctx.fillText("RECRUITING NEWS", 0, 0);
  ctx.restore();

  // ── Recruit name + position + stars row ───────────────────────────────────
  const infoY = 198;
  (ctx as unknown as Record<string, unknown>).letterSpacing = "2px";
  ctx.font = '700 34px "Alumni Sans", sans-serif';
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  const namePart = recruitName ? recruitName.toUpperCase() : "";
  const posPart  = position    ? position.toUpperCase()    : "";
  const starsPart = stars > 0  ? "★".repeat(stars)         : "";

  let infoX = 38;
  if (posPart) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText(posPart, infoX, infoY);
    infoX += ctx.measureText(posPart).width + 18;
    // small separator
    ctx.fillStyle = "#d42028";
    ctx.fillRect(infoX - 10, infoY - 24, 3, 28);
  }
  if (namePart) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(namePart, infoX, infoY);
    infoX += ctx.measureText(namePart).width + 18;
  }
  if (starsPart) {
    ctx.fillStyle = "#a68a50";
    ctx.font = '700 30px "Alumni Sans", sans-serif';
    ctx.fillText(starsPart, infoX, infoY);
  }
  (ctx as unknown as Record<string, unknown>).letterSpacing = "0px";

  // ── Red accent bar separating header from content ─────────────────────────
  ctx.fillStyle = "#d42028";
  ctx.fillRect(0, headerH - 6, W, 6);

  // ── Photo column (left) ───────────────────────────────────────────────────
  const photoR = 72, borderW = 3;
  const photoX = -(photoR + borderW);
  const photoW = 568 + (photoR + borderW);
  const photoFrameH = H - headerH + photoR + borderW;

  // Pre-calculate draw params (needed for two-pass overflow rendering)
  let pDrawX = photoX, pDrawY = headerH, pDrawW = photoW, pDrawH = photoFrameH;
  if (photoImg) {
    const imgAspect   = photoImg.naturalWidth / photoImg.naturalHeight;
    const frameAspect = photoW / photoFrameH;
    if (imgAspect > frameAspect) {
      pDrawH = photoFrameH; pDrawW = photoFrameH * imgAspect;
    } else {
      pDrawW = photoW; pDrawH = photoW / imgAspect;
    }
    const zoom = 1.1;
    pDrawW *= zoom; pDrawH *= zoom;
    const maxOX = (pDrawW - photoW) / 2;
    const maxOY = (pDrawH - photoFrameH) / 2;
    const cx = Math.max(-maxOX, Math.min(maxOX, photoOffset.x));
    const cy = Math.max(-maxOY, Math.min(maxOY, photoOffset.y));
    pDrawX = photoX - (pDrawW - photoW) / 2 + cx;
    pDrawY = headerH - (pDrawH - photoFrameH) / 2 + cy;
  }

  // Red border behind photo
  ctx.save();
  ctx.shadowColor   = "rgba(0,0,0,0.45)";
  ctx.shadowBlur    = 24;
  ctx.shadowOffsetX = 4;
  ctx.shadowOffsetY = 12;
  roundedRect(ctx, photoX - borderW, headerH - borderW, photoW + borderW * 2, photoFrameH + borderW * 2, photoR + borderW);
  ctx.fillStyle = "#d42028";
  ctx.fill();
  ctx.restore();

  // Pass 1 — photo clipped inside frame
  roundedRect(ctx, photoX, headerH, photoW, photoFrameH, photoR);
  ctx.save();
  ctx.clip();
  if (photoImg) {
    ctx.drawImage(photoImg, 0, 0, photoImg.naturalWidth, photoImg.naturalHeight,
      pDrawX, pDrawY, pDrawW, pDrawH);
  } else {
    ctx.fillStyle = "#1a2d45";
    ctx.fillRect(photoX, headerH, photoW, photoFrameH);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = '32px "Anton", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("UPLOAD PHOTO", photoX + photoW / 2, headerH + photoFrameH / 2);
  }
  ctx.restore();

  // ── School logo cards (right column) ─────────────────────────────────────
  const activeSchools = schools.filter(s => s.college !== null);
  const n = Math.max(activeSchools.length, 1);
  const cardsX    = 606;
  const cardsW    = W - cardsX - 30;
  const cardGap   = 14;
  const cardsAreaH = H - headerH - 8;
  const cardH     = Math.floor((cardsAreaH - (n - 1) * cardGap) / n);

  for (let i = 0; i < activeSchools.length; i++) {
    const { college, logoImg } = activeSchools[i];
    if (!college) continue;

    const cardY = headerH + 8 + i * (cardH + cardGap);
    const cardR = 14;

    // Card with shadow
    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.55)";
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;
    roundedRect(ctx, cardsX, cardY, cardsW, cardH, cardR);
    ctx.fillStyle = college.primaryHex;
    ctx.fill();
    ctx.restore();

    // Logo (clipped to card, oversized like visits page)
    const logoSize = Math.floor(cardH * 1.3);
    if (logoImg) {
      ctx.save();
      roundedRect(ctx, cardsX, cardY, cardsW, cardH, cardR);
      ctx.clip();
      const { sx, sy, sw, sh } = getOpaqueBounds(logoImg);
      const aspect = sw / sh;
      const lH = logoSize;
      const lW = logoSize * aspect;
      let destX: number;
      if (aspect >= 1.4) {
        destX = cardsX - lW * 0.4;
      } else if (aspect >= 1.0) {
        destX = cardsX - lW * 0.12;
      } else {
        destX = cardsX + 2;
      }
      const destY = cardY + (cardH - lH) / 2;

      // Tint white for dark-logo-on-dark-bg schools
      const needsWhiteTint = ["michigan-state", "indiana"].includes(college.id);
      if (needsWhiteTint) {
        const oc = document.createElement("canvas");
        oc.width = Math.ceil(lW); oc.height = Math.ceil(lH);
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

    // School abbreviation / short name (right-anchored)
    const abbr = college.abbreviation || college.name.toUpperCase().slice(0, 4);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const abbrFontSize = Math.min(Math.floor(cardH * 0.52), 58);
    ctx.font = `bold ${abbrFontSize}px "Alumni Sans", sans-serif`;
    ctx.fillText(abbr, cardsX + cardsW - 18, cardY + cardH / 2 + 2);
  }

  // ── Pass 2 — bg-removed photo overflows above frame ───────────────────────
  const overflowImg = bgRemovedImg ?? photoImg;
  if (overflowImg) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, 0, photoW, headerH);
    ctx.clip();
    ctx.drawImage(overflowImg, 0, 0, overflowImg.naturalWidth, overflowImg.naturalHeight,
      pDrawX, pDrawY, pDrawW, pDrawH);
    ctx.restore();
  }

  // ── Teaser / headline text ────────────────────────────────────────────────
  // Dark gradient overlay at bottom of photo to make text readable
  const teaserAreaTop = H - 310;
  const grad = ctx.createLinearGradient(0, teaserAreaTop - 80, 0, H);
  grad.addColorStop(0, "rgba(13,27,46,0)");
  grad.addColorStop(0.3, "rgba(13,27,46,0.85)");
  grad.addColorStop(1, "rgba(13,27,46,1)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, teaserAreaTop - 80, W, H - (teaserAreaTop - 80));

  // Teaser text — wrap to fit within photo column width
  const teaserText = teaser || "RECRUITING NEWS HEADLINE GOES HERE";
  const teaserMaxW = 570;
  const teaserX = 38;

  (ctx as unknown as Record<string, unknown>).letterSpacing = "-0.5px";
  let teaserSize = 66;
  ctx.font = `${teaserSize}px "PODIUMSharp", Impact, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Word-wrap
  const words = teaserText.toUpperCase().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > teaserMaxW && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  // Scale down if too many lines
  if (lines.length > 4) {
    teaserSize = Math.floor(teaserSize * (4 / lines.length));
    ctx.font = `${teaserSize}px "PODIUMSharp", Impact, sans-serif`;
  }

  const lineH = teaserSize * 1.08;
  const totalTeaserH = lines.length * lineH;
  const teaserY = H - 290 - 10 + (280 - totalTeaserH) / 2;

  // Red highlight on first line
  if (lines.length > 0) {
    const firstLineW = ctx.measureText(lines[0]).width;
    ctx.fillStyle = "#d42028";
    ctx.fillRect(teaserX, teaserY - 4, firstLineW, teaserSize + 8);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(lines[0], teaserX, teaserY);
    for (let li = 1; li < lines.length; li++) {
      ctx.fillText(lines[li], teaserX, teaserY + li * lineH);
    }
  }

  (ctx as unknown as Record<string, unknown>).letterSpacing = "0px";

  // Source credit
  if (source) {
    ctx.font = '700 22px "Alumni Sans", sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`SOURCE: ${source.toUpperCase()}`, teaserX, H - 22);
  }

  // ── Rivals watermark (bottom-right) ───────────────────────────────────────
  const rivalsImg = await loadImage("/rivals.png");
  if (rivalsImg) {
    const rH = 48;
    const rW = rH * (rivalsImg.naturalWidth / rivalsImg.naturalHeight);
    ctx.globalAlpha = 0.88;
    ctx.drawImage(rivalsImg, W - rW - 22, H - rH - 16, rW, rH);
    ctx.globalAlpha = 1;
  }
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function NewsPage() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [recruitName,    setRecruitName]    = useState("");
  const [position,       setPosition]       = useState("");
  const [stars,          setStars]          = useState(4);
  const [teaser,         setTeaser]         = useState("");
  const [source,         setSource]         = useState("USA Today");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [bgRemovedUrl,   setBgRemovedUrl]   = useState<string | null>(null);
  const [removingBg,     setRemovingBg]     = useState(false);
  const [photoOffset,    setPhotoOffset]    = useState({ x: 0, y: 0 });
  const [photoDragging,  setPhotoDragging]  = useState(false);
  const [isRendering,    setIsRendering]    = useState(false);

  const [schools, setSchools] = useState<SchoolSlot[]>([
    { college: null },
    { college: null },
    { college: null },
    { college: null },
    { college: null },
  ]);
  const [schoolSearch,      setSchoolSearch]      = useState<string[]>(["", "", "", "", "", "", "", ""]);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState<number | null>(null);

  const isPanning  = useRef(false);
  const panLastPos = useRef({ x: 0, y: 0 });
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
    isPanning.current = true; setIsPanningState(true);
    panLastPos.current = getCanvasXY(e); e.preventDefault();
  };
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPanning.current) return;
    const pos = getCanvasXY(e);
    const dx = pos.x - panLastPos.current.x, dy = pos.y - panLastPos.current.y;
    panLastPos.current = pos;
    setPhotoOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };
  const handleCanvasMouseUp = () => { isPanning.current = false; setIsPanningState(false); };

  const handlePhotoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPhotoPreviewUrl(url);
    setPhotoOffset({ x: 0, y: 0 });
    setBgRemovedUrl(null);
    setRemovingBg(true);
    removeBackground(url)
      .then(blob => setBgRemovedUrl(URL.createObjectURL(blob)))
      .catch(err => console.error("Background removal failed:", err))
      .finally(() => setRemovingBg(false));
  };

  const setSchoolCollege = (i: number, college: College | null) => {
    setSchools(prev => prev.map((s, idx) => idx === i ? { college } : s));
    setSchoolDropdownOpen(null);
    setSchoolSearch(prev => prev.map((v, idx) => idx === i ? "" : v));
  };

  const addSchool = () => {
    if (schools.length >= 8) return;
    setSchools(prev => [...prev, { college: null }]);
  };
  const removeSchool = (i: number) => {
    setSchools(prev => prev.filter((_, idx) => idx !== i));
    if (schoolDropdownOpen === i) setSchoolDropdownOpen(null);
  };

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    setIsRendering(true);
    try {
      const [photoImg, bgRemovedImg] = await Promise.all([
        photoPreviewUrl ? loadImage(photoPreviewUrl) : Promise.resolve(null),
        bgRemovedUrl    ? loadImage(bgRemovedUrl)    : Promise.resolve(null),
      ]);
      const schoolsWithLogos = await Promise.all(
        schools.map(async s => ({
          ...s,
          logoImg: s.college ? await loadLogoImage(s.college.id) : null,
        }))
      );
      await drawGraphic(ctx, {
        recruitName, position, stars, teaser, source,
        photoImg, bgRemovedImg, photoOffset,
        schools: schoolsWithLogos,
      });
    } finally {
      setIsRendering(false);
    }
  }, [recruitName, position, stars, teaser, source, photoPreviewUrl, bgRemovedUrl, photoOffset, schools]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${recruitName.replace(/\s+/g, "-") || "recruit"}-recruiting-news.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Alumni+Sans:wght@100..900&display=swap');
        @font-face { font-family: 'Kuunari';    src: url('/fonts/Kuunari-MediumCondensed.otf') format('opentype'); }
        @font-face { font-family: 'PODIUMSharp'; src: url('/fonts/PODIUMSharp-6.11.otf') format('opentype'); }
      `}</style>

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-red-700 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-lg">Recruiting News</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <a href="/commit" className="hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Commit
            </a>
            <a href="/visits" className="hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Visits
            </a>
            <a href="/" className="hover:text-white transition-colors">← Home</a>
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
                      placeholder="e.g. Jerry Outhouse"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-gray-400 text-sm mb-1.5">Position</label>
                    <input
                      type="text" value={position} onChange={e => setPosition(e.target.value)}
                      placeholder="CB"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
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

            {/* Headline / Teaser */}
            <div>
              <h2 className="text-white font-semibold text-lg mb-3">Headline</h2>
              <textarea
                value={teaser}
                onChange={e => setTeaser(e.target.value)}
                placeholder="e.g. 4-star CB decommits from Georgia"
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm resize-none"
              />
              <div className="mt-2">
                <label className="block text-gray-400 text-sm mb-1.5">Source</label>
                <input
                  type="text" value={source} onChange={e => setSource(e.target.value)}
                  placeholder="e.g. USA Today"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm"
                />
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
                  ${photoDragging ? "border-red-500 bg-red-950/30" : "border-gray-700 hover:border-gray-500 bg-gray-800"}`}
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
              {removingBg && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 animate-spin text-red-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Removing background…
                </div>
              )}
              {!removingBg && bgRemovedUrl && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                  </svg>
                  Background removed
                </div>
              )}
            </div>

            {/* Schools */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-white font-semibold text-lg">Top Schools</h2>
                {schools.length < 8 && (
                  <button onClick={addSchool}
                    className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add School
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {schools.map((school, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 relative">
                      <button
                        onClick={() => setSchoolDropdownOpen(schoolDropdownOpen === i ? null : i)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between hover:border-gray-500 transition-colors"
                      >
                        <span className={school.college ? "text-white" : "text-gray-500"}>
                          {school.college ? school.college.name : `School ${i + 1}…`}
                        </span>
                        <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {schoolDropdownOpen === i && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setSchoolDropdownOpen(null)} />
                          <div className="absolute z-50 top-full mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
                            <div className="p-2 border-b border-gray-700">
                              <input
                                type="text"
                                placeholder="Search..."
                                value={schoolSearch[i] ?? ""}
                                onChange={e => setSchoolSearch(prev => prev.map((v, si) => si === i ? e.target.value : v))}
                                autoFocus
                                className="w-full bg-gray-700 rounded px-2.5 py-1.5 text-white text-sm placeholder-gray-500 focus:outline-none"
                              />
                            </div>
                            <div className="max-h-52 overflow-y-auto">
                              {sortedColleges
                                .filter(c => !(schoolSearch[i]) || c.name.toLowerCase().includes((schoolSearch[i] ?? "").toLowerCase()))
                                .map(c => (
                                  <button
                                    key={c.id}
                                    onClick={() => setSchoolCollege(i, c)}
                                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                      school.college?.id === c.id
                                        ? "bg-red-700 text-white"
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

                    {schools.length > 1 && (
                      <button onClick={() => removeSchool(i)}
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
              className="w-full py-3.5 rounded-xl font-semibold text-base bg-red-700 hover:bg-red-600 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
