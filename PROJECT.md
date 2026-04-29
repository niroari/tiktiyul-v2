# Tik Tiyul V2

A full rebuild of the Tik Tiyul school trip folder management app, using a modern stack.

## Live URLs
- **Production:** https://tiktiyul-v2.vercel.app
- **GitHub:** https://github.com/niroari/tiktiyul-v2
- **Original app (v1):** https://tiktiyul.vercel.app

## Stack
- **Framework:** Next.js 16.2.2 (App Router), React 19.2.4, TypeScript
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
  │       notes, participationDays (undefined = all days, [1] = day 1 only, etc.)
  ├── staff/{staffId}
  │   └── name, role, phone
  ├── appendices/{appendixId}
  │   └── items, savedAt
  └── pending-updates/{updateId}
      └── tripId, token, type ("student" | "room-assignment")
          studentId?, studentFirstName?, studentLastName?, studentClass
          proposedIsGoing?, proposedDietaryFlags?, proposedMedicalNotes?, proposedNotes?
          proposedRooms? [{ roomId, studentIds[] }]
          submittedAt, status (pending|approved|rejected)

class-tokens/{token}
  └── tripId, class, schoolName, tripName, expiresAt

roomFillTokens/{token}
  └── tripId, class, schoolName, tripName, rooms[], createdAt, expiresAt

inviteTokens/{token}
  └── tripId (reverse-lookup for join flow)

signatures/{tripId}_{role}
  └── tripId, role, roleName, tripName, schoolName, leaderName
      previewHTML, requiresId, idNumber, address
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
│   ├── manifest.ts                 # PWA manifest (icons, theme color, display mode)
│   ├── login/                      # Google OAuth + email/password login
│   ├── install/                    # PWA install instructions page (per-platform)
│   ├── join/[token]/               # Invite link join flow
│   ├── sign/[docId]/               # Public remote signing page (no auth)
│   ├── class-edit/[token]/         # Public teacher form — update student details (no auth)
│   ├── room-fill/[token]/          # Public teacher form — room assignments (no auth)
│   ├── trips/
│   │   ├── layout.tsx              # Auth guard — redirects to /login
│   │   ├── page.tsx                # Trip list (filtered by owner/collaborator)
│   │   └── [tripId]/
│   │       ├── layout.tsx          # Loads trip via useTrip hook (client)
│   │       ├── dashboard/          # Stats, appendix grid, alerts
│   │       ├── settings/           # Trip metadata form
│   │       ├── students/           # Student list + Excel import + participation days
│   │       ├── staff/              # Staff roster
│   │       ├── food/               # Dietary preferences
│   │       ├── parents/            # הורים מלווים — parent chaperones + remote signatures
│   │       ├── rooms/              # Room assignments + hostel capacity specs + drag-and-drop
│   │       ├── masa/               # הודעת מסע (2-page official form)
│   │       ├── signs/              # Bus signs print export
│   │       ├── security/           # Security clearance PDF upload
│   │       └── appendix/
│   │           ├── alef/           # א — Pre-trip checklist
│   │           ├── bet/            # ב — Trip plan approval + signatures
│   │           ├── gimel/          # ג — Leader appointment letter + principal sig
│   │           ├── dalet/          # ד — Itinerary timeline
│   │           ├── hey/            # ה — Essential contacts
│   │           ├── vav/            # ו — Bus control table (multi-day, collapsible)
│   │           ├── zayin/          # ז — Student list
│   │           ├── chet/           # ח — Parental permission upload
│   │           ├── tet/            # ט — Equipment checklist
│   │           ├── yod/            # י — Medical restrictions + cert upload
│   │           └── bus-check/      # ט"ו — Pre-departure bus inspection checklist
├── components/
│   ├── auth-provider.tsx           # AuthContext + useAuth hook
│   ├── trip-shell.tsx              # Layout shell (topbar + sidebar + share button)
│   ├── signature-canvas.tsx        # Touch/mouse canvas for local signatures
│   ├── remote-signature.tsx        # Send link + WhatsApp share + live status + print form
│   ├── appendix-actions.tsx        # printHTML, esc(), safeSigUrl() shared helpers
│   ├── excel-import.tsx            # SheetJS Excel importer
│   ├── sw-register.tsx             # Service worker registration on mount
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
        ├── students.ts             # Student CRUD + subscriptions (uses deleteField for undefined)
        ├── staff.ts                # Staff CRUD + subscriptions
        ├── appendix.ts             # Generic appendix save/subscribe
        ├── signatures.ts           # Remote signature requests + submission
        ├── class-tokens.ts         # Read class tokens for teacher edit flow
        ├── room-fill-tokens.ts     # Read room-fill tokens for teacher room assignment flow
        └── pending-updates.ts      # submitPendingUpdate() — teacher-proposed student/room changes

