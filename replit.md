# Workspace — Digital Shagun & Social Gifting Platform

## Project Overview

**Shagun** is a mobile-first Expo app (Android + iOS + Web) for India's cultural gifting tradition. It's a social gifting experience for Indian events — weddings, baby ceremonies, housewarmings, birthdays, and festivals. NOT a payment app — focused on cultural emotion and relationships.

**Tagline:** "Blessings that remember"

**Target users:** Indian families age 25–65, elder-friendly UX.

**Core differentiators:**

1. **Event-based context** — gifting tied to celebrations with full social layer
2. **Gift Kits / Bundles** — 5 pre-built culturally-appropriate gift bundles
3. **AI Suggestions** — rule-based, history-aware amount + message recommendations
4. **Smart Gift Prioritization** — registry with progress bars and "Almost!" badges
5. **Blessing Wall** — social messages attached to shagun gifts
6. **QR code sharing** — hosts can share event QR + code for guests to join
7. **Personal Stats Card** — home screen shows totalGiven, totalReceived, sent count, family count; taps to ledger

---

## Tech Stack

| Layer          | Tech                                                             |
| -------------- | ---------------------------------------------------------------- |
| Monorepo       | pnpm workspaces                                                  |
| Mobile/Web App | Expo 54 + React Native 0.81 + Expo Router 6                      |
| API Server     | Express 5 + TypeScript (tsx runtime)                             |
| Database       | PostgreSQL (Drizzle ORM, raw SQL for most queries)               |
| Fonts          | Poppins (Regular, Medium, SemiBold, Bold via @expo-google-fonts) |
| Icons          | @expo/vector-icons (Feather set)                                 |
| QR Code        | react-native-qrcode-svg + react-native-svg                       |
| Haptics        | expo-haptics                                                     |
| Storage        | @react-native-async-storage/async-storage                        |

## Design System

- **Primary:** `#8B1A1A` (deep red — auspicious Indian red)
- **Gold:** `#C9A84C` (shagun envelope gold)
- **Cream:** `#FFF8F0` (warm background)
- **Text:** `#2C1810` (dark brown)
- **Font family:** Poppins (all weights)
- **Elder-friendly:** Large buttons (18px+), minimal steps, simple flows

---

## Monorepo Structure

```
artifacts/
├── shagun-app/          # Expo React Native app
│   ├── app/             # Expo Router file-based routing
│   │   ├── (tabs)/      # Main tab screens
│   │   │   ├── index.tsx           # Home screen
│   │   │   ├── events.tsx          # Events list
│   │   │   ├── ledger.tsx          # Blessings ledger
│   │   │   └── profile.tsx         # User profile
│   │   ├── onboarding.tsx          # First launch welcome
│   │   ├── create-event.tsx        # Create new event (modal)
│   │   ├── join-event.tsx          # Join event by code (modal)
│   │   ├── event/[id].tsx          # Event detail
│   │   ├── event-qr/[id].tsx       # QR code sharing screen (modal)
│   │   ├── send-shagun.tsx         # Send gift flow (modal)
│   │   ├── reveal.tsx              # Envelope reveal animation (modal)
│   │   ├── gift-registry/[eventId].tsx  # Gift registry (card)
│   │   ├── contribute-gift.tsx     # Contribute to registry item (modal)
│   │   ├── ledger-detail/[contactId].tsx # Relationship ledger detail (card)
│   │   └── kits/[eventId].tsx      # Gift Kits browser (modal)
│   ├── context/
│   │   └── AppContext.tsx           # Global state (user, events, API calls)
│   ├── constants/
│   │   └── colors.ts               # Design tokens
│   └── assets/                     # Icons, splash screen
│
└── api-server/          # Express 5 REST API
    └── src/
        ├── index.ts               # Entry, PORT binding
        ├── app.ts                 # Express setup, route mounting
        └── routes/
            ├── index.ts           # Router aggregator
            ├── users.ts           # POST /api/users
            ├── events.ts          # GET/POST /api/events, GET /api/events/:id, GET /api/events/by-code/:code
            ├── shagun.ts          # POST /api/shagun, GET /api/shagun/event/:id, GET /api/shagun/user/:id
            ├── gifts.ts           # POST /api/gifts/contribute (BEFORE /:id), GET/POST /api/gifts/:eventId
            ├── kits.ts            # GET /api/kits, POST /api/kits/add-to-event
            ├── ledger.ts          # GET /api/ledger/:userId
            ├── ai.ts              # GET /api/ai/suggest (query: eventType, senderId, receiverId)
            └── health.ts          # GET /api/health

lib/
├── db/                  # Drizzle ORM + PostgreSQL connection
├── api-spec/            # OpenAPI spec + Orval codegen
├── api-client-react/    # Generated React Query hooks
└── api-zod/             # Generated Zod schemas

scripts/                 # Utility scripts
```

