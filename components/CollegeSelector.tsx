"use client";

import { useState } from "react";
import { College, COLLEGES, CONFERENCES } from "@/lib/colleges";

interface Props {
  selected: College[];
  onChange: (colleges: College[]) => void;
  max?: number;
}

export default function CollegeSelector({ selected, onChange, max = 6 }: Props) {
  const [search, setSearch] = useState("");
  const [conference, setConference] = useState("All");

  const CONF_ORDER: Record<string, number> = {
    SEC: 0,
    "Big Ten": 1,
    ACC: 2,
    "Big 12": 3,
    Independent: 4,
  };

  const filtered = COLLEGES.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nickname.toLowerCase().includes(search.toLowerCase()) ||
      c.abbreviation.toLowerCase().includes(search.toLowerCase());
    const matchesConf = conference === "All" || c.conference === conference;
    return matchesSearch && matchesConf;
  }).sort((a, b) => {
    const confDiff = (CONF_ORDER[a.conference] ?? 99) - (CONF_ORDER[b.conference] ?? 99);
    if (confDiff !== 0) return confDiff;
    return a.name.localeCompare(b.name);
  });

  const toggle = (college: College) => {
    const isSelected = selected.some((s) => s.id === college.id);
    if (isSelected) {
      onChange(selected.filter((s) => s.id !== college.id));
    } else if (selected.length < max) {
      onChange([...selected, college]);
    }
  };

  const conferenceColors: Record<string, string> = {
    SEC: "bg-blue-900/60 text-blue-300",
    "Big Ten": "bg-red-900/60 text-red-300",
    "Big 12": "bg-orange-900/60 text-orange-300",
    ACC: "bg-purple-900/60 text-purple-300",
    Independent: "bg-gray-700 text-gray-300",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
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
          {CONFERENCES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-2.5 py-1 rounded-full"
            >
              {c.name}
              <button
                onClick={() => toggle(c)}
                className="ml-1 hover:text-blue-200"
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
        {filtered.map((college) => {
          const isSelected = selected.some((s) => s.id === college.id);
          const isDisabled = !isSelected && selected.length >= max;
          return (
            <button
              key={college.id}
              onClick={() => toggle(college)}
              disabled={isDisabled}
              className={`text-left rounded-lg px-3 py-2.5 transition-all border text-sm
                ${isSelected
                  ? "bg-blue-600 border-blue-500 text-white"
                  : isDisabled
                  ? "bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed"
                  : "bg-gray-800 border-gray-700 text-white hover:border-gray-500 hover:bg-gray-750"
                }`}
            >
              <div className="font-medium truncate">{college.name}</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${conferenceColors[college.conference] ?? "bg-gray-700 text-gray-300"}`}>
                  {college.conference}
                </span>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-3 text-gray-500 text-sm py-4 text-center">No programs found</p>
        )}
      </div>

      <p className="text-xs text-gray-500 text-right">
        {selected.length}/{max} selected
      </p>
    </div>
  );
}
