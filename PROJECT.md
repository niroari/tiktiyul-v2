# Tik Tiyul V2

A full rebuild of the Tik Tiyul school trip folder management app, using a modern stack.

## Live URLs
- **Production:** https://tiktiyul-v2.vercel.app
- **GitHub:** https://github.com/niroari/tiktiyul-v2
- **Original app (v1):** https://tiktiyul.vercel.app

## Stack
- **Framework:** Next.js 15 (App Router), TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **Backend:** Firebase Auth + Firestore + Storage (Blaze plan)
- **Font:** Rubik (Hebrew subset)
- **Deployment:** Vercel (auto-deploy from main branch)

## Firebase
- **Project:** tik-tiyul
- **Console:** https://console.firebase.google.com/project/tik-tiyul
- **Firestore collection:** `trips/{tripId}` (top-level, separate from v1 which used `users/{uid}/trips`)
- **Auth providers:** Google OAuth + Email/Password
- **Authorized domains:** localhost, tiktiyul-v2.vercel.app
- **Rules:** Deployed via `firebase deploy --only firestore:rules,storage`

## Firestore Structure
```
trips/{tripId}
  ├── name, schoolName, startDate, endDate
  ├── classes[], accommodation, transport
  ├── ownerUid, collaborators[], inviteToken
  ├── students/{studentId}
  │   └── firstName, lastName, class, gender, phone, isGoing, dietaryFlags, medicalNotes
  ├── staff/{staffId}
  │   └── name, role, phone
  └── appendices/{appendixId}
      └── items, savedAt

signatures/{tripId}_{role}
  └── tripId, role, roleName, tripName, schoolName, leaderName
      status (pending|signed), signature (base64 PNG), createdAt, expiresAt, signedAt
```

## Firebase Storage Structure
```
trips/{tripId}/
  ├── med-certs/{studentId}     # Medical certificates (appendix י)
  ├── security-approval/        # Security clearance PDF
  └── signs/                    # Bus sign logos
```

## Security Rules
- **Firestore:** `firestore.rules` — trips restricted to owner/collaborators; signatures locked to pending+unexpired updates only
- **Storage:** `storage.rules` — requires authentication for all trip files
- **Public:** `/sign/[docId]` route and `signatures` collection reads are public (signers have no account)
- Deploy: `firebase deploy --only firestore:rules,storage`

## Project Structure
```
src/
├── app/
│   ├── login/                      # Google OAuth + email/password login
│   ├── join/[token]/               # Invite link join flow
│   ├── sign/[docId]/               # Public remote signing page (no auth)
│   ├── trips/
│   │   ├── layout.tsx              # Auth guard — redirects to /login
│   │   ├── page.tsx                # Trip list (filtered by owner/collaborator)
│   │   └── [tripId]/
│   │       ├── layout.tsx          # Loads trip via useTrip hook (client)
│   │       ├── dashboard/          # Stats, appendix grid, alerts
│   │       ├── settings/           # Trip metadata form
│   │       ├── students/           # Student list + Excel import
│   │       ├── staff/              # Staff roster
│   │       ├── food/               # Dietary preferences
│   │       ├── rooms/              # Room assignments
│   │       ├── masa/               # הודעת מסע (2-page official form)
│   │       ├── signs/              # Bus signs print export
│   │       ├── security/           # Security clearance PDF upload
│   │       └── appendix/
│   │           ├── alef/           # א — Pre-trip checklist
│   │           ├── bet/            # ב — Trip plan approval + signatures
│   │           ├── gimel/          # ג — Leader appointment letter + principal sig
│   │           ├── dalet/          # ד — Itinerary timeline
│   │           ├── hey/            # ה — Essential contacts
│   │           ├── vav/            # ו — Bus control table
│   │           ├── zayin/          # ז — Student list
│   │           ├── chet/           # ח — Parental permission upload
│   │           ├── tet/            # ט — Equipment checklist
│   │           └── yod/            # י — Medical restrictions + cert upload
├── components/
│   ├── auth-provider.tsx           # AuthContext + useAuth hook
│   ├── trip-shell.tsx              # Layout shell (topbar + sidebar + share button)
│   ├── signature-canvas.tsx        # Touch/mouse canvas for local signatures
│   ├── remote-signature.tsx        # Send link + WhatsApp share + live status
│   ├── appendix-actions.tsx        # printHTML, esc(), safeSigUrl() shared helpers
│   ├── excel-import.tsx            # SheetJS Excel importer
│   └── ui/                         # shadcn components
├── hooks/
│   ├── use-auth.ts                 # Auth state hook
│   ├── use-trip.ts                 # Real-time trip listener
│   ├── use-students.ts             # Real-time students listener
│   └── use-staff.ts                # Real-time staff listener
└── lib/
    ├── firebase.ts                 # Firebase app init
    ├── firebase-storage.ts         # File upload/delete helpers
    ├── types.ts                    # Trip, Student, StaffMember types
    ├── nav.ts                      # Sidebar nav config
    └── firestore/
        ├── trips.ts                # Trip CRUD + subscribeToUserTrips + invite token
        ├── students.ts             # Student CRUD + subscriptions
        ├── staff.ts                # Staff CRUD + subscriptions
        ├── appendix.ts             # Generic appendix save/subscribe
        └── signatures.ts           # Remote signature requests + submission
```

