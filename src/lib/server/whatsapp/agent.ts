import { GoogleGenAI, Type, FunctionDeclaration, Part } from "@google/genai";
import {
  getTripOverview,
  searchStudents,
  getAllergiesAndMedical,
  getBusManifest,
  getRoomAllocation,
  getStaffAndContacts,
  getItinerary,
} from "../trip-tools";
import { searchSafetyRegulations, CircularType } from "../safety-guidelines/search";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPT = `אתה "עוזר מבצעי תיק טיול" 🎒 - סוכן AI לרכזי טיולים, מנהלים ומורים בשטח.
המטרה שלך היא לספק מידע מבצעי מהיר, תמציתי ומדויק על הטיול הפעיל ועל נהלי חוזרי מנכ״ל של משרד החינוך.

עקרונות פעולה:
1. תשובות קצרות ומבצעיות: המשתמש נמצא בשטח (על אוטובוס, במסלול הליכה או באכסניה). אל תכתוב פסקאות מבוא או ברכות ארוכות.
2. אימוג'ים ממוקדים:
   - 📞 למספרי טלפון (הצג תמיד מספר טלפון נקי כדי שיהיה קל ללחוץ עליו ולחייג).
   - 🚨 לאלרגיות מסכנות חיים, מזרקי אפיפן או מצבי חירום.
   - 🚌 לאוטובוסים, נהגים ומאבטחים.
   - 🛏️ לחדרים באכסניה.
   - 📋 ללו״ז ומנהלות.
3. בטיחות ונהלים: כאשר נשאל על מזג אוויר, עומס חום, אבטחה, נשק, מים, אלרגיות או נגישות - השתמש תמיד בכלי 'search_safety_regulations' וצטט את שם החוזר.
4. נאמנות מוחלטת למידע: אם פרט כלשהו לא הוזן במערכת (למשל חלוקת חדרים לא קיימת או אין נהג רשום), אמור במפורש שהנתון טרם עודכן באתר.`;

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_trip_overview",
    description: "שליפת פרטי הטיול הכלליים: שם הטיול, בית הספר, תאריכים, לינה, הסעות, כיתות ומספר התלמידים.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "search_students",
    description: "חיפוש תלמידים לפי שם מלא, שם פרטי, כיתה, או טלפון. מציג האם התלמיד יוצא, הערות רפואיות ואלרגיות.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "שם התלמיד/ה לחיפוש",
        },
        classFilter: {
          type: Type.STRING,
          description: "סינון לפי כיתה ספציפית (למשל: ט'1)",
        },
      },
    },
  },
  {
    name: "get_allergies_and_medical",
    description: "שליפת כל התלמידים עם אלרגיות למזון, רגישויות (צליאק, צמחוני, טבעוני) והערות רפואיות/תרופות.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        classFilter: {
          type: Type.STRING,
          description: "סינון אופציונלי לפי כיתה",
        },
      },
    },
  },
  {
    name: "get_bus_manifest",
    description: "שליפת שיבוץ אוטובוסים (נספח ו'): כיתות בכל אוטובוס, נהג וטלפון, חובש/מאבטח ומורים מלווים.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        busNumber: {
          type: Type.NUMBER,
          description: "מספר אוטובוס ספציפי (1, 2, 3...) אם המשתמש שאל על אוטובוס מסוים",
        },
      },
    },
  },
  {
    name: "get_room_allocation",
    description: "שליפת שיבוץ חדרים באכסניה: באיזה חדר נמצא תלמיד מסוים, או מי שוהה בחדר מסוים.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "שם התלמיד/ה או מספר החדר לחיפוש",
        },
      },
    },
  },
  {
    name: "get_staff_and_contacts",
    description: "שליפת אנשי צוות הטיול (מורים, רכז, הורים) וטלפונים חיוניים של גורמי חירום (רופא, חדר מצב, משטרה).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_itinerary",
    description: "שליפת לוח הזמנים והמסלול של הטיול (נספח ד').",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "search_safety_regulations",
    description: "חיפוש ב-5 חוזרי המנכ״ל הרשמיים בנושאי בטיחות, ביטחון ואבטחה, אקלים ועומס חום, הנגשה פרטנית, ואלרגיות ומזרקי אפיפן.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "נושא החיפוש בחוזר (למשל: 'עומס חום כבד מים', 'יחס מאבטחים', 'נוהל מזרק אפיפן')",
        },
        circularType: {
          type: Type.STRING,
          description: "סוג החוזר: all, general, security, climate, accessibility, allergies",
        },
      },
      required: ["query"],
    },
  },
];

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  tripId: string
): Promise<string> {
  try {
    switch (toolName) {
      case "get_trip_overview": {
        const data = await getTripOverview(tripId);
        return JSON.stringify(data || { message: "פרטי הטיול לא נמצאו" });
      }
      case "search_students": {
        const data = await searchStudents(
          tripId,
          typeof args.query === "string" ? args.query : undefined,
          typeof args.classFilter === "string" ? args.classFilter : undefined
        );
        return JSON.stringify(data);
      }
      case "get_allergies_and_medical": {
        const data = await getAllergiesAndMedical(
          tripId,
          typeof args.classFilter === "string" ? args.classFilter : undefined
        );
        return JSON.stringify(data);
      }
      case "get_bus_manifest": {
        const busNum =
          typeof args.busNumber === "number" || typeof args.busNumber === "string"
            ? args.busNumber
            : undefined;
        const data = await getBusManifest(tripId, busNum);
        return JSON.stringify(data);
      }
      case "get_room_allocation": {
        const data = await getRoomAllocation(
          tripId,
          typeof args.query === "string" ? args.query : undefined
        );
        return JSON.stringify(data);
      }
      case "get_staff_and_contacts": {
        const data = await getStaffAndContacts(tripId);
        return JSON.stringify(data);
      }
      case "get_itinerary": {
        const data = await getItinerary(tripId);
        return JSON.stringify(data);
      }
      case "search_safety_regulations": {
        const q = typeof args.query === "string" ? args.query : "";
        const cType =
          typeof args.circularType === "string"
            ? (args.circularType as CircularType)
            : "all";
        const results = searchSafetyRegulations(q, cType, 3);
        return JSON.stringify(results);
      }
      default:
        return JSON.stringify({ error: `כלי לא מוכר: ${toolName}` });
    }
  } catch (err: unknown) {
    console.error(`Error running tool ${toolName}:`, err);
    const message = err instanceof Error ? err.message : "שגיאה בהפעלת הכלי";
    return JSON.stringify({ error: message });
  }
}

