# 🎁 ShagunX — Social Gifting Platform for Indian Events

## 🚀 Overview
ShagunX is a modern, event-driven social gifting platform designed to digitize and enhance the traditional Indian practice of *shagun* (monetary gifting). Instead of awkward envelope exchanges and unstructured gifting, ShagunX creates a seamless, transparent, and meaningful digital experience for both hosts and guests.

---

## ❗ Problem
In India, social gifting during events like weddings, baby showers, and housewarmings is deeply rooted in culture. However, the current system has several challenges:
- ❌ **Lack of transparency** — gifts and contributions are not tracked
- ❌ **Social awkwardness** — uncertainty around “how much to give”
- ❌ **Inefficient gifting** — duplicate or irrelevant gifts
- ❌ **No long-term memory** — relationships and past exchanges are forgotten
- ❌ **Manual handling** — physical envelopes (*lifafa*) are inconvenient and error-prone

Despite widespread digital payments (UPI), there is no solution that addresses the social and emotional layer of gifting.

---

## 💡 Solution
ShagunX transforms traditional gifting into a structured, intelligent, and interactive experience:
- 🎉 **Event-Based Gifting** — Create events and invite guests via QR or link.
- 💸 **Instant Shagun Payments** — Fast, preset or custom contributions.
- 🎁 **Curated Gift Registry** — Select meaningful gifts instead of random items.
- 🏠 **Life Kits (Group Gifting)** — Guests contribute to complete real-life setups (e.g., Home Kit, Baby Kit).
- 🎭 **Mystery Shagun** — Delayed reveal feature to make gifting exciting.
- 🧠 **Smart Suggestions (AI-assisted)** — Helps users decide appropriate amounts based on history.
- 🧾 **Relationship Ledger** — Tracks long-term gifting history between people.

---

## 🧠 Why This Matters
ShagunX is not just a payment tool — it builds a social gifting infrastructure:
- Reduces friction in cultural practices.
- Brings structure to informal economies.
- Strengthens social relationships through data.
- Enables collaborative and meaningful gifting.

---

## 🌍 Impact
- 🇮🇳 Designed for Indian cultural use cases at scale.
- 📈 Applicable to millions of events annually.
- 🤝 Encourages financial transparency and social harmony.
- 💡 Bridges the gap between digital payments and real-world behavior.

---

## 🏗 Tech Stack & Architecture

This project is built as a highly scalable **pnpm workspace monorepo**, ensuring a robust separation of concerns between the mobile client and backend services.

| Layer | Technology |
|-------|------------|
| **Frontend** | Expo, React Native, Expo Router. |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | PostgreSQL, Drizzle ORM |
| **Authentication** | Supabase (OTP & Session Management) |
| **Validation** | Zod (End-to-end type safety) |
| **API Client** | Orval (Auto-generated Axios hooks from OpenAPI) |

### Workspace Breakdown
```text
shagunx/
├── artifacts/
│   ├── shagun-app/        # The Expo React Native frontend application
│   └── api-server/        # The Express REST API backend
├── lib/
│   ├── db/                # Drizzle schema, DB connections, and migrations
│   ├── api-zod/           # Shared Zod validation schemas
│   └── api-client-react/  # Auto-generated React Query hooks for the frontend
```

---

## 🔐 Key Design Principles
- **Simplicity-first UX** — usable by all age groups.
- **Privacy-first** — no public exposure of financial data.
- **AI-assisted, not AI-dependent** — suggestions act as guides, not enforcers.
- **Scalable** — event-driven architecture handles high request volume during ceremonies.

---

## 🚀 Getting Started Locally

### Prerequisites
- Node.js 18+
- pnpm (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project for Authentication
- A PostgreSQL database instance
- Expo Go app installed on your physical mobile device

### 1. Installation

```bash
git clone https://github.com/bansalbhunesh/digital-shagun-app.git
cd digital-shagun-app

# Install dependencies across all workspaces
pnpm install
```

### 2. Environment Configuration

Each workspace has its own `.env.example` file. Copy these to `.env` and fill in your credentials:

- **Backend**: `artifacts/api-server/.env` (DB, Supabase Keys, Razorpay)
- **Frontend**: `artifacts/shagun-app/.env` (Supabase Public Keys, API URL)
- **Database**: `lib/db/.env` (DATABASE_URL for migrations)

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

## 🚀 Future Scope
- **Advanced AI personalization** for gifting amounts.
- **Social graph insights** mapped to ledger data.
- **Regional and cultural customization** (different themes per state/festival).
- **Merchant integrations** for direct gift fulfillment and registries.
- **Financial insights** & analytics tracking lifelong gifting impact.

---

## 🏁 Vision
To become India’s default platform for social gifting — transforming how people celebrate, contribute, and build lifelong relationships.

---

## 🤝 Contributing
We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for code standards and the PR process.

---

## 📬 Contact
For collaborations or queries, feel free to reach out.
