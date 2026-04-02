# Tik Tiyul V2

A full rebuild of the Tik Tiyul school trip folder management app, using a modern stack.

## Live URLs
- **Production:** https://tiktiyul-v2.vercel.app
- **GitHub:** https://github.com/niroari/tiktiyul-v2
- **Original app (v1):** https://tiktiyul.vercel.app

## Stack
- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Backend:** Firebase Auth + Firestore
- **Font:** Rubik (Hebrew subset)
- **Deployment:** Vercel (auto-deploy from main branch)

## Firebase
- **Project:** tik-tiyul
- **Console:** https://console.firebase.google.com/project/tik-tiyul
- **Firestore collection:** `trips/{tripId}` (top-level, separate from v1 which used `users/{uid}/trips`)
- **Rules:** Currently open (`allow read, write: if true`) — lock down when auth is added

## Firestore Structure
```
trips/{tripId}
  ├── name, schoolName, startDate, endDate
  ├── classes[], accommodation, transport
  ├── ownerUid, collaborators[]
  ├── students/{studentId}
  │   └── firstName, lastName, class, gender, phone, isGoing, dietaryFlags
  ├── staff/{staffId}
  │   └── name, role, phone
  └── appendices/{appendixId}
      └── items, savedAt
```

## Project Structure
```
src/
├── app/
│   ├── trips/
│   │   ├── page.tsx                    # Trip list (real-time Firestore)
│   │   └── [tripId]/
│   │       ├── layout.tsx              # Loads trip, wraps in TripShell
│   │       ├── dashboard/              # Stats, appendix grid, alerts
│   │       ├── settings/               # Trip metadata form
│   │       ├── students/               # Student list + Excel import
│   │       ├── staff/                  # Staff roster
│   │       └── appendix/
│   │           └── alef/               # Appendix א — pre-trip checklist
├── components/
│   ├── trip-shell.tsx                  # Layout shell (topbar + sidebar)
│   ├── excel-import.tsx                # SheetJS Excel importer
│   └── ui/                             # shadcn components
├── hooks/
│   ├── use-trip.ts                     # Real-time trip listener
│   ├── use-students.ts                 # Real-time students listener
│   └── use-staff.ts                    # Real-time staff listener
└── lib/
    ├── firebase.ts                     # Firebase app init
    ├── types.ts                        # Trip, Student, StaffMember types
    ├── nav.ts                          # Sidebar nav config
    └── firestore/
        ├── trips.ts                    # Trip CRUD + subscriptions
        ├── students.ts                 # Student CRUD + subscriptions
        ├── staff.ts                    # Staff CRUD + subscriptions
        └── appendix.ts                 # Generic appendix save/subscribe
```

## Build Plan Progress
### Phase 1 — Foundation ✅
- Next.js + Tailwind + shadcn/ui scaffold
- Rubik font (Hebrew), RTL root layout
- Firebase connected, design tokens in globals.css

### Phase 2 — Trip Shell ✅
- Trip list page with real-time Firestore + new trip dialog
- Trip shell layout: topbar + RTL sidebar with all 19 sections
- Trip metadata form (name, school, dates, classes, logistics)
- useTrip real-time hook

### Phase 3 — Students & Staff ✅
- Student list: table, add/edit/delete, going toggle, gender badge
- Excel import: auto-detects old/new Ministry of Education format, preview before import
- Staff roster: list with role autocomplete, add/edit/delete
- Dashboard: stat cards, appendix grid, food prefs, alerts, class breakdown

### Phase 4 — Appendices 🔄
- [x] א — Pre-trip checklist (5 categories, 35 items, auto-save)
- [ ] ב — Schedule + manager/coordinator approvals
- [ ] ג — Trip leader appointment letter
- [ ] ד — Itinerary timeline
- [ ] ה — Essential contacts + bus crew
- [ ] ו — Bus control table
- [ ] ז — Student list (appendix version)
- [ ] ח — Parental permission upload
- [ ] ט — Equipment checklist
- [ ] י — Medical restrictions

### Phase 5 — Advanced Features
- [ ] Canvas signatures + remote signing
- [ ] PDF export per appendix
- [ ] Masa form (2-page trip notification)
- [ ] Room assignment (drag-and-drop)
- [ ] Bus signage

### Phase 6 — Auth & Production
- [ ] Firebase Auth (Google OAuth + email/password)
- [ ] Trip sharing via invite token
- [ ] Firestore security rules (lock down to authenticated users)
- [ ] Medical certificate upload → Firebase Storage
- [ ] Domain cutover from v1

## Excel Import Formats
Two Ministry of Education student list formats are supported:

**Old format:** `[ת.ז, שם משפחה, שם פרטי, כיתה, מקבילה, טלפון]`

**New format:** `[מספר, ת.ז, שם משפחה, שם פרטי, כיתה, מקבילה, מין, טלפון]`

Detection: if col1 is a 7–9 digit number → new format; if col0 is → old format.

## RTL Notes
- Root layout has `dir="rtl"` and `lang="he"`
- All sidebar items border on the **right** edge when active
- Tailwind asymmetric spacing uses `pr`/`pl` intentionally for RTL
- Arrows and icons should point RTL — audit before each release

## Environment Variables
Required in `.env.local` and Vercel project settings:
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```
