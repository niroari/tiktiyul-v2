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
};

// ─── Appendix status ─────────────────────────────────────────────────────────

export type AppendixStatus = "empty" | "in_progress" | "done";

export type TripProgress = {
  [key: string]: AppendixStatus;
};
