# Digital Shagun — Social Gifting Platform for India

> "Blessings that remember" — a mobile-first app for India's cultural gifting tradition

A full-stack Expo (React Native) app for tracking and celebrating digital shagun at weddings, baby ceremonies, housewarmings, birthdays, and festivals.

---

## Features

- 🎁 **Send & Receive Digital Shagun** — track gift amounts with messages and blessings
- 📅 **Event Management** — create events, share QR codes, let guests join
- 🧧 **Gift Registry** — 42 curated gifts across 8 categories with progress tracking
- 🤖 **AI Suggestions** — smart amount recommendations based on your history
- 📊 **Blessings Ledger** — full relationship-level given/received history
- 🎉 **Gift Kits** — curated bundles for major life events
- 🏠 **Personal Stats** — home screen summary of your gifting history
- Elder-friendly UX — large text, simple flows, Indian cultural design

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile App | Expo 54 + React Native + Expo Router |
| API | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Fonts | Poppins (Google Fonts) |
| Icons | Expo Vector Icons (Feather) |

---

## Running Locally

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL database
- Expo Go app on your phone

### Setup

```bash
git clone https://github.com/bansalbhunesh/digital-shagun-app.git
cd digital-shagun-app
pnpm install

# Set your database URL
export DATABASE_URL="postgresql://..."

# Push DB schema
pnpm --filter @workspace/db run push

# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the Expo app (in a new terminal)
pnpm --filter @workspace/shagun-app run dev
```

Scan the QR code in the terminal with **Expo Go** on your phone.

---

## Building the Android APK (install on any Android phone)

This is the easiest way to get the app on your phone as a real installed app.

### Step 1 — Create a free Expo account
Go to [expo.dev](https://expo.dev) and sign up.

### Step 2 — Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Step 3 — Clone and build
```bash
git clone https://github.com/bansalbhunesh/digital-shagun-app.git
cd digital-shagun-app/artifacts/shagun-app

eas build --platform android --profile preview
```

This triggers a cloud build on Expo's servers (free tier available). It takes ~10–15 minutes.
When done, you get a download link for the `.apk` file — install it directly on your Android phone.

### Step 4 — Install on phone
1. Download the `.apk` from the link Expo gives you
2. Open it on your Android phone
3. Allow "Install from unknown sources" if prompted
4. Done — the app is installed!

---

## Building for iOS (requires Apple Developer account)

```bash
eas build --platform ios --profile preview
```

iOS builds require an Apple Developer account ($99/year). For testing without publishing to the App Store, use TestFlight.

---

## Design

- **Primary:** `#8B1A1A` (deep auspicious red)
- **Gold:** `#C9A84C` (shagun envelope gold)
- **Cream:** `#FFF8F0` (warm background)
- **Font:** Poppins

---

## Project Structure

```
artifacts/
├── shagun-app/        # Expo React Native app
│   ├── app/           # Screens (Expo Router file-based routing)
│   ├── context/       # AppContext (global state + API calls)
│   └── constants/     # Colors, typography
├── api-server/        # Express REST API
│   └── src/routes/    # events, shagun, gifts, ledger, ai, kits
lib/
└── db/                # Drizzle schema + migrations
```
