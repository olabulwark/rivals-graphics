"use client";

import { useState } from "react";
import PhotoUpload from "@/components/PhotoUpload";
import CollegeSelector from "@/components/CollegeSelector";
import ResultsGallery, { JerseyResult } from "@/components/ResultsGallery";
import { College } from "@/lib/colleges";

type Step = "setup" | "generating" | "results";

export default function Home() {
  const [step, setStep] = useState<Step>("setup");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedColleges, setSelectedColleges] = useState<College[]>([]);
  const [recruitName, setRecruitName] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("1");
  const [results, setResults] = useState<JerseyResult[]>([]);
  const [errors, setErrors] = useState<{ college: string; error: string }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleImageSelected = (file: File, url: string) => {
    setImageFile(file);
    setPreviewUrl(url);
  };

  const canGenerate = imageFile && selectedColleges.length > 0;

  const generate = async () => {
    if (!imageFile || !selectedColleges.length) return;
    setErrorMessage(null);
    setStep("generating");
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + 2, 90));
    }, 600);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("colleges", JSON.stringify(selectedColleges));
      formData.append("jerseyNumber", jerseyNumber);
      formData.append("recruitName", recruitName || "the recruit");

      const res = await fetch("/api/generate", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Generation failed.");

      setResults(data.results);
      setErrors(data.errors || []);
      setStep("results");
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Unexpected error");
      setStep("setup");
    } finally {
      clearInterval(interval);
      setProgress(100);
    }
  };

  const reset = () => {
    setStep("setup");
    setResults([]);
    setErrors([]);
    setErrorMessage(null);
    setProgress(0);
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm0 14a6 6 0 110-12 6 6 0 010 12z" />
              </svg>
            </div>
            <h1 className="text-white font-bold text-lg leading-tight">Recruit Jersey Swap</h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/visits" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Official Visits
            </a>
            <a href="/commit" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Commit Graphic
            </a>
            <a href="/admin" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Jersey Library
            </a>
            {step === "results" && (
              <button onClick={reset} className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6.364 1.636l-.707.707M20 12h-1M17.657 17.657l-.707-.707M12 20v-1m-5.657-1.636l.707-.707M4 12H3m2.343-5.657l.707.707" />
                </svg>
                New Recruit
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {step === "setup" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-white font-semibold text-lg mb-3">Recruit Info</h2>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-gray-400 text-sm mb-1.5">Recruit Name</label>
                    <input
                      type="text"
                      value={recruitName}
                      onChange={(e) => setRecruitName(e.target.value)}
                      placeholder="e.g. John Smith"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-gray-400 text-sm mb-1.5">Jersey #</label>
                    <input
                      type="text"
                      value={jerseyNumber}
                      onChange={(e) => setJerseyNumber(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      placeholder="1"
                      maxLength={2}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm text-center font-mono text-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-white font-semibold text-lg mb-3">Recruit Photo</h2>
                <PhotoUpload onImageSelected={handleImageSelected} previewUrl={previewUrl} />
                <p className="text-gray-500 text-xs mt-2">
                  Best results: clear front-facing photo of the recruit
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-white font-semibold text-lg mb-3">
                  Recruiting Schools
                  <span className="text-gray-500 text-sm font-normal ml-2">Select up to 6</span>
                </h2>
                <CollegeSelector selected={selectedColleges} onChange={setSelectedColleges} max={6} />
              </div>

              {errorMessage && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={generate}
                disabled={!canGenerate}
                className={`w-full py-3.5 rounded-xl font-semibold text-base transition-all
                  ${canGenerate
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 active:scale-[0.99]"
                    : "bg-gray-800 text-gray-500 cursor-not-allowed"}`}
              >
                {!imageFile
                  ? "Upload a photo to continue"
                  : !selectedColleges.length
                  ? "Select at least one school"
                  : `Generate ${selectedColleges.length} Jersey${selectedColleges.length > 1 ? "s" : ""}`}
              </button>

            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-24 gap-8">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-4 border-gray-800" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" style={{ animationDuration: "1s" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{progress}%</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-xl">Generating Jerseys…</p>
              <p className="text-gray-400 mt-2">
                Swapping {recruitName || "the recruit"} into {selectedColleges.length} jersey{selectedColleges.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {selectedColleges.map((c) => (
                  <span key={c.id} className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">{c.name}</span>
                ))}
              </div>
            </div>
            <div className="w-64 bg-gray-800 rounded-full h-2 overflow-hidden">
              <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {step === "results" && previewUrl && (
          <div className="flex flex-col gap-6">
            <ResultsGallery originalUrl={previewUrl} results={results} recruitName={recruitName || "Recruit"} />
            {errors.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-yellow-400 text-sm font-medium mb-2">Some jerseys failed to generate:</p>
                <ul className="text-yellow-300/70 text-sm space-y-1">
                  {errors.map((e, i) => <li key={i}>• {e.college}: {e.error}</li>)}
                </ul>
              </div>
            )}
            <div className="flex justify-center pt-4">
              <button onClick={reset} className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-medium transition-colors">
                Generate Another Recruit
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