public/
├── sw.js                           # Service worker — precaches /, serves /offline.html fallback
├── offline.html                    # Hebrew offline fallback page
├── icon-180.png                    # apple-touch-icon (180×180, white background)
├── icon-192.png                    # PWA icon 192×192
└── icon-512.png                    # PWA icon 512×512 (maskable)
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
- Room assignment — hostel capacity specs, constrained add-room dropdown, drag-and-drop chips, capacity badges
- Bus signs — adaptive font, A4 landscape print (mobile-safe hidden iframe print)
- Food preferences — dietary flags, per-student notes
- Security clearance — PDF upload + iframe preview
- הורים מלווים — parent chaperone list with remote signature per parent, referrer config dialog, print form with ID boxes
- Class-edit token flow — tokenized teacher form at `/class-edit/[token]` for student updates without an account; updates queue as pending-updates for admin approval
- Room-fill token flow — tokenized teacher form at `/room-fill/[token]` for room assignments without an account; drag-and-drop chips, gender-aware allocation
- Student participation days — per-student day selection; `undefined` = all days, `[1,2]` = specific days only
- Student notes field — free-text notes per student stored alongside dietary/medical data
- נספח ו׳ multi-day — bus control table supports multiple named days; collapsible day accordion; each day prints as a separate page
- נספח ט"ו — pre-departure bus inspection checklist
- PWA — installable as home screen app on iOS, Android, and desktop; manifest, service worker, offline fallback, per-platform `/install` instructions page

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

## Future Options

### AI Guidelines Assistant
A chat interface allowing users to ask questions answered strictly from the official MOE circular (חוזר מנכ"ל — טיולים ופעילויות חוץ-בית ספריות, 2022).

**Approach:** RAG-lite — send the full document text (~50K tokens) as system context with every query via the Anthropic API (claude-sonnet-4-6). No vector DB needed at this scale.

**Files already prepared:**
- `guidelines.txt` — full extracted text of the PDF (115 pages, ~243K chars)
- Source PDF: `חוזר מנכל טיולים.pdf`

**To implement:**
1. `npm install @anthropic-ai/sdk`
2. Add `ANTHROPIC_API_KEY` to `.env.local` and Vercel environment variables
3. Create `src/app/api/ask-guidelines/route.ts` — streaming POST endpoint
4. Create `src/app/trips/[tripId]/guidelines/` — chat UI page
5. Add nav item to `src/lib/nav.ts`

**Cost:** ~$0.01–0.03 per question (billed to your Anthropic account). All users share the same API key. Consider adding per-user rate limiting if opened to many users.

## Known Pitfalls

### React focus-loss anti-pattern
Defining components inside another component's render function causes unmount/remount on every state change, breaking text inputs. **Always define components at module scope.** Files where this was fixed: `sign-client.tsx`, `class-edit-client.tsx`, `rooms-client.tsx`.

### Print layout in window.open
`window.open()` print exports are sensitive to RTL layout. Use nested `<table>` with `border-bottom` on content cells for "content above a line" layouts — flexbox is unreliable in print rendering. Digit strings (ID numbers) need `dir="ltr" display:inline-block` to render left-to-right within an RTL page.

### window.open() blocked on mobile
iOS and Android browsers block `window.open()` when called outside a direct user gesture (e.g., inside a `setTimeout` or async callback). Use a hidden `<iframe>` instead: inject it into `document.body`, write the HTML, call `iframe.contentWindow.print()`, then remove it after a short delay. This works in both mobile browsers and PWA standalone mode.

### Hostel room spec pattern
The rooms page uses a two-type system for hostel capacity:
- **`DlgStaffGroup`** (specs: `{ count, size }[]`) — what the dialog edits
- **`StaffGroup`** (rooms: `Room[]`) — what gets stored/displayed
Convert between them via `staffGroupsToDlg()` and `saveHostelConfig()`.

## Common Commands
```bash
npm run dev          # Local dev server
npm run build        # Production build
npx tsc --noEmit    # TypeScript check
firebase deploy --only firestore:rules,storage   # Deploy security rules
```
