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

  studentsSnap.forEach((doc) => {
    const s = doc.data() as Student;
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
