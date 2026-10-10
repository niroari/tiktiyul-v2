import { getAdminDb } from "./firebase-admin";
import type { Student, StaffMember, Trip } from "@/lib/types";

export interface TripOverviewData {
  id: string;
  name: string;
  schoolName: string;
  startDate: string;
  endDate: string;
  accommodation: string;
  transport: string;
  classes: Array<{ name: string; studentCount: number }>;
  totalStudents: number;
  confirmedGoing: number;
  notGoingCount: number;
  notGoingStudents: Array<{ name: string; class: string; phone?: string }>;
  genderBreakdown: {
    totalBoys: number;
    goingBoys: number;
    notGoingBoys: number;
    totalGirls: number;
    goingGirls: number;
    notGoingGirls: number;
  };
  classBreakdown: Array<{
    class: string;
    total: number;
    going: number;
    notGoing: number;
    boysGoing: number;
    girlsGoing: number;
  }>;
}

export interface BusManifestItem {
  busNumber: number;
  classes: string[];
  crew: Array<{ name: string; phone: string }>;
  extraTeachers?: Array<{ role: string; name: string; phone: string }>;
}

export interface RoomAllocationItem {
  number: string;
  gender: string;
  capacity: number;
  students: Array<{ name: string; class: string }>;
}

export interface StaffAndContactsResult {
  staff: Array<{ name: string; role: string; phone: string }>;
  emergencyContacts: Array<{ role: string; name: string; phone: string }>;
}

export async function getTripOverview(
  tripId: string
): Promise<TripOverviewData | null> {
  const db = getAdminDb();
  const tripDoc = await db.collection("trips").doc(tripId).get();
  if (!tripDoc.exists) return null;

  const data = tripDoc.data() as Trip;
  const studentsSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("students")
    .get();

  const totalStudents = studentsSnap.size;
  let confirmedGoing = 0;
  const notGoingStudents: Array<{ name: string; class: string; phone?: string }> = [];

  let totalBoys = 0;
  let goingBoys = 0;
  let notGoingBoys = 0;
  let totalGirls = 0;
  let goingGirls = 0;
  let notGoingGirls = 0;

  const classMap = new Map<
    string,
    { total: number; going: number; notGoing: number; boysGoing: number; girlsGoing: number }
  >();

  studentsSnap.forEach((doc) => {
    const s = doc.data() as Student;
    const isFemale = s.gender === "female";
    const cls = s.class || "לא משובץ";

    if (!classMap.has(cls)) {
      classMap.set(cls, { total: 0, going: 0, notGoing: 0, boysGoing: 0, girlsGoing: 0 });
    }
    const clsStats = classMap.get(cls)!;
    clsStats.total++;

    if (isFemale) {
      totalGirls++;
      if (s.isGoing) {
        goingGirls++;
        clsStats.going++;
        clsStats.girlsGoing++;
      } else {
        notGoingGirls++;
        clsStats.notGoing++;
      }
    } else {
      totalBoys++;
      if (s.isGoing) {
        goingBoys++;
        clsStats.going++;
        clsStats.boysGoing++;
      } else {
        notGoingBoys++;
        clsStats.notGoing++;
      }
    }

    if (s.isGoing) {
      confirmedGoing++;
    } else {
      const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim();
      notGoingStudents.push({
        name: fullName,
        class: s.class || "",
        phone: s.phone,
      });
    }
  });

  const classBreakdown = Array.from(classMap.entries()).map(([name, stats]) => ({
    class: name,
    ...stats,
  }));

  return {
    id: tripDoc.id,
    name: data.name || "",
    schoolName: data.schoolName || "",
    startDate: data.startDate || "",
    endDate: data.endDate || "",
    accommodation: data.accommodation || "",
    transport: data.transport || "",
    classes: data.classes || [],
    totalStudents,
    confirmedGoing,
    notGoingCount: notGoingStudents.length,
    notGoingStudents,
    genderBreakdown: {
      totalBoys,
      goingBoys,
      notGoingBoys,
      totalGirls,
      goingGirls,
      notGoingGirls,
    },
    classBreakdown,
  };
}

export async function searchStudents(
  tripId: string,
  query?: string,
  classFilter?: string,
  onlyNotGoing?: boolean
): Promise<
  Array<{
    name: string;
    class: string;
    gender: string;
    phone?: string;
    isGoing: boolean;
    allergies: string[];
    medicalNotes?: string;
    notes?: string;
  }>
