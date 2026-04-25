"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CONFERENCES } from "@/lib/colleges";

interface JerseySlot {
  slot: string;
  label: string;
  url: string | null;
}

interface CollegeJerseyStatus {
  id: string;
  name: string;
  conference: string;
  slots: JerseySlot[];
  notes: string;
}

const SLOT_TIPS: Record<string, string> = {
  illustration: "Wikipedia uniform diagram or 2D flat-lay — no players, just the jersey design",
  photo: "Jersey-only photo — flat lay, hanging, mannequin, or close-up. No players or people.",
  logo: "School logo — used for the commitment graphic",
};

const SLOT_COLORS: Record<string, string> = {
  illustration: "text-yellow-400 border-yellow-700",
  photo: "text-green-400 border-green-800",
  logo: "text-teal-400 border-teal-800",
};

const conferenceColors: Record<string, string> = {
  SEC: "bg-blue-900/60 text-blue-300",
  "Big Ten": "bg-red-900/60 text-red-300",
  "Big 12": "bg-orange-900/60 text-orange-300",
  ACC: "bg-purple-900/60 text-purple-300",
  Independent: "bg-gray-700 text-gray-300",
};

export default function AdminPage() {
  const [colleges, setColleges] = useState<CollegeJerseyStatus[]>([]);
  const [conference, setConference] = useState("All");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ collegeId: string; slot: string } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/jerseys");
    const data: CollegeJerseyStatus[] = await res.json();
    setColleges(data);
    setLocalNotes((prev) => {
      const next = { ...prev };
      data.forEach((c) => {
        if (!(c.id in next)) next[c.id] = c.notes;
      });
      return next;
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const triggerUpload = (collegeId: string, slot: string) => {
    pendingUpload.current = { collegeId, slot };
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUpload.current) return;
    const { collegeId, slot } = pendingUpload.current;
    setUploading(`${collegeId}-${slot}`);
    try {
      const formData = new FormData();
      formData.append("collegeId", collegeId);
      formData.append("slot", slot);
      formData.append("image", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast("Uploaded successfully", "success");
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (collegeId: string, slot: string) => {
    setDeleting(`${collegeId}-${slot}`);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeId, slot }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Removed", "success");
      await load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveNotes = async (collegeId: string) => {
    setSavingNotes(collegeId);
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeId, notes: localNotes[collegeId] ?? "" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast("Notes saved", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSavingNotes(null);
    }
  };

  const filtered = colleges.filter((c) => {
    const matchesConf = conference === "All" || c.conference === conference;
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchesConf && matchesSearch;
  });

  const totalImages = colleges.reduce((sum, c) => sum + c.slots.filter((s) => s.url).length, 0);
  const totalSlots = colleges.length * 3;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <a href="/" className="text-gray-400 hover:text-white text-sm transition-colors">← Back to App</a>
            <h1 className="text-white font-bold text-xl mt-1">Jersey Reference Library</h1>
            <p className="text-gray-400 text-sm">Illustration + optional jersey photo per school • Add notes to fine-tune the AI prompt</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">
              {totalImages}<span className="text-gray-500 text-base font-normal">/{totalSlots}</span>
            </div>
            <div className="text-gray-400 text-xs">images uploaded</div>
            <div className="w-32 bg-gray-800 rounded-full h-1.5 mt-1.5">
              <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${(totalImages / totalSlots) * 100}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Search programs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <select
            value={conference}
            onChange={(e) => setConference(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {CONFERENCES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((college) => {
            const uploadedCount = college.slots.filter((s) => s.url).length;
            const illustrationSlot = college.slots.find((s) => s.slot === "illustration");
            const photoSlot = college.slots.find((s) => s.slot === "photo");
            const logoSlot = college.slots.find((s) => s.slot === "logo");
            const notesDirty = (localNotes[college.id] ?? "") !== college.notes;

            return (
              <div key={college.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-base">{college.name}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${conferenceColors[college.conference] ?? "bg-gray-700 text-gray-300"}`}>
                      {college.conference}
                    </span>
                  </div>
                  <span className={`text-sm font-medium ${uploadedCount === 2 ? "text-green-400" : uploadedCount === 1 ? "text-yellow-400" : "text-gray-600"}`}>
                    {uploadedCount === 2 ? "✓ Full" : uploadedCount === 1 ? "✓ Partial" : "Empty"}
                  </span>
                </div>

                {/* Image slots */}
                <div className="flex gap-3">
                  {/* Illustration */}
                  {illustrationSlot && (
                    <div className="flex flex-col gap-1 w-28 shrink-0">
                      <span className="text-yellow-400 text-xs font-medium text-center">Illustration</span>
                      <SlotButton
                        slot={illustrationSlot}
                        collegeId={college.id}
                        tip={SLOT_TIPS["illustration"]}
                        colorClass={SLOT_COLORS["illustration"]}
                        isUploading={uploading === `${college.id}-illustration`}
                        isDeleting={deleting === `${college.id}-illustration`}
                        onUpload={() => triggerUpload(college.id, "illustration")}
                        onDelete={() => handleDelete(college.id, "illustration")}
                        aspectClass="aspect-[2/3]"
                      />
                    </div>
                  )}

                  {/* Jersey photo */}
                  {photoSlot && (
                    <div className="flex flex-col gap-1 w-28 shrink-0">
                      <span className="text-green-400 text-xs font-medium text-center">Jersey Photo</span>
                      <SlotButton
                        slot={photoSlot}
                        collegeId={college.id}
                        tip={SLOT_TIPS["photo"]}
                        colorClass={SLOT_COLORS["photo"]}
                        isUploading={uploading === `${college.id}-photo`}
                        isDeleting={deleting === `${college.id}-photo`}
                        onUpload={() => triggerUpload(college.id, "photo")}
                        onDelete={() => handleDelete(college.id, "photo")}
                        aspectClass="aspect-[2/3]"
                      />
                    </div>
                  )}

                  {/* Logo */}
                  {logoSlot && (
                    <div className="flex flex-col gap-1 w-20 shrink-0">
                      <span className="text-teal-400 text-xs font-medium text-center">Logo</span>
                      <SlotButton
                        slot={logoSlot}
                        collegeId={college.id}
                        tip={SLOT_TIPS["logo"]}
                        colorClass={SLOT_COLORS["logo"]}
                        isUploading={uploading === `${college.id}-logo`}
                        isDeleting={deleting === `${college.id}-logo`}
                        onUpload={() => triggerUpload(college.id, "logo")}
                        onDelete={() => handleDelete(college.id, "logo")}
                        aspectClass="aspect-square"
                      />
                    </div>
                  )}

                  {/* Helper text */}
                  <div className="flex flex-col gap-2 justify-center text-xs text-gray-600 leading-relaxed">
                    <p><span className="text-yellow-500">Illustration</span> — 2D uniform diagram, no players (Wikipedia works great)</p>
                    <p><span className="text-green-500">Jersey Photo</span> — flat lay, hanger, or mannequin shot. No people.</p>
                    <p><span className="text-teal-500">Logo</span> — school logo for commitment graphics</p>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-gray-400 text-xs">
                    Prompt notes <span className="text-gray-600">(optional — anything the AI keeps getting wrong)</span>
                  </label>
                  <textarea
                    value={localNotes[college.id] ?? ""}
                    onChange={(e) => setLocalNotes((p) => ({ ...p, [college.id]: e.target.value }))}
                    placeholder={`e.g. "The pants are gold, not yellow. The helmet is shiny gold. Numbers use a block font with no outline."`}
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  {notesDirty && (
                    <button
                      onClick={() => handleSaveNotes(college.id)}
                      disabled={savingNotes === college.id}
                      className="self-end text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {savingNotes === college.id ? "Saving…" : "Save Notes"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl text-sm font-medium shadow-xl z-50 ${toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Slot button component ─────────────────────────────────────────────────────

interface SlotButtonProps {
  slot: JerseySlot;
  collegeId: string;
  tip: string;
  colorClass: string;
  isUploading: boolean;
  isDeleting: boolean;
  onUpload: () => void;
  onDelete: () => void;
  aspectClass: string;
}

function SlotButton({ slot, tip, isUploading, isDeleting, onUpload, onDelete, aspectClass }: SlotButtonProps) {
  if (slot.url) {
    return (
      <div className={`relative group ${aspectClass} rounded-lg overflow-hidden bg-gray-800`}>
        <img
          src={`${slot.url}?t=${Date.now()}`}
          alt={slot.label}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
          <button onClick={onUpload} title="Replace" className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 rounded-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
          <button onClick={onDelete} disabled={isDeleting} title="Remove" className="bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-lg">
            {isDeleting
              ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
              : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            }
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onUpload}
      disabled={isUploading}
      title={tip}
      className={`${aspectClass} w-full rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-500 hover:bg-gray-800/50 transition-all flex flex-col items-center justify-center gap-1 text-gray-600 hover:text-gray-400`}
    >
      {isUploading
        ? <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
        : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg><span className="text-xs">Add</span></>
      }
    </button>
  );
}
