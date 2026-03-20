# Deployment Guide

This document outlines the steps to deploy the Digital Shagun App to production.

## 1. Prerequisites
- A production PostgreSQL instance (e.g., Supabase, RDS, Digital Ocean).
- A Supabase project for Authentication.
- A Razorpay account for payment processing.
- Docker & Docker Compose (for self-hosting) or a platform like Render/Railway/Vercel.

## 2. Environment Variables
Ensure the following variables are set in your production environment:
- `DATABASE_URL`: Your production Postgres connection string.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: For auth verification.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`: For payments.
- `WEBHOOK_SECRET`: Secure secret for Razorpay webhooks.

## 3. Database Migrations
Run migrations before starting the application:
```bash
pnpm --filter @workspace/db run push
```
*(Note: For production, use `pnpm --filter @workspace/db run generate` and a formal migration runner like `drizzle-kit migrate` is recommended.)*

## 4. Backend (Docker)
Build and run the API server using the provided `Dockerfile.api`:
```bash
docker build -t digital-shagun-api -f Dockerfile.api .
docker run -p 3000:3000 --env-file .env.prod digital-shagun-api
```

## 5. Frontend (Expo/EAS)
Build the production apps:
```bash
cd artifacts/shagun-app
eas build --platform android --profile production
eas build --platform ios --profile production
```
