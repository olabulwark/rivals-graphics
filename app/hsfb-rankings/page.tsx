"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { RankEntry } from "@/app/api/rankings/route";

const CANVAS_W = 1080;
const CANVAS_H = 1350;
const RIVALS_BLUE = "#0d8bff";

const STATES = [
  { name: "Alabama", slug: "alabama" },
  { name: "Alaska", slug: "alaska" },
  { name: "Arizona", slug: "arizona" },
  { name: "Arkansas", slug: "arkansas" },
  { name: "California", slug: "california" },
  { name: "Colorado", slug: "colorado" },
  { name: "Connecticut", slug: "connecticut" },
  { name: "Delaware", slug: "delaware" },
  { name: "Florida", slug: "florida" },
  { name: "Georgia", slug: "georgia" },
  { name: "Hawaii", slug: "hawaii" },
  { name: "Idaho", slug: "idaho" },
  { name: "Illinois", slug: "illinois" },
  { name: "Indiana", slug: "indiana" },
  { name: "Iowa", slug: "iowa" },
  { name: "Kansas", slug: "kansas" },
  { name: "Kentucky", slug: "kentucky" },
  { name: "Louisiana", slug: "louisiana" },
  { name: "Maine", slug: "maine" },
  { name: "Maryland", slug: "maryland" },
  { name: "Massachusetts", slug: "massachusetts" },
  { name: "Michigan", slug: "michigan" },
  { name: "Minnesota", slug: "minnesota" },
  { name: "Mississippi", slug: "mississippi" },
  { name: "Missouri", slug: "missouri" },
  { name: "Montana", slug: "montana" },
  { name: "Nebraska", slug: "nebraska" },
  { name: "Nevada", slug: "nevada" },
  { name: "New Hampshire", slug: "new-hampshire" },
  { name: "New Jersey", slug: "new-jersey" },
  { name: "New Mexico", slug: "new-mexico" },
  { name: "New York", slug: "new-york" },
  { name: "North Carolina", slug: "north-carolina" },
  { name: "North Dakota", slug: "north-dakota" },
  { name: "Ohio", slug: "ohio" },
  { name: "Oklahoma", slug: "oklahoma" },
  { name: "Oregon", slug: "oregon" },
  { name: "Pennsylvania", slug: "pennsylvania" },
  { name: "Rhode Island", slug: "rhode-island" },
  { name: "South Carolina", slug: "south-carolina" },
  { name: "South Dakota", slug: "south-dakota" },
  { name: "Tennessee", slug: "tennessee" },
  { name: "Texas", slug: "texas" },
  { name: "Utah", slug: "utah" },
  { name: "Vermont", slug: "vermont" },
  { name: "Virginia", slug: "virginia" },
  { name: "Washington", slug: "washington" },
  { name: "West Virginia", slug: "west-virginia" },
  { name: "Wisconsin", slug: "wisconsin" },
  { name: "Wyoming", slug: "wyoming" },
];

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function proxyUrl(url: string) {
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
}

