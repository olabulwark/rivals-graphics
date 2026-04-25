import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const JERSEYS_DIR = path.join(process.cwd(), "public", "jerseys");

export async function POST(req: NextRequest) {
  try {
    const { collegeId, slot } = await req.json();
    if (!collegeId || !slot) {
      return NextResponse.json({ error: "Missing collegeId or slot." }, { status: 400 });
    }

    const dir = path.join(JERSEYS_DIR, collegeId);
    let deleted = false;
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const filePath = path.join(dir, `${slot}.${ext}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Delete failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