export async function askTripAgent(
  userMessage: string,
  tripId: string,
  tripName?: string
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    return "⚠️ שירות ה-AI טרם הוגדר: אנא הוסף את מפתח ה-API (GEMINI_API_KEY) לקובץ .env.local.";
  }

  const promptText = `[מזהה טיול: ${tripId}${
    tripName ? ` | שם הטיול: ${tripName}` : ""
  }]\nשאלה: ${userMessage}`;

  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      },
    });

    let response = await chat.sendMessage({
      message: promptText,
    });

    // Tool calling loop (up to 4 turns)
    for (let turn = 0; turn < 4; turn++) {
      const functionCalls = response.functionCalls;
      if (!functionCalls || functionCalls.length === 0) {
        return response.text || "לא התקבלה תשובה מפורטת.";
      }

      // Execute functions
      const functionResponses: Part[] = [];
      for (const call of functionCalls) {
        if (!call.name) continue;
        const resultString = await executeTool(
          call.name,
          (call.args || {}) as Record<string, unknown>,
          tripId
        );
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: resultString },
            id: call.id,
          },
        });
      }

      // Send function results back to Gemini
      response = await chat.sendMessage({
        message: functionResponses,
      });
    }

    return response.text || "התקבלה תשובה חלקית בלבד.";
  } catch (err: unknown) {
    console.error("Gemini agent execution error:", err);
    const msg = err instanceof Error ? err.message : "שגיאה בתקשורת עם ה-AI";
    return `מצטער, אירעה שגיאה בעיבוד הבקשה: ${msg}`;
  }
}