function todayFormatted() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function HsfbRankingsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Rankings config
  const [scope, setScope] = useState<"national" | "state">("national");
  const [statePick, setStatePick] = useState("florida");
  const [rankType, setRankType] = useState<"composite" | "massey">("massey");
  const [limit, setLimit] = useState<10 | 25>(25);

  // Graphic text
  const [headerText, setHeaderText] = useState("PRESEASON 2026");
  const [dateText, setDateText] = useState(todayFormatted());

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // Interactive photo controls — stored in refs so the draw fn is always current
  const interactiveRef = useRef({ zoom: 1.0, offset: { x: 0, y: 0 }, filter: false });
  const [photoZoom, setPhotoZoom] = useState(1.0);
  const [photoFilterEnabled, setPhotoFilterEnabled] = useState(false);

  // Stable draw fn, set after assets load
  const drawRef = useRef<(() => void) | null>(null);

  // Drag-to-pan state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, ox: 0, oy: 0 });

  // Data / UI state
  const [isFetching, setIsFetching] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // ─── Photo upload ────────────────────────────────────────────────────────
  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    interactiveRef.current = { zoom: 1.0, offset: { x: 0, y: 0 }, filter: interactiveRef.current.filter };
    setPhotoZoom(1.0);
    drawRef.current = null; // force full reload on next render
    setDownloadUrl(null);
  }, [photoPreviewUrl]);

  const clearPhoto = useCallback(() => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    drawRef.current = null;
    setDownloadUrl(null);
  }, [photoPreviewUrl]);

  const resetPhotoPosition = useCallback(() => {
    interactiveRef.current.zoom = 1.0;
    interactiveRef.current.offset = { x: 0, y: 0 };
    setPhotoZoom(1.0);
    drawRef.current?.();
  }, []);

  const toggleFilter = useCallback(() => {
    const next = !interactiveRef.current.filter;
    interactiveRef.current.filter = next;
    setPhotoFilterEnabled(next);
    drawRef.current?.();
  }, []);

  // ─── Wheel zoom (needs passive:false) ────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      if (!drawRef.current) return;
      e.preventDefault();
      const newZoom = Math.max(1, Math.min(4, interactiveRef.current.zoom - e.deltaY * 0.002));
      interactiveRef.current.zoom = newZoom;
      setPhotoZoom(newZoom);
      drawRef.current();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // ─── Drag to pan ─────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!drawRef.current || !photoFile) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX, mouseY: e.clientY,
      ox: interactiveRef.current.offset.x,
      oy: interactiveRef.current.offset.y,
    };
  }, [photoFile]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !drawRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = CANVAS_H / rect.height;
    interactiveRef.current.offset = {
      x: dragStartRef.current.ox + (e.clientX - dragStartRef.current.mouseX) * sx,
      y: dragStartRef.current.oy + (e.clientY - dragStartRef.current.mouseY) * sy,
    };
    drawRef.current();
  }, []);

  const handleMouseUp = useCallback(() => { isDraggingRef.current = false; }, []);

  // ─── Fetch rankings ──────────────────────────────────────────────────────
  const fetchRankings = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    setEntries([]);
    setDownloadUrl(null);
    drawRef.current = null;

    const params = new URLSearchParams({
      scope: scope === "national" ? "national" : statePick,
      type: scope === "national" ? rankType : "massey",
      limit: String(limit),
    });

    try {
      const res = await fetch(`/api/rankings?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) setFetchError(data.error ?? "Unknown error");
      else setEntries(data.entries ?? []);
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setIsFetching(false);
    }
  }, [scope, statePick, rankType, limit]);

  // ─── Main render ─────────────────────────────────────────────────────────
  const renderGraphic = useCallback(async () => {
    if (!entries.length || !canvasRef.current) return;
    setIsRendering(true);
    setDownloadUrl(null);

    try {
      const canvas = canvasRef.current;
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext("2d")!;

      // Load Teko font
      if (!document.fonts.check(`700 20px "Teko"`)) {
        const font = new FontFace("Teko", "url(/Teko-VariableFont_wght.ttf)");
        await font.load();
        document.fonts.add(font);
      }

      // Load all assets in parallel (browser caches these after first load)
      const photoObjUrl = photoFile ? URL.createObjectURL(photoFile) : null;
      const [rivalsLogo, masseyBadge, photo, ...schoolLogos] = await Promise.all([
        loadImage("/rivals-white.png"),
        loadImage("/massey-ratings.png"),
        photoObjUrl ? loadImage(photoObjUrl) : Promise.resolve(null),
        ...entries.map((e) => e.logoUrl ? loadImage(proxyUrl(e.logoUrl)) : Promise.resolve(null)),
      ]);
      if (photoObjUrl) URL.revokeObjectURL(photoObjUrl);

      // Layout constants (stable across redraws)
      const headerH = 252;
      const contentH = CANVAS_H - headerH;
      const listW = photo ? Math.round(CANVAS_W * 0.585) : CANVAS_W;
      const photoAreaW = CANVAS_W - listW;
      const pad = 28;
      const showMassey = rankType === "massey" || scope !== "national";

      const scopeLabel =
        scope === "national"
          ? "NATIONAL"
          : (STATES.find((s) => s.slug === statePick)?.name.toUpperCase() ?? statePick.toUpperCase());
      const titleLine2 = `${scopeLabel} HSFB TOP ${limit}`;
      const rowH = contentH / entries.length;
      const logoSize = Math.min(Math.round(rowH * 0.66), 48);
      const fontSize = Math.min(Math.round(rowH * 0.60), 44);
      const rankColW = Math.ceil(fontSize * 1.65);

      // ─── Define stable redraw function ─────────────────────────────────
      const draw = () => {
        const { zoom, offset, filter } = interactiveRef.current;

        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // 1. Blue header — full width
        ctx.fillStyle = RIVALS_BLUE;
        ctx.fillRect(0, 0, CANVAS_W, headerH);

        // 2. Photo — right column, FULL canvas height (bleeds into header)
        if (photo) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(listW, 0, photoAreaW, CANVAS_H);
          ctx.clip();

          if (filter) {
            ctx.filter = "contrast(1.12) saturate(1.22) brightness(1.05) sepia(0.14)";
          }
          const baseScale = Math.max(
            photoAreaW / photo.naturalWidth,
            CANVAS_H / photo.naturalHeight
          );
          const scale = baseScale * zoom;
          const dw = photo.naturalWidth * scale;
          const dh = photo.naturalHeight * scale;
          const dx = listW + (photoAreaW - dw) / 2 + offset.x;
          const dy = (CANVAS_H - dh) / 2 + offset.y;
          ctx.drawImage(photo, dx, dy, dw, dh);
          ctx.filter = "none";
          ctx.restore();
        }

        // 3. White background — left list area (below header)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, headerH, listW, contentH);

        // 4. Header title text (left side, over blue)
        const titleMaxW = rivalsLogo ? CANVAS_W - 150 - pad * 2 : CANVAS_W - pad * 2;
        let hy = 18;
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";

        if (headerText) {
          ctx.font = `700 86px "Teko", sans-serif`;
          ctx.fillText(headerText.toUpperCase(), pad, hy, titleMaxW);
          hy += 82;
        }

        const line2Size = headerText ? 80 : 90;
        ctx.font = `700 ${line2Size}px "Teko", sans-serif`;
        ctx.fillText(titleLine2, pad, hy, titleMaxW);
        hy += Math.round(line2Size * 0.88);

        // 5. Massey badge (left side, below title text)
        if (showMassey && masseyBadge) {
          const bw = 164;
          const bh = Math.round(bw * masseyBadge.naturalHeight / masseyBadge.naturalWidth);
          hy += 10;
          ctx.drawImage(masseyBadge, pad, hy, bw, bh);
        }

        // 6. Rivals logo — top right, drawn OVER photo
        if (rivalsLogo) {
          const rw = 116;
          const rh = Math.round(rw * rivalsLogo.naturalHeight / rivalsLogo.naturalWidth);
          ctx.drawImage(rivalsLogo, CANVAS_W - rw - 22, 20, rw, rh);
        }

        // 7. Ranking rows
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const rowY = headerH + i * rowH;
          const centerY = rowY + rowH / 2;
          const isBlue = i % 2 === 1;
          const color = isBlue ? RIVALS_BLUE : "#111111";

          // Rank number
          ctx.fillStyle = color;
          ctx.font = `700 ${fontSize}px "Teko", sans-serif`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "right";
          ctx.fillText(`${entry.rank}.`, pad + rankColW, centerY);

          // Logo
          const logo = schoolLogos[i];
          const logoX = pad + rankColW + 8;
          if (logo) {
            ctx.drawImage(logo, logoX, centerY - logoSize / 2, logoSize, logoSize);
          }

          // School name
          const nameX = logoX + (logo ? logoSize + 10 : 0);
          ctx.fillStyle = color;
          ctx.font = `700 ${fontSize}px "Teko", sans-serif`;
          ctx.textBaseline = "middle";
          ctx.textAlign = "left";
          ctx.fillText(entry.name.toUpperCase(), nameX, centerY, listW - nameX - pad);

          // Row divider
          if (i < entries.length - 1) {
            ctx.strokeStyle = "#d1d5db";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad, rowY + rowH);
            ctx.lineTo(listW - pad, rowY + rowH);
            ctx.stroke();
          }
        }

        // 8. Date — bottom right of list area
        if (dateText) {
          ctx.fillStyle = "#555555";
          ctx.font = `400 26px sans-serif`;
          ctx.textBaseline = "bottom";
          ctx.textAlign = "right";
          ctx.fillText(dateText, listW - pad, CANVAS_H - 16);
        }

        setDownloadUrl(canvas.toDataURL("image/png"));
      };

      drawRef.current = draw;
      draw();
    } finally {
      setIsRendering(false);
    }
  }, [entries, photoFile, scope, statePick, limit, rankType, headerText, dateText]);

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const scopeDisplay =
    scope === "national"
      ? `National ${rankType}`
      : `${STATES.find((s) => s.slug === statePick)?.name ?? statePick} Massey`;

  const hasGraphic = !!drawRef.current;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Home</a>
          <h1 className="text-2xl font-bold">HSFB Rankings Graphic</h1>
        </div>

        {/* Controls */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Ranking Scope</label>
            <div className="flex gap-2">
              {(["national", "state"] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    scope === s ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {scope === "state" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400 font-medium">State</label>
              <select value={statePick} onChange={(e) => setStatePick(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                {STATES.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </div>
          )}

          {scope === "national" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400 font-medium">Ranking Type</label>
              <div className="flex gap-2">
                {(["composite", "massey"] as const).map((t) => (
                  <button key={t} onClick={() => setRankType(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      rankType === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Rankings Count</label>
            <div className="flex gap-2">
              {([10, 25] as const).map((n) => (
                <button key={n} onClick={() => setLimit(n)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    limit === n ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}>
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Header Text</label>
            <input type="text" placeholder="e.g. PRESEASON 2026"
              value={headerText} onChange={(e) => setHeaderText(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Date</label>
            <input type="text" placeholder="MM/DD/YYYY"
              value={dateText} onChange={(e) => setDateText(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
          </div>

          {/* Photo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">
              Player Photo <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            {photoPreviewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg" />
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400">Drag on graphic to pan · Scroll to zoom</span>
                  <div className="flex gap-2">
                    <button onClick={toggleFilter}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        photoFilterEnabled ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}>
                      Warm Filter
                    </button>
                    <button onClick={resetPhotoPosition}
                      className="px-3 py-1 rounded-lg text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">
                      Reset Position
                    </button>
                    <button onClick={clearPhoto}
                      className="px-3 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-red-400 transition-colors">
                      Remove
                    </button>
                  </div>
                  {hasGraphic && (
                    <span className="text-xs text-gray-600">Zoom: {photoZoom.toFixed(2)}×</span>
                  )}
                </div>
              </div>
            ) : (
              <button onClick={() => photoInputRef.current?.click()}
                className="bg-gray-800 border border-gray-700 border-dashed hover:border-gray-500 rounded-xl px-4 py-4 text-sm text-gray-500 hover:text-gray-300 transition-colors text-center">
                Click to upload player photo
              </button>
            )}
            <input ref={photoInputRef} type="file" accept="image/*"
              onChange={handlePhotoChange} className="hidden" />
          </div>

          <button onClick={fetchRankings} disabled={isFetching}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
            {isFetching ? "Fetching…" : "Fetch Rankings from On3"}
          </button>
        </div>

        {fetchError && (
          <div className="bg-red-950 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm">
            {fetchError}
          </div>
        )}

        {/* Data preview */}
        {entries.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-300">
                {entries.length} schools — {scopeDisplay} Top {limit}
              </p>
              <button onClick={renderGraphic} disabled={isRendering}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                {isRendering ? "Rendering…" : "Generate Graphic"}
              </button>
            </div>
            <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
              {entries.map((e) => (
                <div key={e.rank} className="flex items-center gap-3 py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-500 text-xs w-6 text-right shrink-0">{e.rank}.</span>
                  {e.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={proxyUrl(e.logoUrl)} alt="" className="w-6 h-6 object-contain shrink-0" />
                  )}
                  <span className="text-sm text-white">{e.name}</span>
                  {e.location && <span className="text-xs text-gray-500">{e.location}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex flex-col gap-3">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: photoFile && hasGraphic ? "grab" : "default" }}
            className="w-full rounded-xl border border-gray-800 select-none"
          />
          {downloadUrl && (
            <a href={downloadUrl}
              download={`hsfb-${scopeDisplay.toLowerCase().replace(/\s+/g, "-")}-top${limit}.png`}
              className="bg-gray-800 hover:bg-gray-700 text-white text-center font-semibold py-3 rounded-xl transition-colors block">
              Download PNG
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
