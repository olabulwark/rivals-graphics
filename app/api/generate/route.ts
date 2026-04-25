import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { College } from "@/lib/colleges";
import { findSlotFile, loadNotes } from "@/lib/jerseyFiles";
import fs from "fs";

export const maxDuration = 60;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

interface ImagePart {
  inlineData: { mimeType: string; data: string };
}

interface TextPart {
  text: string;
}

type Part = ImagePart | TextPart;

function loadImage(collegeId: string, slot: string): ImagePart | null {
  const filePath = findSlotFile(collegeId, slot);
  if (!filePath) return null;
  const ext = filePath.split(".").pop() ?? "jpg";
  const data = fs.readFileSync(filePath).toString("base64");
  return { inlineData: { mimeType: MIME[ext] ?? "image/jpeg", data } };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const collegesJson = formData.get("colleges") as string;
    const jerseyNumber = (formData.get("jerseyNumber") as string) || "1";
    const recruitName = (formData.get("recruitName") as string) || "the recruit";

    if (!imageFile || !collegesJson) {
      return NextResponse.json({ error: "Missing image or colleges data." }, { status: 400 });
    }

    const colleges: College[] = JSON.parse(collegesJson);
    if (!colleges.length) {
      return NextResponse.json({ error: "No colleges selected." }, { status: 400 });
    }

    const imageBytes = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBytes).toString("base64");
    const mimeType = imageFile.type as "image/jpeg" | "image/png" | "image/webp";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-image" });

    const results = await Promise.allSettled(
      colleges.map(async (college) => {
        const parts: Part[] = [];

        // ── 1. Recruit photo (always first — anchors the subject) ──────────
        parts.push({ text: `SUBJECT: This is ${recruitName}. This is the only person who should appear in the output. Do not replace or alter this person's identity in any way.` });
        parts.push({ inlineData: { mimeType, data: base64Image } });

        // ── 2. Illustration (if uploaded) ──────────────────────────────────
        const illustration = loadImage(college.id, "illustration");
        if (illustration) {
          parts.push({ text: `UNIFORM DIAGRAM: This is a 2D illustration of the official ${college.name} ${college.nickname} football uniform. Use it to understand the exact color layout, logo placement, stripe patterns, and design structure. There is no person in this image — it is a design reference only.` });
          parts.push(illustration);
        }

        // ── 3. Jersey-only photo (if uploaded) ────────────────────────────
        const jerseyPhoto = loadImage(college.id, "photo");
        let photoCount = 0;
        if (jerseyPhoto) {
          photoCount = 1;
          parts.push({ text: `JERSEY PHOTO REFERENCE: This is a current photo of the actual ${college.name} ${college.nickname} jersey with no person wearing it. Use it to understand the exact colors, logo details, fabric texture, and current uniform design. There is no person in this image — do not copy any body or face from it.` });
          parts.push(jerseyPhoto);
        }

        // ── 4. Custom notes (if any) ────────────────────────────────────────
        const notes = loadNotes(college.id);

        // ── 5. Task instructions ───────────────────────────────────────────
        const hasAnyRef = illustration || photoCount > 0;

        let taskText: string;
        if (hasAnyRef) {
          taskText = `TASK: Produce an edited version of the SUBJECT photo above.

- The output must show ${recruitName} — the person from the subject photo — and nobody else
- Keep ${recruitName}'s face, skin, hair, body proportions, pose, and background completely unchanged
- Replace only their clothing with the authentic ${college.name} ${college.nickname} football uniform shown in the references above
- Match the exact colors, logos, stripe patterns, and design details from the uniform diagram
- Jersey number: ${jerseyNumber}
- The final image must look like a realistic photo of ${recruitName} wearing the ${college.name} jersey${notes ? `\n\nADDITIONAL NOTES: ${notes}` : ""}`;
        } else {
          taskText = `TASK: Produce an edited version of the SUBJECT photo above.

- The output must show ${recruitName} — the person from the subject photo — and nobody else
- Keep ${recruitName}'s face, skin, hair, body proportions, pose, and background completely unchanged
- Replace only their clothing with an authentic ${college.name} ${college.nickname} football uniform
- Uniform details: ${college.jerseyDescription}
- Primary color: ${college.primaryColor}, secondary color: ${college.secondaryColor}
- Jersey number: ${jerseyNumber}
- The final image must look like a realistic photo of ${recruitName} wearing the ${college.name} jersey${notes ? `\n\nADDITIONAL NOTES: ${notes}` : ""}`;
        }

        parts.push({ text: taskText });

        const result = await model.generateContent({
          contents: [{ role: "user", parts }],
          generationConfig: {
            // @ts-expect-error responseModalities not yet in types
            responseModalities: ["IMAGE"],
          },
        });

        const candidates = result.response.candidates;
        if (!candidates?.length) throw new Error("No image generated");

        const imagePart = candidates[0].content.parts.find(
          (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData
        );
        if (!imagePart?.inlineData) throw new Error("No image data in response");

        return {
          collegeId: college.id,
          collegeName: college.name,
          nickname: college.nickname,
          imageData: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType,
          refsUsed: (illustration ? 1 : 0) + photoCount,
        };
      })
    );

    const successful = results
      .filter((r): r is PromiseFulfilledResult<{
        collegeId: string; collegeName: string; nickname: string;
        imageData: string; mimeType: string; refsUsed: number;
      }> => r.status === "fulfilled")
      .map((r) => r.value);

    const failed = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r, i) => ({
        college: colleges[i]?.name ?? "Unknown",
        error: r.reason?.message ?? "Unknown error",
      }));

    return NextResponse.json({ results: successful, errors: failed });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
