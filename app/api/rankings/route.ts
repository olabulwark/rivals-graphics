import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface RankEntry {
  rank: number;
  name: string;
  location: string;
  logoUrl: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "national";
  const type = searchParams.get("type") ?? "composite";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "25"), 25);
  const debug = searchParams.get("debug") === "true";

  let on3Url: string;
  if (scope === "national") {
    on3Url =
      type === "massey"
        ? "https://www.on3.com/high-school/rankings/football/national/?type=massey"
        : "https://www.on3.com/high-school/rankings/football/national/";
  } else {
    on3Url = `https://www.on3.com/high-school/rankings/football/${scope}/?type=massey`;
  }

  try {
    const res = await fetch(on3Url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `On3 returned ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();

    if (debug) {
      const nextDataMatch = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
      );
      let arrayPaths: Array<{ path: string; length: number; keys: string; sample: string }> = [];
      if (nextDataMatch) {
        try {
          const nd = JSON.parse(nextDataMatch[1]);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          function findArrays(obj: any, path: string, depth: number): typeof arrayPaths {
            if (depth > 8 || !obj || typeof obj !== "object") return [];
            let r: typeof arrayPaths = [];
            if (Array.isArray(obj) && obj.length >= 3) {
              const first = obj[0];
              if (first && typeof first === "object") {
                r.push({
                  path,
                  length: obj.length,
                  keys: Object.keys(first).slice(0, 15).join(","),
                  sample: JSON.stringify(first).substring(0, 300),
                });
              }
            }
            if (!Array.isArray(obj)) {
              for (const [k, v] of Object.entries(obj)) {
                r = r.concat(findArrays(v, `${path}.${k}`, depth + 1));
              }
            }
            return r;
          }
          arrayPaths = findArrays(nd, "root", 0).slice(0, 20);
        } catch {}
      }
      return NextResponse.json({
        htmlLength: html.length,
        hasNextData: !!nextDataMatch,
        arrayPaths,
        on3Url,
      });
    }

    const isState = scope !== "national";
    const entries = parseRankings(html, limit, isState);
    return NextResponse.json(
      { entries, count: entries.length, on3Url },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function parseRankings(html: string, limit: number, isState = false): RankEntry[] {
  // Try __NEXT_DATA__ first — most reliable for Next.js sites
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const entries = extractFromNextData(data, limit, isState);
      if (entries.length > 0) return entries;
    } catch {
      // fall through to HTML parsing
    }
  }

  return extractFromHtml(html, limit);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromNextData(data: any, limit: number, isState = false): RankEntry[] {
  // Known path: pageProps.teamRankings.list (same on all three URL types)
  const list = data?.props?.pageProps?.teamRankings?.list;
  if (Array.isArray(list) && list.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return list.slice(0, limit).map((item: any, i: number) => {
      // Massey pages use `currentOrganization`; composite page uses `organization`
      const org = item.currentOrganization ?? item.organization ?? {};
      const logoRaw: string = org.assetUrl ?? org.logo ?? org.logoUrl ?? "";

      // city is a nested object: { name, state?: { abbreviation } }
      // On composite page, state is a separate top-level field with the same shape
      const cityObj = item.city;
      const cityName: string =
        typeof cityObj === "object" ? (cityObj?.name ?? "") : String(cityObj ?? "");
      const stateObj = cityObj?.state ?? item.state;
      const stateAbbr: string = stateObj?.abbreviation ?? "";
      const location = cityName && stateAbbr ? `${cityName}, ${stateAbbr}` : cityName;

      // Pick rank: composite pages use compositeOverallRank / compositeStateRank
      // Massey pages use nationalRank / classificationRank
      const rank = isState
        ? (item.classificationRank ?? item.compositeStateRank ?? item.masseyStateRank ?? i + 1)
        : (item.nationalRank ?? item.compositeOverallRank ?? item.masseyOverallRank ?? i + 1);

      return {
        rank,
        name: org.name ?? org.fullName ?? "",
        location,
        logoUrl: normalizeLogoUrl(logoRaw),
      };
    }).filter((e) => e.name.length > 0);
  }
  return [];
}

function normalizeLogoUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("/uploads"))
    return `https://on3static.com/cdn-cgi/image/height=90,width=90${url}`;
  if (url.startsWith("/")) return `https://on3static.com${url}`;
  return url;
}

function extractFromHtml(html: string, limit: number): RankEntry[] {
  // Collect all on3static logo URLs (normalize to height=90,width=90)
  const logoUrls: string[] = [];
  const seenLogos = new Set<string>();
  const logoRe =
    /src="(https:\/\/on3static\.com\/cdn-cgi\/image\/[^"]+\/uploads\/assets\/[^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = logoRe.exec(html)) !== null) {
    const normalized = m[1].replace(
      /\/cdn-cgi\/image\/[^/]+\//,
      "/cdn-cgi/image/height=90,width=90/"
    );
    if (!seenLogos.has(normalized)) {
      seenLogos.add(normalized);
      logoUrls.push(normalized);
    }
  }

  // Collect rank numbers from elements with "Rank" in the class name
  const ranks: number[] = [];
  const rankRe = /class="[^"]*[Rr]ank[^"]*"[^>]*>\s*0*(\d{1,2})\s*</g;
  while ((m = rankRe.exec(html)) !== null) {
    const r = parseInt(m[1]);
    if (r >= 1 && r <= 25) ranks.push(r);
  }

  // Collect school names from anchor tags with team/school paths
  const names: string[] = [];
  const nameRe =
    /<a[^>]+href="\/(?:high-school\/)?(?:football\/)?[^"]*(?:team|school)[^"]*"[^>]*>\s*([^<\n]{2,60}?)\s*<\/a>/g;
  while ((m = nameRe.exec(html)) !== null) {
    const name = m[1].trim();
    if (name.length > 1) names.push(name);
  }

  // Collect locations: "City, ST" patterns near the logos
  const locations: string[] = [];
  const locRe = /·\s*([A-Z][a-zA-Z\s\.]+,\s*[A-Z]{2})/g;
  while ((m = locRe.exec(html)) !== null) {
    locations.push(m[1].trim());
  }

  const count = Math.min(
    Math.max(logoUrls.length, ranks.length),
    limit
  );
  const entries: RankEntry[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      rank: ranks[i] ?? i + 1,
      name: names[i] ?? "",
      location: locations[i] ?? "",
      logoUrl: logoUrls[i] ?? "",
    });
  }
  return entries;
}