## Build Plan Progress

### Phase 1 — Foundation ✅
- Next.js + Tailwind + shadcn/ui scaffold
- Rubik font (Hebrew), RTL root layout
- Firebase connected, design tokens in globals.css

### Phase 2 — Trip Shell ✅
- Trip list page with real-time Firestore + new trip dialog
- Trip shell layout: topbar + RTL sidebar with all sections
- Trip metadata form (name, school, dates, classes, logistics)
- useTrip real-time hook

### Phase 3 — Students & Staff ✅
- Student list: table, add/edit/delete, going toggle, gender badge, dietary flags
- Excel import: auto-detects old/new Ministry of Education format, preview before import
- Staff roster: list with role autocomplete, add/edit/delete
- Dashboard: stat cards, appendix grid, food prefs, alerts, class breakdown

### Phase 4 — Appendices ✅
- א — Pre-trip checklist (5 categories, 35 items, auto-save)
- ב — Schedule + leader/coordinator/principal signatures
- ג — Trip leader appointment letter + principal remote signature
- ד — Itinerary timeline
- ה — Essential contacts + emergency numbers
- ו — Bus control table (crew, extra teachers, student counts, splits)
- ז — Student list (print export, going/all toggle)
- ח — Parental permission upload
- ט — Equipment checklist
- י — Medical restrictions + certificate upload

### Phase 5 — Advanced Features ✅
- Canvas signatures (touch + mouse, pixel-ratio corrected)
- Remote signing: send link → WhatsApp share → live status subscription
- Public signing page at `/sign/[docId]` (no auth required)
- PDF/print export on all appendices via shared `printHTML` + `esc()` helper
- הודעת מסע — 2-page official form with pixel-exact image overlay, html2canvas-pro
- Room assignment — unassigned bar, auto-assign by gender+class, colored chips
- Bus signs — adaptive font, A4 landscape print
- Food preferences — dietary flags, per-student notes
- Security clearance — PDF upload + iframe preview

### Phase 6 — Auth & Production ✅
- Firebase Auth: Google OAuth + email/password login page
- AuthProvider context wraps entire app, useAuth() hook available everywhere
- Auth guard on `/trips/**` — unauthenticated users redirected to `/login`
- Trip ownership: ownerUid set on creation, trips filtered by owner/collaborator
- Invite sharing: Share button generates UUID token, copies `/join/<token>` link
- Join page: authenticated user added to collaborators[], redirected into trip
- Firestore security rules deployed and locked down
- Firebase Storage initialized (Blaze plan, europe-west1) + rules deployed
- Security hardening: XSS escaping in all print exports, signature data URL validation, MIME type checks on uploads

## Signature System
- **Local canvas** (trip leader): drawn on-screen, saved as base64 PNG to Firestore appendix
- **Remote** (coordinator, principal): generates a public link → signer opens on any device → draws → saved to `signatures` collection
- **Doc ID scheme:** `{tripId}_{role}` — deterministic, one doc per role per trip
- **Expiry:** 30 days from creation, enforced in both client and Firestore rules
- **Print:** signatures fetched via `subscribeToSignature` in parent component and embedded as `<img>` in `getHTML()`

## Invite / Share Flow
1. Owner clicks **שיתוף** in top bar
2. `generateInviteToken(tripId)` creates a UUID and saves it to the trip doc
3. Link `{origin}/join/{token}` is copied to clipboard
4. Recipient opens link → must be logged in → `joinTripByToken` adds uid to `collaborators[]`
5. Recipient sees the trip in their trips list with a "משותף" badge

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

## Common Commands
```bash
npm run dev          # Local dev server
npm run build        # Production build
npx tsc --noEmit    # TypeScript check
firebase deploy --only firestore:rules,storage   # Deploy security rules
```
