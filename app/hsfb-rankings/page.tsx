"use client";

import { useRef, useState, useCallback } from "react";
import type { RankEntry } from "@/app/api/rankings/route";

const CANVAS_W = 1080;

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

export default function HsfbRankingsPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [scope, setScope] = useState<"national" | "state">("national");
  const [state, setState] = useState("alabama");
  const [rankType, setRankType] = useState<"composite" | "massey">("composite");
  const [limit, setLimit] = useState<10 | 25>(25);
  const [headerLine1, setHeaderLine1] = useState("");
  const [headerLine2, setHeaderLine2] = useState("");

  const [isFetching, setIsFetching] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [entries, setEntries] = useState<RankEntry[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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

    const canvas = canvasRef.current;
    const rowH = limit === 10 ? 110 : 68;
    const headerH = 220;
    const paddingV = 40;
    const CANVAS_H = headerH + entries.length * rowH + paddingV * 2;
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Header
    const pad = 48;
    let y = paddingV;

    if (headerLine1) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${limit === 10 ? 52 : 44}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(headerLine1.toUpperCase(), pad, y);
      y += limit === 10 ? 62 : 54;
    }

    // "NATIONAL HSFB TOP 25" or "[STATE] HSFB TOP 10"
    const scopeLabel =
      scope === "national"
        ? "NATIONAL"
        : STATES.find((s) => s.slug === state)?.name.toUpperCase() ?? state.toUpperCase();
    const typeLabel =
      scope === "national" && rankType === "massey" ? " MASSEY" : "";
    const rankLabel = `${scopeLabel}${typeLabel} HSFB TOP ${limit}`;
    ctx.fillStyle = "#e63946";
    ctx.font = `800 ${limit === 10 ? 60 : 48}px sans-serif`;
    ctx.fillText(rankLabel, pad, y);
    y += limit === 10 ? 70 : 58;

    if (headerLine2) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = `400 ${limit === 10 ? 34 : 28}px sans-serif`;
      ctx.fillText(headerLine2, pad, y);
      y += limit === 10 ? 44 : 36;
    }

    y += 16; // gap before list

    // Divider line
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(CANVAS_W - pad, y);
    ctx.stroke();
    y += 2;

    // Rows
    const logoSize = limit === 10 ? 72 : 44;
    const rankW = limit === 10 ? 90 : 60;
    const nameFont = limit === 10 ? 42 : 28;
    const locFont = limit === 10 ? 28 : 20;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rowY = y + i * rowH;
      const centerY = rowY + rowH / 2;

      // Alternating row background
      if (i % 2 === 1) {
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(0, rowY, CANVAS_W, rowH);
      }

      // Rank number
      ctx.fillStyle = "#6b7280";
      ctx.font = `700 ${limit === 10 ? 32 : 22}px sans-serif`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillText(String(entry.rank), pad + rankW - 8, centerY);

      // Logo
      if (entry.logoUrl) {
        const logo = await loadImage(proxyUrl(entry.logoUrl));
        if (logo) {
          const lx = pad + rankW + 12;
          const ly = centerY - logoSize / 2;
          ctx.drawImage(logo, lx, ly, logoSize, logoSize);
        }
      }

      const textX = pad + rankW + 12 + logoSize + 16;

      // School name
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${nameFont}px sans-serif`;
      ctx.textAlign = "left";
      if (entry.location) {
        ctx.fillText(entry.name, textX, centerY - (limit === 10 ? 14 : 9));
        ctx.fillStyle = "#6b7280";
        ctx.font = `400 ${locFont}px sans-serif`;
        ctx.fillText(entry.location, textX, centerY + (limit === 10 ? 18 : 13));
      } else {
        ctx.fillText(entry.name, textX, centerY);
      }

      // Divider
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, rowY + rowH);
      ctx.lineTo(CANVAS_W - pad, rowY + rowH);
      ctx.stroke();
    }

    const url = canvas.toDataURL("image/png");
    setDownloadUrl(url);
    setIsRendering(false);
  }, [entries, limit, scope, state, rankType, headerLine1, headerLine2]);

  const scopeLabel =
    scope === "national"
      ? "National"
      : STATES.find((s) => s.slug === state)?.name ?? state;

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
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    scope === s
                      ? "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* State picker */}
          {scope === "state" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-400 font-medium">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              >
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
                  <button
                    key={t}
                    onClick={() => setRankType(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                      rankType === t
                        ? "bg-red-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
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
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    limit === n
                      ? "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          {/* Header lines */}
          <div className="flex flex-col gap-3">
            <label className="text-sm text-gray-400 font-medium">Header Text</label>
            <input
              type="text"
              placeholder="Line 1 (e.g. Week 8 Rankings)"
              value={headerLine1}
              onChange={(e) => setHeaderLine1(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600"
            />
            <input
              type="text"
              placeholder="Line 2 (optional, e.g. Presented by On3)"
              value={headerLine2}
              onChange={(e) => setHeaderLine2(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600"
            />
          </div>

          {/* Fetch button */}
          <button
            onClick={fetchRankings}
            disabled={isFetching}
            className="bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
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
                {entries.length} entries fetched — {scopeLabel}{scope === "national" ? ` ${rankType}` : " Massey"} Top {limit}
              </p>
              <button
                onClick={renderGraphic}
                disabled={isRendering}
                className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {isRendering ? "Rendering…" : "Generate Graphic"}
              </button>
            </div>
            <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
              {entries.map((e) => (
                <div key={e.rank} className="flex items-center gap-3 py-1 border-b border-gray-800 last:border-0">
                  <span className="text-gray-500 text-xs w-6 text-right">{e.rank}.</span>
                  {e.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proxyUrl(e.logoUrl)}
                      alt=""
                      className="w-7 h-7 object-contain"
                    />
                  )}
                  <span className="text-sm text-white">{e.name}</span>
                  {e.location && (
                    <span className="text-xs text-gray-500">{e.location}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas + download */}
        <div className="flex flex-col gap-3">
          <canvas ref={canvasRef} className="w-full rounded-xl border border-gray-800" />
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={`hsfb-rankings-${scopeLabel.toLowerCase()}-top${limit}.png`}
              className="bg-gray-800 hover:bg-gray-700 text-white text-center font-semibold py-3 rounded-xl transition-colors"
            >
              Download PNG
            </a>
          )}
        </div>

      </div>
    </div>
  );
}