> {
  const db = getAdminDb();
  const studentsSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("students")
    .get();

  const results: Array<{
    name: string;
    class: string;
    gender: string;
    phone?: string;
    isGoing: boolean;
    allergies: string[];
    medicalNotes?: string;
    notes?: string;
  }> = [];

  const q = query ? query.toLowerCase().trim() : "";
  const cls = classFilter ? classFilter.trim() : "";

  studentsSnap.forEach((doc) => {
    const s = doc.data() as Student;
    const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim();
    if (cls && s.class !== cls) return;
    if (onlyNotGoing && s.isGoing) return;

    if (q) {
      const match =
        fullName.toLowerCase().includes(q) ||
        (s.class && s.class.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q));
      if (!match) return;
    }

    const allergies: string[] = [];
    if (s.dietaryFlags?.vegetarian) allergies.push("צמחוני");
    if (s.dietaryFlags?.vegan) allergies.push("טבעוני");
    if (s.dietaryFlags?.glutenFree) allergies.push("ללא גלוטן (צליאק)");

    results.push({
      name: fullName,
      class: s.class || "",
      gender: s.gender === "female" ? "נקבה" : "זכר",
      phone: s.phone,
      isGoing: s.isGoing,
      allergies,
      medicalNotes: s.medicalNotes,
      notes: s.notes,
    });
  });

  return results.slice(0, 20); // Cap for WhatsApp brevity
}

export async function getAllergiesAndMedical(
  tripId: string,
  classFilter?: string
): Promise<
  Array<{
    name: string;
    class: string;
    allergies: string[];
    medicalNotes?: string;
    phone?: string;
  }>
> {
  const db = getAdminDb();
  const studentsSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("students")
    .get();

  const results: Array<{
    name: string;
    class: string;
    allergies: string[];
    medicalNotes?: string;
    phone?: string;
  }> = [];

  studentsSnap.forEach((doc) => {
    const s = doc.data() as Student;
    if (classFilter && s.class !== classFilter) return;

    const allergies: string[] = [];
    if (s.dietaryFlags?.vegetarian) allergies.push("צמחוני");
    if (s.dietaryFlags?.vegan) allergies.push("טבעוני");
    if (s.dietaryFlags?.glutenFree) allergies.push("ללא גלוטן (צליאק)");

    const hasDietary = allergies.length > 0;
    const hasMedical = Boolean(s.medicalNotes && s.medicalNotes.trim());

    if (hasDietary || hasMedical) {
      results.push({
        name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        class: s.class || "",
        allergies,
        medicalNotes: s.medicalNotes,
        phone: s.phone,
      });
    }
  });

  return results;
}

interface RawBus {
  id: string;
  classSelections?: string[];
  crew?: Array<{ name: string; phone: string }>;
  extraTeachers?: Array<{ role: string; name: string; phone: string }>;
}

export async function getBusManifest(
  tripId: string,
  busNumberQuery?: number | string
): Promise<BusManifestItem | BusManifestItem[] | { message: string }> {
  const db = getAdminDb();
  const vavDoc = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .doc("vav")
    .get();

  if (!vavDoc.exists) return { message: "לא הוזנו עדיין נתוני אוטובוסים (נספח ו׳)" };

  const vavData = vavDoc.data() as { days?: Array<{ buses?: RawBus[] }> };
  const days = vavData?.days || [];
  if (days.length === 0) return { message: "אין ימים מוגדרים בטבלת אוטובוסים" };

  const currentDay = days[0];
  const buses: RawBus[] = currentDay.buses || [];

  if (busNumberQuery !== undefined && busNumberQuery !== "") {
    const targetIdx =
      typeof busNumberQuery === "number"
        ? busNumberQuery - 1
        : parseInt(busNumberQuery.toString(), 10) - 1;

    const b = buses[targetIdx];
    if (!b) return { message: `לא נמצא אוטובוס מספר ${busNumberQuery}` };

    return {
      busNumber: targetIdx + 1,
      classes: b.classSelections?.filter(Boolean) || [],
      crew: b.crew?.filter((c) => c.name || c.phone) || [],
      extraTeachers: b.extraTeachers || [],
    };
  }

  return buses.map((b, idx) => ({
    busNumber: idx + 1,
    classes: b.classSelections?.filter(Boolean) || [],
    crew: b.crew?.filter((c) => c.name || c.phone) || [],
  }));
}

interface RawRoom {
  id: string;
  number: string;
  gender: "male" | "female";
  studentIds: string[];
  capacity?: number;
}

