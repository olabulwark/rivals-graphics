"use client";

import { useRef, useState, useCallback } from "react";
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

function proxyUrl(logoUrl: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(logoUrl)}`;
}

function todayFormatted(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export default function HsfbRankingsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Rankings config
  const [scope, setScope] = useState<"national" | "state">("national");
  const [state, setState] = useState("florida");
  const [rankType, setRankType] = useState<"composite" | "massey">("massey");
  const [limit, setLimit] = useState<10 | 25>(25);

  // Graphic text
  const [headerText, setHeaderText] = useState("PRESEASON 2026");
  const [dateText, setDateText] = useState(todayFormatted());

  // Photo
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  // State
  const [isFetching, setIsFetching] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    const url = URL.createObjectURL(file);
    setPhotoFile(file);
    setPhotoPreviewUrl(url);
    setDownloadUrl(null);
  }, [photoPreviewUrl]);

  const clearPhoto = useCallback(() => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    setDownloadUrl(null);
  }, [photoPreviewUrl]);

  const fetchRankings = useCallback(async () => {
    setIsFetching(true);
    setFetchError(null);
    setEntries([]);
    setDownloadUrl(null);

    const params = new URLSearchParams({
      scope: scope === "national" ? "national" : state,
      type: scope === "national" ? rankType : "massey",
      limit: String(limit),
    });

    try {
      const res = await fetch(`/api/rankings?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setFetchError(data.error ?? "Unknown error");
      } else {
        setEntries(data.entries ?? []);
      }
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setIsFetching(false);
    }
  }, [scope, state, rankType, limit]);

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

      // Load all assets in parallel
      const photoObjUrl = photoFile ? URL.createObjectURL(photoFile) : null;
      const [rivalsLogo, masseyBadge, photoImg] = await Promise.all([
        loadImage("/rivals-white.png"),
        loadImage("/massey-ratings.png"),
        photoObjUrl ? loadImage(photoObjUrl) : Promise.resolve(null),
      ]);
      if (photoObjUrl) URL.revokeObjectURL(photoObjUrl);

      // Pre-load all school logos in parallel
      const schoolLogos = await Promise.all(
        entries.map((e) =>
          e.logoUrl ? loadImage(proxyUrl(e.logoUrl)) : Promise.resolve(null)
        )
      );

      // ─── Layout ────────────────────────────────────────────────────
      const headerH = 252;
      const contentH = CANVAS_H - headerH;
      const hasPhoto = !!photoImg;
      const listW = hasPhoto ? Math.round(CANVAS_W * 0.585) : CANVAS_W;
      const photoAreaW = CANVAS_W - listW;
      const pad = 28;

      // ─── Header ────────────────────────────────────────────────────
      ctx.fillStyle = RIVALS_BLUE;
      ctx.fillRect(0, 0, CANVAS_W, headerH);

      // Rivals logo — top right
      const rivalsLogoW = 116;
      if (rivalsLogo) {
        const rh = Math.round(rivalsLogoW * rivalsLogo.naturalHeight / rivalsLogo.naturalWidth);
        ctx.drawImage(rivalsLogo, CANVAS_W - rivalsLogoW - 22, 20, rivalsLogoW, rh);
      }

      // Title text
      const titleMaxW = rivalsLogo ? CANVAS_W - rivalsLogoW - 52 - pad : CANVAS_W - pad * 2;
      let hy = 18;
      ctx.fillStyle = "#ffffff";
      ctx.textBaseline = "top";
      ctx.textAlign = "left";

      if (headerText) {
        ctx.font = `700 86px "Teko", sans-serif`;
        ctx.fillText(headerText.toUpperCase(), pad, hy, titleMaxW);
        hy += 82;
      }

      const scopeLabel =
        scope === "national"
          ? "NATIONAL"
          : (STATES.find((s) => s.slug === state)?.name.toUpperCase() ?? state.toUpperCase());
      const titleLine2 = `${scopeLabel} HSFB TOP ${limit}`;
      const line2Size = headerText ? 80 : 90;
      ctx.font = `700 ${line2Size}px "Teko", sans-serif`;
      ctx.fillText(titleLine2, pad, hy, titleMaxW);
      hy += Math.round(line2Size * 0.88);

      // Massey Ratings badge (show for Massey and all state rankings)
      const showMassey = rankType === "massey" || scope !== "national";
      if (showMassey && masseyBadge) {
        const bw = 164;
        const bh = Math.round(bw * masseyBadge.naturalHeight / masseyBadge.naturalWidth);
        hy += 10;
        ctx.drawImage(masseyBadge, pad, hy, bw, bh);
      }

      // ─── Content area ──────────────────────────────────────────────

      // White background for list
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, headerH, listW, contentH);

      // Photo (right column)
      if (photoImg && hasPhoto) {
        const scale = Math.max(
          photoAreaW / photoImg.naturalWidth,
          contentH / photoImg.naturalHeight
        );
        const drawW = photoImg.naturalWidth * scale;
        const drawH = photoImg.naturalHeight * scale;
        const drawX = listW + (photoAreaW - drawW) / 2;
        const drawY = headerH + (contentH - drawH) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(listW, headerH, photoAreaW, contentH);
        ctx.clip();
        ctx.drawImage(photoImg, drawX, drawY, drawW, drawH);
        ctx.restore();
      }

      // ─── Ranking rows ──────────────────────────────────────────────
      const rowH = contentH / entries.length;
      const logoSize = Math.min(Math.round(rowH * 0.66), 48);
      const fontSize = Math.min(Math.round(rowH * 0.60), 44);
      const rankColW = Math.ceil(fontSize * 1.65);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const rowY = headerH + i * rowH;
        const centerY = rowY + rowH / 2;
        const isBlue = i % 2 === 1;
        const color = isBlue ? RIVALS_BLUE : "#111111";

        // Rank number (right-aligned)
        ctx.fillStyle = color;
        ctx.font = `700 ${fontSize}px "Teko", sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        ctx.fillText(`${entry.rank}.`, pad + rankColW, centerY);

        // School logo
        const logo = schoolLogos[i];
        const logoX = pad + rankColW + 8;
        if (logo) {
          const logoY = centerY - logoSize / 2;
          ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
        }

        // School name
        const nameX = logoX + (logo ? logoSize + 10 : 0);
        const maxNameW = listW - nameX - pad;
        ctx.fillStyle = color;
        ctx.font = `700 ${fontSize}px "Teko", sans-serif`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(entry.name.toUpperCase(), nameX, centerY, maxNameW);

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

      // Date — bottom right of list area
      if (dateText) {
        ctx.fillStyle = "#555555";
        ctx.font = `400 26px sans-serif`;
        ctx.textBaseline = "bottom";
        ctx.textAlign = "right";
        ctx.fillText(dateText, listW - pad, CANVAS_H - 16);
      }

      const url = canvas.toDataURL("image/png");
      setDownloadUrl(url);
    } finally {
      setIsRendering(false);
    }
  }, [entries, limit, scope, state, rankType, headerText, dateText, photoFile]);

  const scopeDisplay =
    scope === "national"
      ? `National ${rankType}`
      : `${STATES.find((s) => s.slug === state)?.name ?? state} Massey`;

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Home</a>
          <h1 className="text-2xl font-bold">HSFB Rankings Graphic</h1>
        </div>

        {/* Controls */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">

          {/* Scope */}
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

          {/* State picker */}
          {scope === "state" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400 font-medium">State</label>
              <select value={state} onChange={(e) => setState(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                {STATES.map((s) => (
                  <option key={s.slug} value={s.slug}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Ranking type — national only */}
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

          {/* Limit */}
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

          {/* Header text */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Header Text</label>
            <input type="text" placeholder="e.g. PRESEASON 2026"
              value={headerText} onChange={(e) => setHeaderText(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">Date</label>
            <input type="text" placeholder="MM/DD/YYYY"
              value={dateText} onChange={(e) => setDateText(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600" />
          </div>

          {/* Photo upload (optional) */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400 font-medium">
              Player Photo <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            {photoPreviewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviewUrl} alt="Photo preview" className="w-20 h-20 object-cover rounded-lg" />
                <button onClick={clearPhoto}
                  className="text-sm text-gray-400 hover:text-red-400 transition-colors">
                  Remove
                </button>
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

          {/* Fetch button */}
          <button onClick={fetchRankings} disabled={isFetching}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors">
            {isFetching ? "Fetching…" : "Fetch Rankings from On3"}
          </button>
        </div>

        {/* Error */}
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

        {/* Canvas + download */}
        <div className="flex flex-col gap-3">
          <canvas ref={canvasRef} className="w-full rounded-xl border border-gray-800" />
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
