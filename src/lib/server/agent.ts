import { GoogleGenAI, Type, FunctionDeclaration, Part } from "@google/genai";
import {
  getTripOverview,
  searchStudents,
  getAllergiesAndMedical,
  getMedicalRestrictions,
  getDietaryPreferences,
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
2. מומחה מסלולים, אתרים, אכסניות וידיעת הארץ:
   - כאשר נשאל על פרטי אכסניה, מקום לינה, אתרים, או ספקים (מספרי טלפון, כתובת, מייל, שעות קבלה): בדוק היכן הלינה ב-'get_trip_overview' (למשל 'אכסניית אנ״א עכו') והשתמש ב-'search_web_and_sites_info' כדי לספק את מספר הטלפון והכתובת המדויקים (📞 04-9911982).
   - שמור תמיד על רציפות השיחה והקשר: אם המשתמש שואל שאלת המשך כגון "מה מספר הטלפון שלהם?", "איפה זה נמצא?", "מי איש הקשר?", זהה מיד לפי ההקשר וההודעות הקודמות בשיחה על מי מדובר, וענה ישירות מבלי לבקש הבהרות מיותרות!
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
4. שימוש בכלים הייעודיים והפרדה ברורה בין רפואי להסעדה:
   - 🚨 מגבלות רפואיות, אלרגיות מסכנות חיים, מזרקי אפיפן, מחלות כרוניות, נכויות, פציעות, תרופות (נספח י'): השתמש אך ורק ב-'get_medical_restrictions'. זהו נספח י' הרשמי!
     * הדגש מיד באימוג'י 🚨 ובאופן בולט כל תלמיד שנושא מזרק אפיפן (Epipen).
     * פרט את שם התלמיד, כיתתו, המגבלה הרפואית המדויקת, הנחיות מיוחדות ומספר טלפון לחירום.
   - 🥗 העדפות מזון, תזונה ומנות מיוחדות (צמחוני, טבעוני, ללא גלוטן/צליאק): השתמש ב-'get_dietary_preferences'.
     * לעולם, בשום אופן, אל תציג תלמידים צמחוניים או טבעוניים כבעלי "מגבלה רפואית"! אלו העדפות מזון לצורכי קייטרינג/הסעדה ולא נספח רפואי.
   - 🔒 אבטחת מידע וסודיות רפואית: המידע הרפואי של התלמידים מנספח י' הוא מידע אישי מוגן ורגיש. הצג אותו אך ורק בתשובה לשאלות מפורשות של הצוות החינוכי המחובר. איסור מוחלט: לעולם אל תעביר שמות תלמידים או פרטים רפואיים אישיים כחלק משאילתות חיפוש ברשת ('search_web_and_sites_info')!
   - 🚌 אוטובוסים, שיבוצים וצוות מתוך 'טבלת השליטה' (נספח ו'): השתמש ב-'get_bus_manifest'.
     * טבלת השליטה מציגה לכל אוטובוס: כיתות משובצות, מורים מלווים (teachers), נהג וטלפון (driver), מאבטח/חובש (medicOrGuard) ומדריך (guide).
     * כאשר נשאל על מורים באוטובוס - ציין אך ורק את המורים מתוך רשימת 'teachers'! אל תכלול את הנהג, המאבטח או המדריך כמורים.
     * כאשר נשאל על הנהג או הטלפון שלו - שלוף במדויק את שדה 'driver' (שם וטלפון) מהאוטובוס המבוקש.
   - 🚫 איסור מוחלט על ניחוש או המצאת מספרי טלפון (Anti-Hallucination Policy):
     * לעולם, בשום מקרה, אל תמציא או תנחש מספר טלפון! אם מספר טלפון אינו מופיע במפורש בנתוני המערכת, ציין "המספר אינו מופיע כרגע במערכת".
     * אם המשתמש שואל על מספר טלפון או מעיר על אי-דיוק - חובה לקרוא מיד לכלי הנתונים המתאים ('get_bus_manifest', 'get_staff_and_contacts') ולמסור אך ורק את המספר הרשמי שמוחזר מהכלי.
   - כמויות תלמידים, כמה יוצאים/לא יוצאים, שמות מי שלא יוצא, חלוקת בנים/בנות: 'get_trip_overview'.
   - תחזית מזג אוויר ועומס חום: 'get_weather_and_climate' ובדיקת תקנות ב-'search_safety_regulations' (חוזר אקלים).
   - סטטוס חתימות ומוכנות נספחים: 'get_trip_documents_and_signatures'.
   - דרישות אבטחה, נשק, כמה מאבטחים נדרשים, חובשים, או הנחיות מהאישור הביטחוני: 'get_security_approval_details'.
   - מסלולים חלופיים, אתרי טבע, שעות פתיחה, התרעות: 'search_web_and_sites_info'.
   - הורים מלווים: 'get_accompanying_parents'.
   - שיבוץ חדרים: 'get_room_allocation'.
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
    name: "get_medical_restrictions",
    description: "שליפת נספח י׳ הרשמי ('מגבלות רפואיות') של הטיול: רשימת תלמידים עם בעיות בריאותיות, מחלות כרוניות, נכויות, פציעות, והכי חשוב - אלרגיות מסכנות חיים ונשאי מזרק אפיפן (🚨). כלי זה מיועד אך ורק לבטיחות וחירום רפואי.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        classFilter: {
          type: Type.STRING,
          description: "סינון אופציונלי לפי כיתה (לדוגמה 'ט׳2', 'ט׳3')",
        },
        onlyEpipen: {
          type: Type.BOOLEAN,
          description: "האם להציג רק תלמידים הנושאים מזרק אפיפן / אלרגיות מסכנות חיים",
        },
      },
    },
  },
  {
    name: "get_dietary_preferences",
    description: "שליפת העדפות מזון ותזונה של תלמידים לצורכי הסעדה, קייטרינג, מטבח והזמנת מנות (צמחוני, טבעוני, ללא גלוטן/צליאק). כלי זה נועד אך ורק להסעדה ואינו מחליף את נספח י׳ הרפואי.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        classFilter: {
          type: Type.STRING,
          description: "סינון אופציונלי לפי כיתה",
        },
        preferenceType: {
          type: Type.STRING,
          description: "סינון לפי סוג העדפה: all, vegetarian, vegan, glutenFree",
        },
      },
    },
  },
  {
    name: "get_allergies_and_medical",
    description: "שליפת כל המידע המשלים על מגבלות רפואיות (נספח י') והעדפות מזון (צמחוני, טבעוני, צליאק).",
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
    description: "שליפת שיבוצי אוטובוסים וצוות מתוך 'טבלת השליטה' (נספח ו'): כיתות בכל אוטובוס, מורים מלווים (teachers), נהג וטלפון הנהג (driver), מאבטח/חובש (medicOrGuard) ומדריכים (guide).",
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

  const prompt = `ענה בעברית בצורה תמציתית, מדויקת ומעודכנת על שאלת השטח/אתר/אכסניה/מסלול הבאה:\n${query}\nהנחיות חשובות:\n- אם השאילתה נוגעת לאתר, שמורת טבע, אכסניה, מקום לינה או ספק שירות: ציין תמיד מספרי טלפון ישירים להתקשרות (כגון 04-..., 02-..., 03-...), כתובת מלאה, מייל ושעות פעילות/קבלה.\n- אם מדובר באכסניית אנ״א עכו (HI Akko): מספר הטלפון הוא 04-9911982 (או 072-3925567), כתובת: רחוב יהודה בורלא 2 / ויצמן 2, עכו.`;

  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    if (res.text && res.text.trim().length > 0) {
      return res.text;
    }
  } catch (err) {
    console.warn("Google search grounding error, falling back to direct model knowledge:", err);
  }

  // Fallback to direct model generation (which contains comprehensive knowledge of Israeli sites & hostels)
  try {
    const fallbackRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    return fallbackRes.text || "לא נמצא מידע עדכני.";
  } catch (err) {
    console.error("Fallback search error:", err);
    return "שגיאה באיתור המידע. אנא נסה לנסח מחדש.";
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
      case "get_medical_restrictions": {
        const cls = typeof args.classFilter === "string" ? args.classFilter : undefined;
        const onlyEpipen = typeof args.onlyEpipen === "boolean" ? args.onlyEpipen : undefined;
        const data = await getMedicalRestrictions(tripId, cls, onlyEpipen);
        return JSON.stringify(data);
      }
      case "get_dietary_preferences": {
        const cls = typeof args.classFilter === "string" ? args.classFilter : undefined;
        const prefType =
          typeof args.preferenceType === "string"
            ? (args.preferenceType as "all" | "vegetarian" | "vegan" | "glutenFree")
            : undefined;
        const data = await getDietaryPreferences(tripId, cls, prefType);
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
  tripName?: string,
  history?: Array<{ role: "user" | "model"; text: string }>
): Promise<string> {
  const ai = getGeminiClient();
  if (!ai) {
    return "⚠️ שירות ה-AI טרם הוגדר: אנא הוסף את מפתח ה-API (GEMINI_API_KEY) לקובץ .env.local.";
  }

  const systemWithContext = `${SYSTEM_PROMPT}

נתוני הטיול הנוכחי שהמשתמש מחובר אליו:
- מזהה הטיול (tripId): ${tripId}
${tripName ? `- שם הטיול: ${tripName}` : ""}
זכור לשמור על רציפות השיחה עם המשתמש, להבין שאלות המשך וכינויי גוף (כגון 'שלהם', 'של המקום', 'האכסניה') לפי הודעות קודמות בשיחה.`;

  try {
    const chatHistory = (history || []).map((h) => ({
      role: h.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: h.text }],
    }));

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history: chatHistory,
      config: {
        systemInstruction: systemWithContext,
        tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      },
    });

    let response = await chat.sendMessage({
      message: userMessage,
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
