import { Timestamp } from "firebase/firestore";

// ─── Trip ───────────────────────────────────────────────────────────────────

export type TripClass = {
  name: string;       // e.g. "ט׳1"
  studentCount: number;
};

export type Trip = {
  id: string;
  name: string;
  schoolName: string;
  startDate: string;  // ISO date string "YYYY-MM-DD"
  endDate: string;
  classes: TripClass[];
  accommodation: string;
  transport: string;
  ownerUid: string;
  collaborators: string[];  // uids
  inviteToken?: string;
  createdAt: string;
  updatedAt: string;
};

// ─── Student ─────────────────────────────────────────────────────────────────

export type Gender = "male" | "female";

export type Student = {
  id: string;
  firstName: string;
  lastName: string;
  class: string;
  gender: Gender;
  phone?: string;
  isGoing: boolean;
  dietaryFlags: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
  };
  medicalNotes?: string;
};

// ─── Staff ───────────────────────────────────────────────────────────────────

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  phone: string;
  gender?: Gender;
};

// ─── Parent ───────────────────────────────────────────────────────────────────

export type Parent = {
  id: string;
  name: string;
  phone: string;
  gender?: Gender;
  childName: string;   // student they are accompanying
  childClass: string;  // that student's class
};

// ─── Class token (teacher edit link) ─────────────────────────────────────────

export type ClassToken = {
  token: string;       // doc ID = UUID token
  tripId: string;
  class: string;       // e.g. "ז׳1"
  tripName: string;
  schoolName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
};

// ─── Pending update (teacher-proposed student change) ─────────────────────────

export type PendingUpdate = {
  id: string;
  tripId: string;
  token: string;       // which classToken was used
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  studentClass: string;
  proposedIsGoing: boolean;
  proposedDietaryFlags: { vegetarian: boolean; vegan: boolean; glutenFree: boolean };
  proposedMedicalNotes: string;
  submittedAt: Timestamp;
  status: "pending" | "approved" | "rejected";
};

// ─── Appendix status ─────────────────────────────────────────────────────────

export type AppendixStatus = "empty" | "in_progress" | "done";

export type TripProgress = {
  [key: string]: AppendixStatus;
};
