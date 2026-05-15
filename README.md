# IRONBID — Next.js Project

## ⚠️ Important: Rename These Folders Before Running

Windows cannot handle `[`, `]`, or `()` in folder names.
This package uses safe names. Rename them after unzipping:

| This folder (safe name)         | Rename to (Next.js requires)            |
|---------------------------------|-----------------------------------------|
| app/auth/sign-in/               | app/(auth)/sign-in/[[...sign-in]]/      |
| app/auth/sign-up/               | app/(auth)/sign-up/[[...sign-up]]/      |
| app/auth/layout.tsx             | app/(auth)/layout.tsx                   |
| app/auctions/id/                | app/auctions/[id]/                      |
| app/api/auctions/id/            | app/api/auctions/[id]/                  |
| app/api/haul-jobs/id/           | app/api/haul-jobs/[id]/                 |
| app/api/haul-bids/id/           | app/api/haul-bids/[id]/                 |

## Quick Start

1. Rename the folders listed above
2. Copy `env.example` → `.env.local` and fill in all values
3. Run: `npm install`
4. Run: `npm run db:push`
5. Run: `npm run dev`
6. Open: http://localhost:3000

## Services Required
- Supabase (database + storage)
- Stripe (payments + Connect)
- Clerk (authentication)
- Ably (WebSockets)
- Slack (notifications)
- Vercel (deployment)

See the IRONBID Setup Guide (.docx) for full step-by-step instructions.

## GitHub Transfer

1. Commit and push your current branch:
	- `git add .`
	- `git commit -m "Prepare production deploy"`
	- `git push origin main`
2. Confirm the repository is visible at your GitHub remote URL.

## Production Deploy (Vercel)

1. Link the project:
	- `npx vercel link`
2. Add production environment variables from `env.example` in Vercel Project Settings.
3. Set these values for production:
	- `NEXT_PUBLIC_APP_URL=https://<your-production-domain>`
	- `DEV_AUTH_BYPASS=false`
	- `DEV_MOCK_MODE=false`
4. Deploy:
	- `npx vercel --prod`
5. Verify live endpoints and pages:
	- `/auth/sign-in`
	- `/auctions`
	- `/api/auctions`

## Build Verification

- Run `npm run build` before deploying.
- If you see Redis connection warnings during local build, ensure production `REDIS_URL` points to your managed Redis (for example Upstash). Local `127.0.0.1:6379` is not suitable for production.

## Custom Domain Setup (Item 1)

1. Add your domain in Vercel:
   - `npx vercel domains add yourdomain.com`
2. Point DNS to Vercel as instructed in Vercel Domains settings.
3. Update production app URL:
   - `NEXT_PUBLIC_APP_URL=https://yourdomain.com`
4. Redeploy production:
   - `npx vercel --prod`

## Monitoring and Alerts (Item 2)

1. Health endpoint:
   - `/api/health`
2. Scheduled monitor workflow:
   - `.github/workflows/monitor-prod.yml`
3. Required GitHub secrets:
   - `SLACK_BOT_TOKEN`
   - `SLACK_CHANNEL_ALERTS`
   - `PRODUCTION_URL` (optional, defaults to `https://ironbid-auction.vercel.app`)

## Protected Release Workflow (Item 3)

1. CI build-only workflow:
   - `.github/workflows/ci.yml`
2. Manual production release workflow:
   - `.github/workflows/release.yml`
3. Configure GitHub environment protection:
   - Create `production` environment in GitHub
   - Add required reviewers
   - Add deployment secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_DEPLOYS`

## Claude Support Agent

1. Customer support page:
   - `/help`
2. Support API route:
   - `/api/support/agent`
3. Required env vars:
   - `ANTHROPIC_API_KEY`
   - `SUPPORT_AGENT_MODEL` (optional, default `claude-3-5-sonnet-latest`)
