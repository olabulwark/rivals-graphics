"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { removeBackground } from "@imgly/background-removal";

// Use package defaults — publicPath points to staticimgly.com CDN automatically
const BG_REMOVAL_CONFIG = {
  debug: false,
};

export interface JerseyResult {
  collegeId: string;
  collegeName: string;
  nickname: string;
  imageData: string;
  mimeType: string;
}

interface Props {
  originalUrl: string;
  results: JerseyResult[];
  recruitName: string;
}

const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, #374151 25%, transparent 25%),
    linear-gradient(-45deg, #374151 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #374151 75%),
    linear-gradient(-45deg, transparent 75%, #374151 75%)
  `,
  backgroundSize: "12px 12px",
  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  backgroundColor: "#1f2937",
};

export default function ResultsGallery({ originalUrl, results, recruitName }: Props) {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<JerseyResult | null>(null);
  const [removedBgUrls, setRemovedBgUrls] = useState<Record<string, string>>({});
  const [removingBg, setRemovingBg] = useState<string | null>(null);
  const [bgError, setBgError] = useState<string | null>(null);

  // Revoke object URLs when component unmounts to avoid memory leaks
  useEffect(() => {
    return () => {
      Object.values(removedBgUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isBgRemoved = (collegeId: string) => !!removedBgUrls[collegeId];

  const getDisplaySrc = (result: JerseyResult) =>
    removedBgUrls[result.collegeId] ?? `data:${result.mimeType};base64,${result.imageData}`;

  const handleRemoveBg = async (result: JerseyResult, e: React.MouseEvent) => {
    e.stopPropagation();
    setBgError(null);

    if (isBgRemoved(result.collegeId)) {
      // Toggle off — restore original
      URL.revokeObjectURL(removedBgUrls[result.collegeId]);
      setRemovedBgUrls((prev) => {
        const next = { ...prev };
        delete next[result.collegeId];
        return next;
      });
      return;
    }

    setRemovingBg(result.collegeId);
    try {
      const dataUrl = `data:${result.mimeType};base64,${result.imageData}`;
      const blob = await removeBackground(dataUrl, BG_REMOVAL_CONFIG);
      const url = URL.createObjectURL(blob);
      setRemovedBgUrls((prev) => ({ ...prev, [result.collegeId]: url }));
    } catch (err) {
      console.error("Background removal failed:", err);
      setBgError("Background removal failed. Please try again.");
    } finally {
      setRemovingBg(null);
    }
  };

  const downloadImage = (result: JerseyResult) => {
    const bgRemoved = isBgRemoved(result.collegeId);
    const link = document.createElement("a");
    link.href = getDisplaySrc(result);
    link.download = `${recruitName.replace(/\s+/g, "-")}-${result.collegeName.replace(/\s+/g, "-")}-jersey${bgRemoved ? "-cutout" : ""}.png`;
    link.click();
  };

  const downloadAll = () => results.forEach((r) => downloadImage(r));

  const handleUseForCommit = async (result: JerseyResult, e: React.MouseEvent) => {
    e.stopPropagation();
    let imageData = result.imageData;
    let mimeType = result.mimeType;

    // If bg has been removed, convert object URL to base64
    if (removedBgUrls[result.collegeId]) {
      try {
        const response = await fetch(removedBgUrls[result.collegeId]);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
        imageData = base64;
        mimeType = 'image/png';
      } catch {
        // fallback to original
      }
    }

    sessionStorage.setItem('commitPhoto', JSON.stringify({
      imageData,
      mimeType,
      collegeId: result.collegeId,
      collegeName: result.collegeName,
    }));
    router.push('/commit');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">
          {recruitName}&apos;s Recruiting Visits
        </h2>
        {results.length > 1 && (
          <button
            onClick={downloadAll}
            className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download All
          </button>
        )}
      </div>

      {bgError && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-2 text-red-300 text-sm">
          {bgError}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Original photo */}
        <div className="flex flex-col gap-2">
          <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-[3/4]">
            <img src={originalUrl} alt="Original" className="w-full h-full object-cover object-top" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-white text-sm font-medium">Original</p>
            </div>
          </div>
        </div>

        {/* Jersey swap results */}
        {results.map((result) => {
          const bgRemoved = isBgRemoved(result.collegeId);
          const isRemoving = removingBg === result.collegeId;

          return (
            <div key={result.collegeId} className="flex flex-col gap-2">
              <div
                className="relative rounded-xl overflow-hidden aspect-[3/4] cursor-pointer group"
                style={bgRemoved ? CHECKER_STYLE : undefined}
                onClick={() => setLightbox(result)}
              >
                {!bgRemoved && <div className="absolute inset-0 bg-gray-800" />}
                <img
                  src={getDisplaySrc(result)}
                  alt={`${result.collegeName} jersey`}
                  className="absolute inset-0 w-full h-full object-cover object-top"
                />

                {/* Hover dim */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />

                {/* Bottom label */}
                <div className={`absolute bottom-0 left-0 right-0 p-3 ${bgRemoved ? "" : "bg-gradient-to-t from-black/80 to-transparent"}`}>
                  <p className="text-white text-sm font-medium drop-shadow">{result.collegeName}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-gray-300 text-xs drop-shadow">{result.nickname}</p>
                    {bgRemoved && (
                      <span className="text-xs bg-green-600/90 text-white px-1.5 py-0.5 rounded font-medium">
                        Cutout
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons — top right on hover */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1.5">
                  {/* Download */}
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadImage(result); }}
                    className="bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg"
                    title="Download"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>

                  {/* Remove / restore background */}
                  <button
                    onClick={(e) => handleRemoveBg(result, e)}
                    disabled={isRemoving}
                    title={bgRemoved ? "Restore background" : "Remove background"}
                    className={`p-1.5 rounded-lg text-white transition-colors ${
                      bgRemoved
                        ? "bg-green-600/80 hover:bg-green-700"
                        : "bg-black/60 hover:bg-black/80"
                    } disabled:opacity-50`}
                  >
                    {isRemoving ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      // Sparkles / magic icon
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                      </svg>
                    )}
                  </button>

                  {/* Use for Commit Graphic */}
                  <button
                    onClick={(e) => handleUseForCommit(result, e)}
                    title="Use for Commit Graphic"
                    className="bg-black/60 hover:bg-purple-600 text-white p-1.5 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 gap-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative rounded-xl overflow-hidden shadow-2xl"
            style={isBgRemoved(lightbox.collegeId) ? CHECKER_STYLE : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getDisplaySrc(lightbox)}
              alt={`${lightbox.collegeName} jersey`}
              className="max-h-[calc(100vh-140px)] max-w-full w-auto object-contain"
            />
          </div>

          <div
            className="flex items-center gap-3 bg-gray-900/90 backdrop-blur px-4 py-3 rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mr-2">
              <p className="text-white font-bold">{lightbox.collegeName}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-gray-400 text-sm">{lightbox.nickname}</p>
                {isBgRemoved(lightbox.collegeId) && (
                  <span className="text-xs bg-green-600/90 text-white px-1.5 py-0.5 rounded font-medium">
                    Cutout
                  </span>
                )}
              </div>
            </div>

            {/* Remove / restore bg in lightbox */}
            <button
              onClick={(e) => handleRemoveBg(lightbox, e)}
              disabled={removingBg === lightbox.collegeId}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                isBgRemoved(lightbox.collegeId)
                  ? "bg-green-700 hover:bg-green-600 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-white"
              } disabled:opacity-50`}
            >
              {removingBg === lightbox.collegeId ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Removing…
                </>
              ) : isBgRemoved(lightbox.collegeId) ? (
                "Restore BG"
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Remove BG
                </>
              )}
            </button>

            <button
              onClick={() => downloadImage(lightbox)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>

            <button
              onClick={() => setLightbox(null)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