export async function getRoomAllocation(
  tripId: string,
  query?: string
): Promise<unknown> {
  const db = getAdminDb();
  const roomsDoc = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .doc("rooms")
    .get();

  if (!roomsDoc.exists) return { message: "לא הוזנו עדיין חלוקת חדרים" };

  const roomsData = roomsDoc.data() as { rooms?: RawRoom[] };
  const rooms = roomsData?.rooms || [];

  const studentsSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("students")
    .get();

  const studentMap = new Map<string, { name: string; class: string }>();
  studentsSnap.forEach((doc) => {
    const s = doc.data() as Student;
    studentMap.set(doc.id, {
      name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      class: s.class || "",
    });
  });

  const enrichedRooms: RoomAllocationItem[] = rooms.map((r) => {
    const assignedStudents: Array<{ name: string; class: string }> = [];
    (r.studentIds || []).forEach((id) => {
      const found = studentMap.get(id);
      if (found) assignedStudents.push(found);
    });

    return {
      number: r.number || "ללא מספר",
      gender: r.gender === "female" ? "בנות" : "בנים",
      capacity: r.capacity || r.studentIds?.length || 0,
      students: assignedStudents,
    };
  });

  if (query) {
    const q = query.trim().toLowerCase();
    const byRoom = enrichedRooms.find((r) => r.number.toLowerCase() === q);
    if (byRoom) return byRoom;

    const foundRooms: Array<{
      matchedStudent: string;
      class: string;
      roomNumber: string;
      gender: string;
      roommates: string[];
    }> = [];

    for (const r of enrichedRooms) {
      const match = r.students.find((s) => s.name.toLowerCase().includes(q));
      if (match) {
        foundRooms.push({
          matchedStudent: match.name,
          class: match.class,
          roomNumber: r.number,
          gender: r.gender,
          roommates: r.students
            .filter((s) => s.name !== match.name)
            .map((s) => s.name),
        });
      }
    }
    if (foundRooms.length > 0) return foundRooms;
    return { message: `לא נמצא שיבוץ חדר עבור "${query}"` };
  }

  return { totalRooms: enrichedRooms.length, rooms: enrichedRooms.slice(0, 10) };
}

export async function getStaffAndContacts(
  tripId: string
): Promise<StaffAndContactsResult> {
  const db = getAdminDb();

  const staffSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("staff")
    .get();

  const staff: Array<{ name: string; role: string; phone: string }> = [];
  staffSnap.forEach((doc) => {
    const s = doc.data() as StaffMember;
    staff.push({ name: s.name, role: s.role, phone: s.phone });
  });

  const heyDoc = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .doc("hey")
    .get();

  let emergencyContacts: Array<{ role: string; name: string; phone: string }> = [];
  if (heyDoc.exists) {
    const data = heyDoc.data() as {
      rows?: Array<{ role: string; name?: string; phone?: string }>;
    };
    if (data?.rows && Array.isArray(data.rows)) {
      emergencyContacts = data.rows
        .filter((r) => r.phone || r.name)
        .map((r) => ({
          role: r.role,
          name: r.name || "",
          phone: r.phone || "",
        }));
    }
  }

  return { staff, emergencyContacts };
}

export async function getItinerary(tripId: string): Promise<unknown> {
  const db = getAdminDb();
  const daletDoc = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .doc("dalet")
    .get();

  if (!daletDoc.exists) return { message: "לא הוזן עדיין לוח זמנים (נספח ד׳)" };
  const data = daletDoc.data() as { rows?: unknown[] };
  return data?.rows || [];
}

export interface SignatureStatusItem {
  role: string;
  roleName: string;
  leaderName: string;
  status: "signed" | "pending";
  signedAt?: string;
}

