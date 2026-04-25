import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const JERSEYS_DIR = path.join(process.cwd(), "public", "jerseys");
const VALID_SLOTS = ["illustration", "photo", "logo"];
const VALID_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const collegeId = formData.get("collegeId") as string;
    const slot = formData.get("slot") as string;
    const file = formData.get("image") as File;

    if (!collegeId || !slot || !file) {
      return NextResponse.json({ error: "Missing collegeId, slot, or image." }, { status: 400 });
    }
    if (!VALID_SLOTS.includes(slot)) {
      return NextResponse.json({ error: `Invalid slot "${slot}". Must be one of: ${VALID_SLOTS.join(", ")}.` }, { status: 400 });
    }
    const ext = VALID_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, or WebP." }, { status: 400 });
    }

    const dir = path.join(JERSEYS_DIR, collegeId);
    fs.mkdirSync(dir, { recursive: true });

    // Remove any existing file for this slot (any extension)
    for (const e of ["jpg", "jpeg", "png", "webp"]) {
      const existing = path.join(dir, `${slot}.${e}`);
      if (fs.existsSync(existing)) fs.unlinkSync(existing);
    }

    const filePath = path.join(dir, `${slot}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ success: true, url: `/jerseys/${collegeId}/${slot}.${ext}` });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 }
    );
  }
}
