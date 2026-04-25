import fs from "fs";
import path from "path";

const JERSEYS_DIR = path.join(process.cwd(), "public", "jerseys");
const EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export const SLOTS = ["illustration", "photo", "logo"] as const;
export type JerseySlotName = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<JerseySlotName, string> = {
  illustration: "Illustration",
  photo: "Jersey Photo",
  logo: "Logo",
};

export const SLOT_TIPS: Record<JerseySlotName, string> = {
  illustration: "2D diagram or flat-lay — no players, clean design (Wikipedia uniform diagrams work great)",
  photo: "Jersey-only photo — flat lay, hanging, mannequin, or close-up. No players or people.",
  logo: "School logo image — used for the commitment graphic",
};

export function findSlotFile(collegeId: string, slot: string): string | null {
  const dir = path.join(JERSEYS_DIR, collegeId);
  if (!fs.existsSync(dir)) return null;
  for (const ext of EXTENSIONS) {
    const filePath = path.join(dir, `${slot}.${ext}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

export function loadNotes(collegeId: string): string {
  const filePath = path.join(JERSEYS_DIR, collegeId, "notes.txt");
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8").trim();
}

export function saveNotes(collegeId: string, notes: string): void {
  const dir = path.join(JERSEYS_DIR, collegeId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "notes.txt"), notes, "utf-8");
}
