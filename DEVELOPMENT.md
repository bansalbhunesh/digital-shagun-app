# Development Guide

This guide covers local development, secrets management, logging, and troubleshooting for the Digital Shagun App.

## 1. Local Development Setup

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL & Supabase

### setup
1. `pnpm install`
2. Configure `.env` files.
3. `pnpm --filter @workspace/db run push`
4. `pnpm run dev`

## 2. Deployment Guide

### Prerequisites
- Production PostgreSQL (Supabase, RDS, etc.).
- Razorpay account.
- Docker (optional) for self-hosting.

### Backend (Docker)
Build using `Dockerfile.api`:
```bash
docker build -t shagun-api -f Dockerfile.api .
```

### Frontend (Expo/EAS)
```bash
cd artifacts/shagun-app && eas build --platform android
```

## 3. Security & Best Practices

- **Auth**: Protected by Supabase Auth (`requireAuth`).
- **Authorization**: Identity inferred from tokens, not request bodies.
- **Privacy**: Shagun amounts redacted until reveal time.
- **Protection**: Rate limiting, CORS, Input Sanitization, and Secure Headers (`helmet`) are enabled.

## 4. Secrets Management


Never commit secrets to version control. Use `.env` files locally.

### Production Secrets
- **DATABASE_URL**: Connection string for Postgres.
- **SUPABASE_SERVICE_ROLE_KEY**: High-privilege key for admin tasks.
- **RAZORPAY_KEY_SECRET**: Used for payment signing.
- **WEBHOOK_SECRET**: Used for Razorpay callback verification.

### CI/CD Secrets (GitHub Actions)
Add the following to your GitHub Repository Secrets:
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `WEBHOOK_SECRET`.

## 3. Structured Logging

We use **Pino** for structured JSON logging.

### Principles
- Use `logger.info({ context }, "message")` instead of `console.log`.
- Critical transactions are logged with `type: "SHAGUN_TRANSACTION"`.

### Configuration
- `LOG_LEVEL`: Set to `debug` for verbosity, `info` for production.
- `NODE_ENV`: Set to `development` for pretty logs.

## 4. Troubleshooting

### Auth Issues
- Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` match in frontend and backend.
- Check session expiration in the mobile app.

### Database Connection
- Verify `DATABASE_URL` is correct and accessible.
- If using Docker, ensure bridge networking allows host access.

### Razorpay Webhooks
- Verify `WEBHOOK_SECRET` matches the Razorpay dashboard.
- Ensure the API is reachable from the internet (e.g., via `ngrok` during local testing).

### Expo Build Issues
- Run `pnpm install` in the root to sync `pnpm-lock.yaml`.
- Check `EXPO_PUBLIC_` variables in the EAS dashboard.
