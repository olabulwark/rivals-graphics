import { NextResponse } from "next/server";
import path from "path";
import { COLLEGES } from "@/lib/colleges";
import { SLOTS, SLOT_LABELS, findSlotFile, loadNotes } from "@/lib/jerseyFiles";

export interface JerseySlot {
  slot: string;
  label: string;
  url: string | null;
}

export interface CollegeJerseyStatus {
  id: string;
  name: string;
  conference: string;
  slots: JerseySlot[];
  notes: string;
}

function getJerseyStatusForCollege(collegeId: string): JerseySlot[] {
  return SLOTS.map((slot) => {
    const filePath = findSlotFile(collegeId, slot);
    const ext = filePath ? path.extname(filePath).slice(1) : null;
    return {
      slot,
      label: SLOT_LABELS[slot],
      url: filePath ? `/jerseys/${collegeId}/${slot}.${ext}` : null,
    };
  });
}

export async function GET() {
  const statuses: CollegeJerseyStatus[] = COLLEGES.map((college) => ({
    id: college.id,
    name: college.name,
    conference: college.conference,
    slots: getJerseyStatusForCollege(college.id),
    notes: loadNotes(college.id),
  }));
  return NextResponse.json(statuses);
}
