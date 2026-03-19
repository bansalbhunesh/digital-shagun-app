# Digital Shagun — Social Gifting Platform for India

> "Blessings that remember" — a mobile-first app for India's cultural gifting tradition

A full-stack Expo (React Native) monorepo application for tracking and celebrating digital *shagun* at weddings, baby ceremonies, housewarmings, birthdays, and festivals.

---

## 🌟 Key Features

- **Secure SMS OTP Authentication** — Powered by Supabase, ensuring phone numbers are strictly verified before accessing the ledger.
- **Send & Receive Digital Shagun** — Track exact monetary gifts along with heartfelt messages and blessings.
- **Smart Event Management** — Create digital events, generate shareable QR codes, and allow guests to join effortlessly.
- **Gift Registries** — 42 curated traditional and modern gifts across 8 categories with progress tracking.
- **AI-Powered Suggestions** — Smart amount recommendations based on past gifting history between specific individuals.
- **Blessings Ledger** — A comprehensive, relationship-level history of all given and received *shagun*.
- **Elder-Friendly UX** — Large text, highly readable typography, simple flows, and an Indian cultural aesthetic.

---

## 🛠 Tech Stack & Architecture

This project is built as a highly scalable **pnpm workspace monorepo**.

| Layer | Technology |
|-------|------------|
| **Mobile App** | Expo 52, React Native, Expo Router, React Query |
| **API Server** | Node.js, Express 5, TypeScript |
| **Database** | PostgreSQL, Drizzle ORM |
| **Authentication** | Supabase Auth (SMS OTP & Session Management) |
| **Validation** | Zod (End-to-end type safety) |
| **API Client** | Orval (Auto-generated Axios hooks from OpenAPI) |

### Workspace Breakdown
```text
digital-shagun-app/
├── artifacts/
│   ├── shagun-app/        # The Expo React Native frontend application
│   └── api-server/        # The Express REST API backend
├── lib/
│   ├── db/                # Drizzle schema, DB connections, and migrations
│   ├── api-zod/           # Shared Zod validation schemas
│   └── api-client-react/  # Auto-generated React Query hooks for the frontend
```

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project for Authentication
- A PostgreSQL database instance
- The Expo Go app installed on your physical mobile device

### 1. Installation

```bash
git clone https://github.com/bansalbhunesh/digital-shagun-app.git
cd digital-shagun-app

# Install dependencies across all workspaces
pnpm install
```

### 2. Environment Configuration

You will need to configure variables for both the frontend and the backend.

**Backend (`artifacts/api-server/.env`)**:
```env
DATABASE_URL="postgresql://user:password@host:port/dbname"
```

**Frontend (`artifacts/shagun-app/context/supabase.ts`)**:
Update the `supabaseUrl` and `supabaseAnonKey` with your own project credentials to enable the SMS OTP functionality.

### 3. Database Migration

Push the Drizzle schemas to your local or remote PostgreSQL database:
```bash
pnpm --filter @workspace/db run push
```

### 4. Running the Development Servers

You need to run both the API server and the Expo bundler concurrently.

```bash
# Terminal 1: Start the API server
pnpm --filter @workspace/api-server run dev

# Terminal 2: Start the Expo React Native app
pnpm --filter @workspace/shagun-app run dev
```

Scan the QR code printed in the terminal with **Expo Go** on your Android/iOS device.

---

## 📱 Building for Production (Android / iOS)

We use EAS (Expo Application Services) to easily compile the application into a standalone `.apk` or `.ipa`.

### Step 1 — Setup EAS
1. Create a free account at [expo.dev](https://expo.dev).
2. Install the CLI and log in:
```bash
npm install -g eas-cli
eas login
```

### Step 2 — Build for Android
This is the easiest way to test the production app on your own device.
```bash
cd artifacts/shagun-app
eas build --platform android --profile preview
```
This triggers a cloud build. After ~10 minutes, you will receive a link to download the `.apk` file directly to your phone.

### Step 3 — Build for iOS
*(Requires a $99/year Apple Developer account)*
```bash
cd artifacts/shagun-app
eas build --platform ios --profile preview
```

---

## 🎨 Design System

Our UI is designed to reflect the warmth and tradition of Indian celebrations:
- **Auspicous Red (Primary):** `#8B1A1A` 
- **Envelope Gold:** `#C9A84C`
- **Warm Cream (Background):** `#FFF8F0`
- **Typography:** Poppins (Google Fonts)

---

## Security Note
This application utilizes **fully typed Zod validation** via middleware in Express to reject malformed data dynamically, and relies on **Supabase JWTs** verified server-side to guarantee zero API spoofing.
