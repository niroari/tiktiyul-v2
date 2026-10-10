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

export interface BusStaffMember {
  role: string;
  name: string;
  phone: string;
}

export interface BusManifestItem {
  busNumber: number;
  classes: string[];
  driver?: { name: string; phone: string };
  medicOrGuard?: { name: string; phone: string };
  guide?: { name: string; phone: string };
  teachers: BusStaffMember[];
  allCrew: BusStaffMember[];
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

export interface MedicalRestrictionItem {
  name: string;
  class: string;
  issue: string;
  notes?: string;
  phone?: string;
  hasEpipen: boolean;
  hasCert: boolean;
}

export interface MedicalRestrictionsResult {
  totalRestrictions: number;
  epipenCarriersCount: number;
  epipenStudents: Array<{ name: string; class: string; phone?: string; details: string }>;
  otherMedicalStudents: MedicalRestrictionItem[];
}

export async function getMedicalRestrictions(
  tripId: string,
  classFilter?: string,
  onlyEpipen?: boolean
): Promise<MedicalRestrictionsResult> {
  const db = getAdminDb();

  // 1. Fetch Appendix Yod (נספח י׳ - מגבלות רפואיות)
  const yodDoc = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .doc("yod")
    .get();

  const yodRows = (yodDoc.exists ? (yodDoc.data()?.rows || []) : []) as Array<{
    id?: string;
    studentId?: string;
    firstName?: string;
    lastName?: string;
    class?: string;
    issue?: string;
    notes?: string;
    certUrl?: string;
  }>;

  // 2. Fetch Students for phone numbers & any stray medicalNotes
  const studentsSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("students")
    .get();

  const studentMap = new Map<string, Student>();
  const studentByNameMap = new Map<string, Student>();
  studentsSnap.forEach((d) => {
    const s = d.data() as Student;
    studentMap.set(d.id, s);
    const fullName = `${s.firstName || ""} ${s.lastName || ""}`.trim();
    if (fullName) studentByNameMap.set(fullName, s);
  });

  const processedIds = new Set<string>();
  const allRestrictions: MedicalRestrictionItem[] = [];

  for (const r of yodRows) {
    const s =
      (r.studentId ? studentMap.get(r.studentId) : undefined) ||
      studentByNameMap.get(`${r.firstName || ""} ${r.lastName || ""}`.trim());
    if (s?.id) processedIds.add(s.id);
    if (r.studentId) processedIds.add(r.studentId);

    const cls = r.class || s?.class || "";
    if (classFilter && cls !== classFilter) continue;

    const issueText = (r.issue || "").trim();
    const notesText = (r.notes || "").trim();
    const fullText = `${issueText} ${notesText}`;
    const hasEpipen = /אפיפן|epipen/i.test(fullText);

    if (onlyEpipen && !hasEpipen) continue;

    allRestrictions.push({
      name: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
      class: cls,
      issue: issueText,
      notes: notesText || undefined,
      phone: s?.phone,
      hasEpipen,
      hasCert: Boolean(r.certUrl && r.certUrl.trim()),
    });
  }

  // Also include students who have medicalNotes on their record but were not in Appendix Yod
  studentsSnap.forEach((d) => {
    if (processedIds.has(d.id)) return;
    const s = d.data() as Student;
    if (!s.medicalNotes || !s.medicalNotes.trim()) return;
    if (classFilter && s.class !== classFilter) return;

    const fullText = s.medicalNotes.trim();
    const hasEpipen = /אפיפן|epipen/i.test(fullText);
    if (onlyEpipen && !hasEpipen) return;

    allRestrictions.push({
      name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      class: s.class || "",
      issue: fullText,
      phone: s.phone,
      hasEpipen,
      hasCert: false,
    });
  });

  const epipenStudents = allRestrictions
    .filter((m) => m.hasEpipen)
    .map((m) => ({
      name: m.name,
      class: m.class,
      phone: m.phone,
      details: [m.issue, m.notes].filter(Boolean).join(" - "),
    }));

  const otherMedicalStudents = allRestrictions.filter((m) => !m.hasEpipen);

  return {
    totalRestrictions: allRestrictions.length,
    epipenCarriersCount: epipenStudents.length,
    epipenStudents,
    otherMedicalStudents,
  };
}

export interface DietaryPreferenceItem {
  name: string;
  class: string;
  phone?: string;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  preferenceSummary: string;
}

export interface DietaryPreferencesResult {
  totalWithDietary: number;
  totalVegetarian: number;
  totalVegan: number;
  totalGlutenFree: number;
  students: DietaryPreferenceItem[];
}

export async function getDietaryPreferences(
  tripId: string,
  classFilter?: string,
  preferenceType?: "all" | "vegetarian" | "vegan" | "glutenFree"
): Promise<DietaryPreferencesResult> {
  const db = getAdminDb();
  const studentsSnap = await db
    .collection("trips")
    .doc(tripId)
    .collection("students")
    .get();

  let totalVegetarian = 0;
  let totalVegan = 0;
  let totalGlutenFree = 0;
  const students: DietaryPreferenceItem[] = [];

  studentsSnap.forEach((d) => {
    const s = d.data() as Student;
    if (classFilter && s.class !== classFilter) return;

    const isVeg = Boolean(s.dietaryFlags?.vegetarian);
    const isVegan = Boolean(s.dietaryFlags?.vegan);
    const isGlutenFree = Boolean(s.dietaryFlags?.glutenFree);

    if (isVeg) totalVegetarian++;
    if (isVegan) totalVegan++;
    if (isGlutenFree) totalGlutenFree++;

    if (!isVeg && !isVegan && !isGlutenFree) return;

    if (preferenceType === "vegetarian" && !isVeg) return;
    if (preferenceType === "vegan" && !isVegan) return;
    if (preferenceType === "glutenFree" && !isGlutenFree) return;

    const labels: string[] = [];
    if (isVeg) labels.push("צמחוני 🥗");
    if (isVegan) labels.push("טבעוני 🌱");
    if (isGlutenFree) labels.push("ללא גלוטן (צליאק) 🌾");

    students.push({
      name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
      class: s.class || "",
      phone: s.phone,
      vegetarian: isVeg,
      vegan: isVegan,
      glutenFree: isGlutenFree,
      preferenceSummary: labels.join(", "),
    });
  });

  return {
    totalWithDietary: students.length,
    totalVegetarian,
    totalVegan,
    totalGlutenFree,
    students,
  };
}

export async function getAllergiesAndMedical(
  tripId: string,
  classFilter?: string
): Promise<{
  medicalRestrictions: MedicalRestrictionsResult;
  dietaryPreferences: DietaryPreferencesResult;
}> {
  const [medical, dietary] = await Promise.all([
    getMedicalRestrictions(tripId, classFilter),
    getDietaryPreferences(tripId, classFilter),
  ]);

  return {
    medicalRestrictions: medical,
    dietaryPreferences: dietary,
  };
}

interface RawBus {
  id: string;
  classSelections?: string[];
  crew?: Array<{ name: string; phone: string }>;
  extraTeachers?: Array<{ role: string; name: string; phone: string }>;
}

const CREW_ROLES = ["מורה אחראי/ת", "מורה נוסף", "נהג", "מאבטח/חובש", "מדריך"];

function parseBusManifestItem(b: RawBus, busNumber: number): BusManifestItem {
  let driver: { name: string; phone: string } | undefined = undefined;
  let medicOrGuard: { name: string; phone: string } | undefined = undefined;
  let guide: { name: string; phone: string } | undefined = undefined;
  const teachers: BusStaffMember[] = [];
  const allCrew: BusStaffMember[] = [];

  (b.crew || []).forEach((c, idx) => {
    const role = CREW_ROLES[idx] || "מלווה";
    const name = (c.name || "").trim();
    const phone = (c.phone || "").trim();
    if (!name && !phone) return;

    allCrew.push({ role, name, phone });

    if (role === "נהג") {
      driver = { name, phone };
    } else if (role === "מאבטח/חובש") {
      medicOrGuard = { name, phone };
    } else if (role === "מדריך") {
      guide = { name, phone };
    } else {
      teachers.push({ role, name, phone });
    }
  });

  (b.extraTeachers || []).forEach((t) => {
    const name = (t.name || "").trim();
    const phone = (t.phone || "").trim();
    const role = (t.role || "מורה").trim();
    if (name || phone) {
      teachers.push({ role, name, phone });
      allCrew.push({ role, name, phone });
    }
  });

  return {
    busNumber,
    classes: (b.classSelections || []).filter(Boolean),
    driver,
    medicOrGuard,
    guide,
    teachers,
    allCrew,
  };
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

  if (!vavDoc.exists) return { message: "לא הוזנו עדיין נתוני אוטובוסים בטבלת השליטה (נספח ו׳)" };

  const vavData = vavDoc.data() as { days?: Array<{ buses?: RawBus[] }> };
  const days = vavData?.days || [];
  if (days.length === 0) return { message: "אין ימים מוגדרים בטבלת השליטה" };

  const currentDay = days[0];
  const buses: RawBus[] = currentDay.buses || [];

  if (busNumberQuery !== undefined && busNumberQuery !== "") {
    const targetIdx =
      typeof busNumberQuery === "number"
        ? busNumberQuery - 1
        : parseInt(busNumberQuery.toString(), 10) - 1;

    const b = buses[targetIdx];
    if (!b) return { message: `לא נמצא אוטובוס מספר ${busNumberQuery} בטבלת השליטה` };

    return parseBusManifestItem(b, targetIdx + 1);
  }

  return buses.map((b, idx) => parseBusManifestItem(b, idx + 1));
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

export async function getSecurityApprovalDetails(
  tripId: string,
  userQuestion?: string
): Promise<{
  hasFile: boolean;
  fileName?: string;
  analysis?: string;
  message?: string;
}> {
  const db = getAdminDb();
  let secDoc = await db
    .collection("trips")
    .doc(tripId)
    .collection("appendices")
    .doc("security")
    .get();

  // Case-insensitive fallback for tripId if needed
  if (!secDoc.exists) {
    const tripSnap = await db.collection("trips").get();
    for (const d of tripSnap.docs) {
      if (d.id.toLowerCase() === tripId.toLowerCase()) {
        secDoc = await db
          .collection("trips")
          .doc(d.id)
          .collection("appendices")
          .doc("security")
          .get();
        if (secDoc.exists) break;
      }
    }
  }

  if (!secDoc.exists) {
    return {
      hasFile: false,
      message: "טרם הועלה אישור ביטחוני בלשונית 'אישור ביטחוני' באתר עבור טיול זה.",
    };
  }

  const data = secDoc.data() as { fileUrl?: string; fileName?: string };
  if (!data?.fileUrl) {
    return {
      hasFile: false,
      message: "האישור הביטחוני עדיין ריק או שלא צורף קישור תקין לקובץ.",
    };
  }

  try {
    const res = await fetch(data.fileUrl);
    if (!res.ok) throw new Error("Failed to download PDF from storage");
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const { GoogleGenAI } = await import("@google/genai");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

    const ai = new GoogleGenAI({ apiKey });
    const prompt = userQuestion
      ? `עיין באישור הביטחוני המצורף של הטיול וענה בעברית במדויק ובתמציתיות לשאלה הבאה:\n${userQuestion}`
      : `חלץ מתוך האישור הביטחוני של הטיול את הנתונים הבאים:\n1. מספר אישור הטיול\n2. כמות מאבטחים/ליווי בנשק נדרשת ביום ובלינה\n3. הגבלות והנחיות מיוחדות לגבי מסלולים, לינה, חובשים ופיקוד העורף.`;

    const geminiRes = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64,
          },
        },
        prompt,
      ],
    });

    return {
      hasFile: true,
      fileName: data.fileName || "אישור ביטחוני.pdf",
      analysis: geminiRes.text || "לא התקבל פיענוח מתוך המסמך.",
    };
  } catch (err) {
    console.error("Error analyzing security PDF:", err);
    return {
      hasFile: true,
      fileName: data.fileName,
      message: "הקובץ קיים במערכת, אך חלה שגיאה בקריאת תוכן ה-PDF.",
    };
  }
}