---

## Running Workflows

| Workflow                                             | Command                                           | Port  |
| ---------------------------------------------------- | ------------------------------------------------- | ----- |
| `artifacts/api-server: API Server`                   | `pnpm --filter @workspace/api-server run dev`     | 8080  |
| `artifacts/shagun-app: expo`                         | `pnpm --filter @workspace/shagun-app run dev`     | 21007 |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | 8081  |

---

## Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- wedding|baby_ceremony|housewarming|birthday|festival
  date TEXT,
  venue TEXT,
  message TEXT,
  host_id TEXT REFERENCES users(id),
  share_code TEXT UNIQUE NOT NULL,  -- 6-char uppercase code
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Members (guests who joined)
CREATE TABLE event_members (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  user_id TEXT REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (shagun sent)
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  sender_id TEXT REFERENCES users(id),
  receiver_id TEXT REFERENCES users(id),
  amount NUMERIC NOT NULL,
  message TEXT,
  is_revealed BOOLEAN DEFAULT FALSE,
  reveal_after TIMESTAMPTZ,   -- 10 min delay for emotional reveal
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Gifts (registry items)
CREATE TABLE event_gifts (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  category TEXT,
  image_url TEXT,
  is_fulfilled BOOLEAN DEFAULT FALSE,
  fulfilled_by TEXT REFERENCES users(id),
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key API Endpoints

| Method | Path                        | Description                                                   |
| ------ | --------------------------- | ------------------------------------------------------------- |
| POST   | `/api/users`                | Create/update user profile                                    |
| GET    | `/api/events`               | List all events (query: `userId`)                             |
| POST   | `/api/events`               | Create new event                                              |
| GET    | `/api/events/:id`           | Get event + transactions + gifts                              |
| GET    | `/api/events/by-code/:code` | Find event by share code (for join)                           |
| POST   | `/api/events/:id/join`      | Join event as guest                                           |
| POST   | `/api/shagun`               | Send shagun transaction                                       |
| GET    | `/api/shagun/event/:id`     | Get all shagun for event                                      |
| GET    | `/api/shagun/user/:id`      | Get user's received shagun (for reveal)                       |
| POST   | `/api/gifts/contribute`     | Mark gift as fulfilled (**MUST BE BEFORE** `/:eventId` route) |
| GET    | `/api/gifts/:eventId`       | Get registry items for event                                  |
| POST   | `/api/gifts/:eventId`       | Add registry item                                             |
| GET    | `/api/kits`                 | List all gift bundles (5 pre-built)                           |
| POST   | `/api/kits/add-to-event`    | Add kit items to event registry                               |
| GET    | `/api/ledger/:userId`       | Get relationship ledger                                       |
| GET    | `/api/ai/suggest`           | AI amount + message suggestion                                |
| GET    | `/api/health`               | Health check                                                  |

---

## AppContext API

The `AppContext` (`context/AppContext.tsx`) provides the following methods and state:

```typescript
// State
user: User | null
events: Event[]
transactions: Transaction[]

// Methods
createUser(name, phone): Promise<User>
getEvents(userId): Promise<Event[]>
createEvent(data): Promise<Event>
getEvent(id): Promise<{ event: Event, transactions: Transaction[], gifts: EventGift[] }>
joinEvent(code, userId): Promise<Event>
sendShagun(data): Promise<Transaction>
getReceivedShagun(userId): Promise<Transaction[]>
getGifts(eventId): Promise<EventGift[]>
addGift(data): Promise<EventGift>
contributeGift(giftId, userId): Promise<EventGift>
getKits(): Promise<Kit[]>
addKitToEvent(kitId, eventId): Promise<void>
getLedger(userId): Promise<LedgerEntry[]>
getAISuggestion(eventType, senderId, receiverId): Promise<AISuggestion>
```

---

## User Flows

### Onboarding

Enter name + phone → POST /api/users → save to AsyncStorage → Home

### Send Shagun

Home "Give Shagun" → Select event → AI suggestion panel (auspicious amount + message) → Pick amount (₹101/₹251/₹501/₹1100 + custom) → Type blessing message → POST /api/shagun → Envelope animation (/reveal)

### Create Event

Events tab "+" → Choose type (5 types) → Fill title/date/venue/message → POST /api/events → Success screen with 6-char share code → View Event detail

### Join Event

Home "Join Event" → Enter 6-char code → GET /api/events/by-code/:code → POST /api/events/:id/join → Event detail

### Gift Registry

Event detail "Gift Registry" → List items with progress → Add items → Contribute with "Fulfil"

### Gift Kits

Event detail "Gift Kits" → Choose bundle (5 bundles: Home ₹95k, Baby ₹42k, Wedding ₹1.3L, Birthday ₹22k, Festival ₹25k) → Preview items → POST /api/kits/add-to-event → Items added to registry

### QR Sharing (host only)

Event detail QR icon → QR code screen shows QR + 6-char code → Share via WhatsApp

### Reveal

Home "Blessings Received" → See "A blessing arrived" card → Tap to reveal → Envelope unwrap animation → Amount + message shown

---

## Important Implementation Notes

1. **Route ordering in gifts.ts:** `/contribute` POST must be registered BEFORE `/:eventId` POST or Express matches "contribute" as an eventId.

2. **Preset shagun amounts:** ₹101, ₹251, ₹501, ₹1100 — all end in 1 (auspicious in Indian tradition).

3. **Share codes:** 6 uppercase alphanumeric characters (e.g., "WED1A3").

4. **AI suggestion:** Rule-based logic in `/api/ai/suggest`. Suggests amount ending in 1 based on event type. No external API.

5. **Elder-friendly UX:** 18px+ fonts, large tap targets (min 48px), minimal steps.

6. **Tab routing:** Blessings tab is `/(tabs)/ledger` (URL: `/ledger`), NOT `/blessings`.

7. **Platform padding:** `Platform.OS === "web" ? 67 : insets.top` used for top padding across all screens.

8. **TypeScript in API:** Type errors are ignored at runtime by `tsx` — server runs fine despite TS warnings.

9. **QR code route:** `event-qr/[id]` modal, only shown to hosts (isHost check). Uses `react-native-qrcode-svg`.

10. **Kit items category format:** `"${kitName} • ${itemCategory}"` when stored in event_gifts.

---

## Deployment Notes

- API server binds to `process.env.PORT` (default 8080 in dev)
- Expo app uses `process.env.EXPO_PUBLIC_DOMAIN` for API base URL
- All API calls in AppContext use `${API_BASE}/api/...`
- Database: PostgreSQL via `DATABASE_URL` environment variable (provided by Replit)

---

## Original Workspace Structure (preserved)

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Build**: esbuild (CJS bundle for API server)

### Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
