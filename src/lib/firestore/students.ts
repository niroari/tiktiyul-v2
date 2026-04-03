import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Student } from "@/lib/types";

function studentsCol(tripId: string) {
  return collection(db, "trips", tripId, "students");
}

function studentDoc(tripId: string, studentId: string) {
  return doc(db, "trips", tripId, "students", studentId);
}

export async function addStudent(
  tripId: string,
  student: Omit<Student, "id">
): Promise<string> {
  const ref = doc(studentsCol(tripId));
  await setDoc(ref, { ...student, createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateStudent(
  tripId: string,
  studentId: string,
  data: Partial<Omit<Student, "id">>
): Promise<void> {
  await updateDoc(studentDoc(tripId, studentId), data);
}

export async function deleteStudent(
  tripId: string,
  studentId: string
): Promise<void> {
  await deleteDoc(studentDoc(tripId, studentId));
}

export async function getStudents(tripId: string): Promise<Student[]> {
  const snap = await getDocs(studentsCol(tripId));
  const students = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
  students.sort((a, b) => a.class.localeCompare(b.class) || a.lastName.localeCompare(b.lastName));
  return students;
}

export function subscribeToStudents(
  tripId: string,
  callback: (students: Student[]) => void
): Unsubscribe {
  return onSnapshot(studentsCol(tripId), (snap) => {
    const students = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
    students.sort((a, b) => a.class.localeCompare(b.class) || a.lastName.localeCompare(b.lastName));
    callback(students);
  });
}
