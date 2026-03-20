# Troubleshooting Guide

Common issues and solutions for the Digital Shagun App.

## 1. Authentication Issues

- **Problem**: "Invalid or expired token" errors.
- **Solution**: Ensure your `SUPABASE_URL` and `SUPABASE_ANON_KEY` match across the frontend and backend. Check that the user is logged into the mobile app and the session hasn't expired.

## 2. Database Connection Errors

- **Problem**: `ECONNREFUSED` or timeout when connecting to Postgres.
- **Solution**: Verify the `DATABASE_URL` in your `.env`. If using a local Docker Postgres, ensure it's accessible from the host machine.

## 3. Razorpay Webhook Failures

- **Problem**: Shagun transfers not updating after payment.
- **Solution**:
  - Ensure the `WEBHOOK_SECRET` matches what you configured in the Razorpay Dashboard.
  - Verify that the API server is reachable from the internet (e.g., via `ngrok` for local testing).
  - Check the API server logs for `WEBHOOK_SIGNATURE_MISMATCH` errors.

## 4. Expo Build Failures

- **Problem**: `eas build` fails with dependency errors.
- **Solution**: Run `pnpm install` in the root to ensure `pnpm-lock.yaml` is up to date. Check that `EXPO_PUBLIC_` variables are correctly set in the EAS secrets dashboard.

## 5. API Server Crashes

- **Problem**: Server stops unexpectedly.
- **Solution**: Check the `pino` logs. Common causes include unhandled promise rejections or missing environment variables.
