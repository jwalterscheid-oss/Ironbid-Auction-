# Clerk Production Key Checklist

Use this checklist before and after each production deployment.

## 1. Clerk Dashboard Setup

- Create or confirm a Production instance in Clerk.
- In Clerk, open API Keys and copy:
  - Publishable key (starts with `pk_live_`)
  - Secret key (starts with `sk_live_`)
- Confirm allowed redirect URLs include:
  - `https://ironbid-auction.vercel.app/auth/sign-in`
  - `https://ironbid-auction.vercel.app/auth/sign-up`

## 2. Vercel Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...`
- `CLERK_SECRET_KEY=sk_live_...`
- `DEV_AUTH_BYPASS=false`
- `DEV_MOCK_MODE=false`

Then redeploy production.

## 3. Post-Deploy Verification

- Open `https://ironbid-auction.vercel.app/auth/sign-in`
- Open `https://ironbid-auction.vercel.app/auth/sign-up`
- Sign in and open `https://ironbid-auction.vercel.app/dashboard`
- Confirm browser console no longer logs "Clerk has been loaded with development keys"

## 4. Safe Rollback Plan

- Keep previous production deployment URL available in Vercel.
- If auth breaks after key swap, rollback from Vercel Deployments.
- Re-validate sign-in and onboarding after rollback.
