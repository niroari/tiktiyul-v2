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

let cachedChunks: CircularChunk[] | null = null;

function loadAllChunks(): CircularChunk[] {
  if (cachedChunks) return cachedChunks;

  const baseDir = path.join(
    process.cwd(),
    "src/lib/server/safety-guidelines"
  );
  const chunks: CircularChunk[] = [];

  for (const item of CIRCULARS_CONFIG) {
    const fullPath = path.join(baseDir, item.filename);
    if (!fs.existsSync(fullPath)) continue;

    const raw = fs.readFileSync(fullPath, "utf-8");
    const pages = raw.split(/=== עמוד (\d+) ===/);

    if (pages.length <= 1) {
      // No page markers, split by blocks
      const paragraphs = raw.split(/\n\s*\n/);
      paragraphs.forEach((p, idx) => {
        const trimmed = p.trim();
        if (trimmed.length > 80) {
          chunks.push({
            circularName: item.name,
            circularType: item.type,
            page: Math.floor(idx / 5) + 1,
            text: trimmed,
          });
        }
      });
      continue;
    }

    for (let i = 1; i < pages.length; i += 2) {
      const pageNum = parseInt(pages[i], 10) || 1;
      const pageText = (pages[i + 1] || "").trim();
      if (!pageText) continue;

      // Split page into manageable chunks if very long
      const paragraphs = pageText.split(/\n\s*\n/);
      let currentChunk = "";
      for (const p of paragraphs) {
        if ((currentChunk + "\n" + p).length > 1200) {
          if (currentChunk.trim().length > 50) {
            chunks.push({
              circularName: item.name,
              circularType: item.type,
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
          page: pageNum,
          text: currentChunk.trim(),
        });
      }
    }
  }

  cachedChunks = chunks;
  return cachedChunks;
}

/**
 * Searches the 5 Ministry of Education safety circulars for matching text/guidelines.
 * Uses keyword scoring with support for Hebrew prefixes/suffixes.
 */
export function searchSafetyRegulations(
  query: string,
  circularType: CircularType = "all",
  limit: number = 4
): Array<{
  circularName: string;
  page: number;
  text: string;
  score: number;
}> {
  const allChunks = loadAllChunks();
  const filteredChunks =
    circularType === "all"
      ? allChunks
      : allChunks.filter((c) => c.circularType === circularType);

  // Normalize keywords (strip basic Hebrew prepositions like ב, ל, מ, ה, כ, ו)
  const rawWords = query
    .toLowerCase()
    .replace(/[?!,.:;()"]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const keywords = Array.from(new Set(rawWords));

  const scored = filteredChunks
    .map((chunk) => {
      let score = 0;
      const lowerText = chunk.text.toLowerCase();

      for (const word of keywords) {
        if (lowerText.includes(word)) {
          score += 5;
        }
        // Check without common prefix (ה, ב, ל, כ, מ, ו)
        if (word.length >= 4 && ["ה", "ב", "ל", "כ", "מ", "ו"].includes(word[0])) {
          const rootWord = word.slice(1);
          if (lowerText.includes(rootWord)) {
            score += 3;
          }
        }
      }

      // Exact phrase match bonus
      if (query.length > 6 && lowerText.includes(query.toLowerCase())) {
        score += 15;
      }

      return {
        circularName: chunk.circularName,
        page: chunk.page,
        text: chunk.text,
        score,
      };
    })
    .filter((res) => res.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
