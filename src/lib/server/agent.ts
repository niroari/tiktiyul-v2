import { GoogleGenAI, Type, FunctionDeclaration, Part } from "@google/genai";
import {
  getTripOverview,
  searchStudents,
  getAllergiesAndMedical,
  getBusManifest,
  getRoomAllocation,
  getStaffAndContacts,
  getItinerary,
  getTripDocumentsAndSignatures,
  getWeatherAndClimate,
  getAccompanyingParents,
  getSecurityApprovalDetails,
} from "./trip-tools";
import { searchSafetyRegulations, CircularType } from "./safety-guidelines/search";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPT = `אתה "חיליק" 🎒 - סוכן ה-AI המבצעי של מערכת 'תיק טיול' ומומחה שטח וידיעת הארץ לרכזי טיולים, מנהלים ומורים.
יש לך ידע מקיף של 360 מעלות על כל נתוני הטיול מתיק הטיול, על נהלי חוזרי מנכ״ל של משרד החינוך, ועל מסלולים, אתרים וטבע בישראל.

תפקידך ומטרותיך:
1. מענה מבצעי שטח: תמציתי, מדויק ומקצועי. המשתמש נמצא בשטח (על אוטובוס, במסלול או באכסניה). אל תכתוב הקדמות ארוכות או פסקאות מיותרות.
2. מומחה מסלולים, אתרים וידיעת הארץ:
   - כאשר נשאל על מסלולים חלופיים (למשל עקב עומס חום, גשם או עייפות): בדוק היכן הטיול נמצא (באמצעות get_trip_overview או get_itinerary) והצע חלופות מותאמות לאזור, לשכבת הגיל (ט׳), ולנהלי משרד החינוך (מסלולים מסומנים בלבד, מוצלים, נקודות מים).
   - כאשר נשאל על מידע על אתרים, היסטוריה, שעות פתיחה, עלויות, או האם אתר מסוים פתוח/סגור - השתמש ב-'search_web_and_sites_info' כדי לוודא מידע עדכני ואמין.
3. אימוג'ים ממוקדים:
   - 📞 למספרי טלפון (הצג מספר טלפון נקי כדי שיהיה קל ללחוץ ולחייג).
   - 🚨 לאלרגיות מסכנות חיים, מזרקי אפיפן או מצבי חירום.
   - 🚌 לאוטובוסים, נהגים ומאבטחים.
   - 🛏️ לחדרים באכסניה.
   - 📋 ללו״ז ומנהלות.
   - ⛅ למזג אוויר ועומס חום.
   - 🌲 למסלולי טיול, אתרי טבע ונקודות עניין.
   - ✍️ לחתימות דיגיטליות ומסמכים.
4. שימוש בכלים הייעודיים:
   - כמויות תלמידים, כמה יוצאים/לא יוצאים, שמות מי שלא יוצא, חלוקת בנים/בנות: 'get_trip_overview'.
   - תחזית מזג אוויר ועומס חום: 'get_weather_and_climate' ובדיקת תקנות ב-'search_safety_regulations' (חוזר אקלים).
   - סטטוס חתימות ומוכנות נספחים: 'get_trip_documents_and_signatures'.
   - דרישות אבטחה, נשק, כמה מאבטחים נדרשים, חובשים, או הנחיות מהאישור הביטחוני: 'get_security_approval_details' (כלי זה קורא ומפענח ישירות את קובץ ה-PDF של האישור הביטחוני שהועלה לטיול).
   - מסלולים חלופיים, אתרי טבע, שעות פתיחה, התרעות: 'search_web_and_sites_info'.
   - הורים מלווים: 'get_accompanying_parents'.
   - אוטובוסים, נהגים, חובשים: 'get_bus_manifest'.
   - שיבוץ חדרים: 'get_room_allocation'.
   - אלרגיות ומגבלות רפואיות: 'get_allergies_and_medical'.
   - לוח זמנים: 'get_itinerary'.
5. נאמנות מוחלטת למידע: אם פרט כלשהו לא עודכן בתיק הטיול, ציין זאת במפורש.`;

