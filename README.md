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
