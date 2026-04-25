import { NextRequest, NextResponse } from "next/server";
import { loadNotes, saveNotes } from "@/lib/jerseyFiles";

export async function POST(req: NextRequest) {
  try {
    const { collegeId, notes } = await req.json();
    if (!collegeId) {
      return NextResponse.json({ error: "Missing collegeId." }, { status: 400 });
    }
    saveNotes(collegeId, notes ?? "");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save notes." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const collegeId = new URL(req.url).searchParams.get("collegeId");
  if (!collegeId) {
    return NextResponse.json({ error: "Missing collegeId." }, { status: 400 });
  }
  return NextResponse.json({ notes: loadNotes(collegeId) });
}
