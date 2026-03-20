# Secrets Management Guide

This project handles sensitive financial and authentication data. Never commit secrets to version control.

## Local Development
Use `.env` files (based on the provided `.env.example` templates). These are ignored by `.gitignore`.

## Production Secrets
When deploying to platforms like Render, Railway, or AWS:
1.  **DATABASE_URL**: Protected Postgres connection string.
2.  **SUPABASE_SERVICE_ROLE_KEY**: Extreme sensitivity — allows bypassing RLS.
3.  **RAZORPAY_KEY_SECRET**: Used to sign payments.
4.  **WEBHOOK_SECRET**: Used to verify Razorpay callbacks.

## CI/CD Secrets (GitHub Actions)
Add these to **Settings > Secrets and variables > Actions**:
- `DATABASE_URL` (for migration tests)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `WEBHOOK_SECRET`

## Rotation Policy
Secrets should be rotated every 90 days or immediately if a compromise is suspected.
