/**
 * sync-logos.mjs
 *
 * Drop logo files named {collegeId}.png / .jpg / .webp into scripts/logo-intake/
 * then run:  node scripts/sync-logos.mjs
 *
 * Each file will be copied to public/jerseys/{collegeId}/logo.{ext},
 * replacing any existing logo for that school.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const INTAKE_DIR = path.join(__dirname, "logo-intake");
const JERSEYS_DIR = path.join(__dirname, "..", "public", "jerseys");
const VALID_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

// Create intake folder if it doesn't exist yet
if (!fs.existsSync(INTAKE_DIR)) {
  fs.mkdirSync(INTAKE_DIR, { recursive: true });
  console.log(`Created intake folder: scripts/logo-intake/`);
  console.log(`Drop your logo files in there and re-run this script.`);
  process.exit(0);
}

const files = fs.readdirSync(INTAKE_DIR);
if (files.length === 0) {
  console.log("No files found in scripts/logo-intake/ — nothing to do.");
  process.exit(0);
}

let copied = 0, skipped = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!VALID_EXTS.includes(ext)) {
    console.warn(`  SKIP  ${file}  (unsupported extension)`);
    skipped++;
    continue;
  }

  const collegeId = path.basename(file, ext);
  const destDir   = path.join(JERSEYS_DIR, collegeId);

  // Check the target directory exists (i.e. it's a known college id)
  // We don't strictly require it — we'll create it — but warn if unexpected
  if (!fs.existsSync(destDir)) {
    console.warn(`  WARN  ${file}  — no existing folder for "${collegeId}", creating anyway`);
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Remove any pre-existing logo in any extension
  for (const e of VALID_EXTS) {
    const old = path.join(destDir, `logo${e}`);
    if (fs.existsSync(old)) fs.unlinkSync(old);
  }

  const dest = path.join(destDir, `logo${ext}`);
  fs.copyFileSync(path.join(INTAKE_DIR, file), dest);
  console.log(`  OK    ${file}  →  public/jerseys/${collegeId}/logo${ext}`);
  copied++;
}

console.log(`\nDone. ${copied} logo(s) synced, ${skipped} skipped.`);
