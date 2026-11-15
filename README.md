# AgapayIsip+

Mental health patient record and referral management system for barangay health centers and the RHU (Dalaguete, Cebu).

```
client/     React + Tailwind web app (deploys to Vercel)
server/     Express API for web push, reports, admin actions (deploys to Render)
supabase/   SQL files, run in order in the Supabase SQL Editor
```

## Run it on your computer

1. `client/.env.example` -> copy to `client/.env`, fill in Supabase URL and anon key.
2. `server/.env.example` -> copy to `server/.env`, fill in values.
3. In one terminal: `cd client` then `npm install` then `npm run dev` (opens at http://localhost:5173).
4. In another terminal: `cd server` then `npm install` then `npm run dev` (http://localhost:4000/health).

## Rules for the team

- Never commit `.env` files or the Supabase `service_role` key.
- Pull before you start, commit and push when a piece of work is done.
