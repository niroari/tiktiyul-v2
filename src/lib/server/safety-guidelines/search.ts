import fs from "fs";
import path from "path";

export type CircularType =
  | "all"
  | "general"
  | "security"
  | "climate"
  | "accessibility"
  | "allergies";

interface CircularChunk {
  circularName: string;
  circularType: CircularType;
  filename: string;
  page: number;
  text: string;
}

const CIRCULARS_CONFIG: Array<{
  type: CircularType;
  name: string;
  filename: string;
}> = [
  {
    type: "general",
    name: "חוזר מנכ״ל טיולים כללי (הוראת קבע 0339)",
    filename: "circular-general-trips.txt",
  },
  {
    type: "security",
    name: "חוזר מנכ״ל ביטחון ובטיחות בטיולים",
    filename: "circular-security.txt",
  },
  {
    type: "climate",
    name: "חוזר מנכ״ל אקלים ומזג אוויר קיצוני",
    filename: "circular-climate.txt",
  },
  {
    type: "accessibility",
    name: "חוזר מנכ״ל הנגשה פרטנית לתלמיד עם מוגבלות",
    filename: "circular-accessibility.txt",
  },
  {
    type: "allergies",
    name: "חוזר מנכ״ל הבטחת בריאותם של תלמידים אלרגיים למזון",
    filename: "circular-allergies.txt",
  },
];

interface LoadedCircularData {
  chunks: CircularChunk[];
  pagesMap: Map<string, Map<number, string>>; // filename -> (pageNum -> text)
}

let cachedData: LoadedCircularData | null = null;

function loadCircularData(): LoadedCircularData {
  if (cachedData) return cachedData;

  const baseDir = path.join(
    process.cwd(),
    "src/lib/server/safety-guidelines"
  );
  const chunks: CircularChunk[] = [];
  const pagesMap = new Map<string, Map<number, string>>();

  for (const item of CIRCULARS_CONFIG) {
    const fullPath = path.join(baseDir, item.filename);
    if (!fs.existsSync(fullPath)) continue;

    const raw = fs.readFileSync(fullPath, "utf-8");
    const pages = raw.split(/=== עמוד (\d+) ===/);
    const itemPages = new Map<number, string>();
    pagesMap.set(item.filename, itemPages);

    if (pages.length <= 1) {
      // No page markers, split by blocks
      const paragraphs = raw.split(/\n\s*\n/);
      paragraphs.forEach((p, idx) => {
        const trimmed = p.trim();
        if (trimmed.length > 80) {
          const pageNum = Math.floor(idx / 5) + 1;
          chunks.push({
            circularName: item.name,
            circularType: item.type,
            filename: item.filename,
            page: pageNum,
            text: trimmed,
          });
          itemPages.set(pageNum, (itemPages.get(pageNum) || "") + "\n" + trimmed);
        }
      });
      continue;
    }

    for (let i = 1; i < pages.length; i += 2) {
      const pageNum = parseInt(pages[i], 10) || 1;
      const pageText = (pages[i + 1] || "").trim();
      if (!pageText) continue;

      itemPages.set(pageNum, pageText);

      // Split page into manageable chunks if very long
      const paragraphs = pageText.split(/\n\s*\n/);
      let currentChunk = "";
      for (const p of paragraphs) {
        if ((currentChunk + "\n" + p).length > 1200) {
          if (currentChunk.trim().length > 50) {
            chunks.push({
              circularName: item.name,
              circularType: item.type,
              filename: item.filename,
              page: pageNum,
              text: currentChunk.trim(),
            });
          }
          currentChunk = p;
        } else {
          currentChunk = currentChunk ? currentChunk + "\n" + p : p;
        }
      }
      if (currentChunk.trim().length > 50) {
        chunks.push({
          circularName: item.name,
          circularType: item.type,
          filename: item.filename,
          page: pageNum,
          text: currentChunk.trim(),
        });
      }
    }
  }

  cachedData = { chunks, pagesMap };
  return cachedData;
}

/**
 * Searches the 5 Ministry of Education safety circulars for matching text/guidelines.
 * Uses keyword scoring with support for Hebrew prefixes/suffixes and multi-page stitching.
 */
export function searchSafetyRegulations(
  query: string,
  circularType: CircularType = "all",
  limit: number = 6
): Array<{
  circularName: string;
  page: number;
  text: string;
  score: number;
}> {
  const { chunks, pagesMap } = loadCircularData();
  const filteredChunks =
    circularType === "all"
      ? chunks
      : chunks.filter((c) => c.circularType === circularType);

  // Normalize keywords (strip basic Hebrew prepositions like ב, ל, מ, ה, כ, ו, ש)
  const rawWords = query
    .toLowerCase()
    .replace(/[?!,.:;()"]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const keywords = Array.from(new Set(rawWords));
  if (keywords.length === 0) return [];

  const scored = filteredChunks
    .map((chunk) => {
      let score = 0;
      let matchedCount = 0;
      const lowerText = chunk.text.toLowerCase();

      for (const word of keywords) {
        let matched = false;
        if (lowerText.includes(word)) {
          score += 6;
          matched = true;
        }
        // Check without common prefix (ה, ב, ל, כ, מ, ו, ש)
        if (word.length >= 4 && ["ה", "ב", "ל", "כ", "מ", "ו", "ש"].includes(word[0])) {
          const rootWord = word.slice(1);
          if (lowerText.includes(rootWord)) {
            score += 4;
            matched = true;
          }
        }
        if (matched) {
          matchedCount++;
        }
      }

      // Bonus for multiple distinct keyword hits
      if (matchedCount > 1) {
        score += matchedCount * 5;
      }

      // Exact phrase match bonus
      if (query.length > 5 && lowerText.includes(query.toLowerCase())) {
        score += 25;
      }

      // Header bonus: sections, chapters, appendices
      if (/נספח [א-ת]|פרק \d|סעיף \d/i.test(chunk.text)) {
        score += 4;
      }

      return {
        chunk,
        score,
      };
    })
    .filter((res) => res.score > 0)
    .sort((a, b) => b.score - a.score);

  // Deduplicate and stitch adjacent continuation pages
  const results: Array<{
    circularName: string;
    page: number;
    text: string;
    score: number;
  }> = [];

  const seenPages = new Set<string>();

  for (const item of scored) {
    const key = `${item.chunk.filename}_${item.chunk.page}`;
    if (seenPages.has(key)) continue;
    seenPages.add(key);

    let fullText = item.chunk.text;

    // Multi-page stitching: Check if next page exists in the same circular
    const filePages = pagesMap.get(item.chunk.filename);
    if (filePages) {
      const nextPage = item.chunk.page + 1;
      const nextPageText = filePages.get(nextPage);
      if (nextPageText && nextPageText.trim().length > 30) {
        fullText += `\n\n=== [המשך ישיר בעמוד ${nextPage}] ===\n${nextPageText.slice(0, 1500)}`;
        seenPages.add(`${item.chunk.filename}_${nextPage}`);
      }
    }

    results.push({
      circularName: item.chunk.circularName,
      page: item.chunk.page,
      text: fullText,
      score: item.score,
    });

    if (results.length >= limit) break;
  }

  return results;
}