export async function getTripDocumentsAndSignatures(tripId: string): Promise<{
  isFullySigned: boolean;
  totalSignatures: number;
  signedCount: number;
  pendingCount: number;
  signatures: SignatureStatusItem[];
  appendicesStatus: Array<{ id: string; name: string; isFilled: boolean }>;
}> {
  const db = getAdminDb();

  // 1. Fetch signatures for this trip
  const sigSnap = await db
    .collection("signatures")
    .where("tripId", "==", tripId)
    .get();

  const signatures: SignatureStatusItem[] = [];
  let signedCount = 0;
  let pendingCount = 0;

  sigSnap.forEach((doc) => {
    const data = doc.data() as {
      role: string;
      roleName?: string;
      leaderName?: string;
      status?: "signed" | "pending";
      signedAt?: { toDate: () => Date };
    };
    const isSigned = data.status === "signed";
    if (isSigned) signedCount++;
    else pendingCount++;

    signatures.push({
      role: data.role || "",
      roleName: data.roleName || data.role || "מסמך",
      leaderName: data.leaderName || "",
      status: isSigned ? "signed" : "pending",
      signedAt: data.signedAt ? data.signedAt.toDate().toLocaleString("he-IL") : undefined,
    });
  });

  // 2. Fetch appendices saved status
  const appSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .get();

  const filledAppIds = new Set<string>();
  appSnap.forEach((doc) => filledAppIds.add(doc.id));

  const standardAppendices = [
    { id: "alef", name: "נספח א׳ - בדיקה לפני יציאה" },
    { id: "bet", name: "נספח ב׳ - אישור מנהל ורכז" },
    { id: "gimel", name: "נספח ג׳ - כתב מינוי" },
    { id: "dalet", name: "נספח ד׳ - לוח זמנים (לו״ז)" },
    { id: "hey", name: "נספח ה׳ - טלפונים חיוניים" },
    { id: "vav", name: "נספח ו׳ - שיבוץ אוטובוסים" },
    { id: "zayin", name: "נספח ז׳ - רשימת תלמידים" },
    { id: "chet", name: "נספח ח׳ - אישורי הורים" },
    { id: "tet", name: "נספח ט׳ - ציוד חובה" },
    { id: "yod", name: "נספח י׳ - מגבלות רפואיות" },
    { id: "rooms", name: "שיבוץ חדרים" },
    { id: "bus-check", name: "בדיקת תקינות אוטובוס" },
  ];

  const appendicesStatus = standardAppendices.map((app) => ({
    id: app.id,
    name: app.name,
    isFilled: filledAppIds.has(app.id),
  }));

  const isFullySigned = signatures.length > 0 && pendingCount === 0;

  return {
    isFullySigned,
    totalSignatures: signatures.length,
    signedCount,
    pendingCount,
    signatures,
    appendicesStatus,
  };
}

export async function getAccompanyingParents(tripId: string): Promise<
  Array<{
    name: string;
    phone: string;
    childName: string;
    childClass: string;
    gender?: string;
  }>
> {
  const db = getAdminDb();
  const snap = await db
    .collection("trips")
    .doc(tripId)
    .collection("parents")
    .get();

  const parents: Array<{
    name: string;
    phone: string;
    childName: string;
    childClass: string;
    gender?: string;
  }> = [];

  snap.forEach((doc) => {
    const data = doc.data();
    parents.push({
      name: data.name || "",
      phone: data.phone || "",
      childName: data.childName || "",
      childClass: data.childClass || "",
      gender: data.gender === "female" ? "נקבה" : "זכר",
    });
  });

  return parents;
}

