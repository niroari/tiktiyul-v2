import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { searchSafetyRegulations } from "../src/lib/server/safety-guidelines/search.ts";
import { askTripAgent } from "../src/lib/server/whatsapp/agent.ts";

async function runTests() {
  console.log("=== Testing WhatsApp Agent Safety Regulations Search ===");
  const heatResults = searchSafetyRegulations("עומס חום כבד שתייה מים", "climate", 2);
  console.log(`Heat stress queries returned ${heatResults.length} matches:`);
  heatResults.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.circularName} (עמוד ${r.page})`);
  });

  console.log("\n=== Testing AI Agent (Google Gemini 2.5 Flash) ===");
  try {
    const aiAnswer = await askTripAgent(
      "מה ההנחיה בחוזר מנכ״ל לגבי עומס חום כבד ומים?",
      "test-trip-id",
      "טיול שנתי עין גדי"
    );
    console.log("\nAI Agent Response:\n", aiAnswer);
  } catch (err) {
    console.error("AI Agent query error:", err);
  }
}

runTests();