const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_trip_overview",
    description: "שליפת פרטי הטיול הכלליים: שם הטיול, בית הספר, תאריכים, לינה, הסעות, כיתות, סה״כ תלמידים, כמה תלמידים יוצאים (confirmedGoing), כמה לא יוצאים (notGoingCount) ושמות כל התלמידים שלא יוצאים לטיול (notGoingStudents).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "search_students",
    description: "חיפוש תלמידים לפי שם מלא, שם פרטי, כיתה, טלפון, או סינון תלמידים שלא יוצאים לטיול. מציג האם התלמיד יוצא (isGoing), הערות רפואיות ואלרגיות.",
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
        onlyNotGoing: {
          type: Type.BOOLEAN,
          description: "האם להציג רק תלמידים שלא יוצאים לטיול",
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
    name: "get_trip_documents_and_signatures",
    description: "שליפת סטטוס חתימות דיגיטליות על מסמכי הטיול (האם כל המסמכים חתומים, כתב מינוי מנהל, אישור רכז ומנהל, אישורי הורים) וסטטוס מילוי כל נספחי הטיול (א׳ עד י׳).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "get_weather_and_climate",
    description: "שליפת תחזית מזג אוויר חיה ליעד הטיול (טמפרטורת בוקר, שיא חום בצהריים, סיכוי לגשם) וניתוח מדד עומס חום לפי הנחיות חוזר מנכ״ל עומס חום של משרד החינוך.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "שם העיר או האזור לחיזוי (לדוגמה: 'עכו', 'ירושלים', 'מצדה', 'ים המלח'). אם לא צוין, נלקח יעד הטיול.",
        },
      },
    },
  },
  {
    name: "get_accompanying_parents",
    description: "שליפת רשימת ההורים המלווים בטיול, מספרי הטלפון שלהם, ושמות הילדים והכיתות שלהם.",
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
  {
    name: "search_web_and_sites_info",
    description: "חיפוש חי באינטרנט (Google Search) על אתרי טבע, שמורות וגנים לאומיים בישראל, מסלולי טיול חלופיים, שעות פתיחה, מחירי כניסה, התרעות על סגירת מסלולים או שטפונות, ומידע היסטורי/גיאוגרפי על אתרי הטיול.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "שאילתת החיפוש (למשל: 'מסלול חלופי מוצל קרוב לעכו לשכבת ט', 'שעות פתיחה של שמורת עין אפק', 'מצב מסלול נחל כזיב')",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_security_approval_details",
    description: "קריאה ופיענוח ישיר של מסמך ה-PDF של האישור הביטחוני הרשמי שהועלה לטיול (בלשונית 'אישור ביטחוני'). מציג במדויק: כמות מאבטחים ואיזה נשק נדרש לטיול ביום ובלינה, מספר אישור הטיול, חובשים, הגבלות ביטחוניות על מסלולים, ודגשים מחדר מצב טיולים.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: {
          type: Type.STRING,
          description: "שאלת המשתמש לגבי האישור הביטחוני (למשל: 'כמה מאבטחים אני צריך?', 'מה מספר אישור הטיול?', 'האם נדרש נשק בלינה?')",
        },
      },
    },
  },
];

async function searchWebWithGrounding(query: string): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) return "חיפוש רשת אינו זמין כעת.";
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `ענה בעברית בצורה תמציתית, מדויקת ומעודכנת על שאלת השטח/אתר/מסלול הבאה:\n${query}`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return res.text || "לא נמצא מידע עדכני ברשת.";
  } catch (err) {
    console.warn("Google search grounding error:", err);
    return "שגיאה בחיפוש רשת. אנא נסה לנסח מחדש.";
  }
}

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
          typeof args.classFilter === "string" ? args.classFilter : undefined,
          typeof args.onlyNotGoing === "boolean" ? args.onlyNotGoing : undefined
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
      case "get_trip_documents_and_signatures": {
        const data = await getTripDocumentsAndSignatures(tripId);
        return JSON.stringify(data);
      }
      case "get_weather_and_climate": {
        const loc = typeof args.location === "string" ? args.location : undefined;
        const data = await getWeatherAndClimate(tripId, loc);
        return JSON.stringify(data);
      }
      case "get_accompanying_parents": {
        const data = await getAccompanyingParents(tripId);
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
      case "search_web_and_sites_info": {
        const q = typeof args.query === "string" ? args.query : "";
        const data = await searchWebWithGrounding(q);
        return data;
      }
      case "get_security_approval_details": {
        const q = typeof args.question === "string" ? args.question : undefined;
        const data = await getSecurityApprovalDetails(tripId, q);
        return JSON.stringify(data);
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