export async function getWeatherAndClimate(
  tripId: string,
  customLocation?: string
): Promise<{
  destination: string;
  startDate: string;
  endDate: string;
  current?: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    description: string;
  };
  forecast?: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    morningTemp?: number;
    rainProbability: number;
    heatStressLevel: string;
  }>;
  safetyGuidelines: string;
}> {
  const db = getAdminDb();
  const tripDoc = await db.collection("trips").doc(tripId).get();
  const trip = tripDoc.exists ? (tripDoc.data() as Trip) : null;

  const rawDest =
    customLocation ||
    trip?.accommodation ||
    trip?.schoolName ||
    "עכו";

  // Coordinates lookup for major Israeli trip locations
  const knownCoords: Record<string, { lat: number; lon: number; name: string }> = {
    "עכו": { lat: 32.92, lon: 35.08, name: "עכו" },
    "אנא": { lat: 32.92, lon: 35.08, name: "אכסניית עכו" },
    "אנ״א": { lat: 32.92, lon: 35.08, name: "אכסניית עכו" },
    "חיפה": { lat: 32.79, lon: 34.98, name: "חיפה" },
    "ירושלים": { lat: 31.77, lon: 35.21, name: "ירושלים" },
    "תל אביב": { lat: 32.08, lon: 34.78, name: "תל אביב" },
    "הרצליה": { lat: 32.16, lon: 34.84, name: "הרצליה" },
    "ים המלח": { lat: 31.46, lon: 35.39, name: "ים המלח" },
    "עין גדי": { lat: 31.46, lon: 35.39, name: "עין גדי" },
    "מצדה": { lat: 31.31, lon: 35.35, name: "מצדה" },
    "אילת": { lat: 29.55, lon: 34.95, name: "אילת" },
    "טבריה": { lat: 32.79, lon: 35.53, name: "טבריה" },
    "כנרת": { lat: 32.79, lon: 35.53, name: "הכנרת" },
    "גליל": { lat: 32.96, lon: 35.49, name: "הגליל" },
    "צפת": { lat: 32.96, lon: 35.49, name: "צפת" },
    "גולן": { lat: 32.99, lon: 35.69, name: "רמת הגולן" },
    "חרמון": { lat: 33.31, lon: 35.78, name: "החרמון" },
    "נגב": { lat: 30.61, lon: 34.80, name: "הנגב" },
    "מצפה רמון": { lat: 30.61, lon: 34.80, name: "מצפה רמון" },
  };

  let lat = 32.92;
  let lon = 35.08;
  let resolvedName = "עכו / גליל מערבי";

  for (const [key, val] of Object.entries(knownCoords)) {
    if (rawDest.includes(key)) {
      lat = val.lat;
      lon = val.lon;
      resolvedName = val.name;
      break;
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max&hourly=temperature_2m,relative_humidity_2m,apparent_temperature&timezone=Asia%2FJerusalem`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather fetch failed");

    const data = await res.json();
    const current = {
      temperature: data.current?.temperature_2m || 0,
      apparentTemperature: data.current?.apparent_temperature || 0,
      humidity: data.current?.relative_humidity_2m || 0,
      description: getWeatherDesc(data.current?.weather_code),
    };

    const forecast = (data.daily?.time || []).slice(0, 5).map((d: string, idx: number) => {
      const maxT = data.daily?.temperature_2m_max?.[idx] || 0;
      const minT = data.daily?.temperature_2m_min?.[idx] || 0;
      const appMax = data.daily?.apparent_temperature_max?.[idx] || maxT;
      const rain = data.daily?.precipitation_probability_max?.[idx] || 0;

      // Find morning temp (09:00)
      const morningIndex = (data.hourly?.time || []).findIndex((t: string) => t === `${d}T09:00`);
      const morningTemp = morningIndex !== -1 ? data.hourly?.temperature_2m?.[morningIndex] : undefined;

      let heatStress = "ללא עומס חום (תנאים נוחים לפעילות שטח)";
      if (appMax >= 28) {
        heatStress = "עומס חום כבד ומסוכן (אסורה פעילות מאומצת וחשופה בשעות הצהריים!)";
      } else if (appMax >= 24) {
        heatStress = "עומס חום בינוני (מסלולים מוצלים בלבד, חובת הפסקות מרובות בצל)";
      } else if (appMax >= 22) {
        heatStress = "עומס חום קל (פעילות מותרת, חובת כובע ושתייה מרובה)";
      }

      return {
        date: d,
        maxTemp: maxT,
        minTemp: minT,
        morningTemp,
        rainProbability: rain,
        heatStressLevel: heatStress,
      };
    });

    return {
      destination: resolvedName,
      startDate: trip?.startDate || "",
      endDate: trip?.endDate || "",
      current,
      forecast,
      safetyGuidelines:
        "הנחיות חוזר מנכ״ל עומס חום: חובה לפתוח כל בוקר טיול בבדיקת מים (לפחות 3 ליטר מים לתלמיד ליום רגיל, 4.5 ליטר ביום חם), כובע חובה. במידה ונמדד עומס חום כבד, חל איסור כניסה למסלולי הליכה בין השעות 10:00 ל-16:00.",
    };
  } catch (err) {
    console.warn("Live weather fetch failed, returning fallback:", err);
    return {
      destination: resolvedName,
      startDate: trip?.startDate || "",
      endDate: trip?.endDate || "",
      safetyGuidelines:
        "הנחיות חוזר מנכ״ל עומס חום: חובה להצטייד ב-3 ליטר מים לתלמיד וכובע. בעומס חום כבד יש להימנע ממסלולים חשופים בין 10:00 ל-16:00.",
    };
  }
}

function getWeatherDesc(code?: number): string {
  if (code === undefined || code === null) return "רגיל לעונה";
  if (code === 0) return "בהיר";
  if (code === 1 || code === 2) return "בהיר עד מעונן חלקית";
  if (code === 3) return "מעונן";
  if (code === 45 || code === 48) return "ערפילי";
  if (code >= 51 && code <= 67) return "גשם קל עד בינוני";
  if (code >= 71 && code <= 77) return "שלג";
  if (code >= 80 && code <= 82) return "ממטרים";
  if (code >= 95) return "סופת רעמים";
  return "רגיל לעונה";
}

