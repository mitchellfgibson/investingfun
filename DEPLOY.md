# Deploying investingfun to a real public website (Vercel)

This gets you a live `https://…vercel.app` URL. ~10 minutes. Free tier.

Your code already auto-detects the environment: it uses **Vercel KV** for saved
stocks when deployed (so saves persist), and the local file store when running
on your Mac. Nothing to change in code.

---

## Step 1 — Create a Vercel account & import the repo

1. Go to **<https://vercel.com/signup>** and **"Continue with GitHub"** (easiest —
   links your repo automatically).
2. Click **"Add New… → Project"**.
3. Find **`mitchellfgibson/investingfun`** in the list → **Import**.
4. Vercel auto-detects Next.js. **Don't deploy yet** — first add env vars (Step 2).
   (If it deploys automatically, that's fine; you'll redeploy after adding vars.)

## Step 2 — Add your environment variables

In the import screen (or later under **Project → Settings → Environment
Variables**), add these. They are the SAME values from your local `.env.local`:

| Name | Value | Required? |
| --- | --- | --- |
| `FMP_API_KEY` | your FMP key | ✅ required for live data |
| `ANTHROPIC_API_KEY` | your Claude key | optional (social AI) |
| `GEMINI_API_KEY` | your Gemini key | optional (social AI, once its API is enabled) |

> ⚠️ Do NOT add `KV_REST_API_*` by hand — Vercel injects those automatically in
> Step 3 when you attach the KV database.

## Step 3 — Attach Vercel KV (so saved stocks persist)

1. In your project, go to the **Storage** tab.
2. **Create Database → KV** (Upstash Redis). Accept the free plan.
3. **Connect it to this project** when prompted (choose all environments).
   Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to your
   project's env vars — that's what flips the app from file storage to KV.

## Step 4 — Deploy

1. Go to the **Deployments** tab → **Redeploy** (or push any commit; Vercel
   auto-deploys on every push to `main`).
2. When it finishes, click the URL — that's your live site. 🎉

---

## After deploying

- **Custom domain (optional):** Project → Settings → Domains → add your own.
- **Protecting your API quota:** the site is public by default — anyone with the
  URL can run analyses and consume your FMP/Claude quota. To lock it down, enable
  **Settings → Deployment Protection → Vercel Authentication** (only people you
  invite can view) or ask to add a simple password gate in code.
- **Costs:** Vercel Hobby tier + KV free tier are $0. Your only spend is the AI
  APIs (Gemini free once enabled; Claude pay-per-token). FMP free tier is 250
  req/day shared across all visitors — another reason to gate access.
- **Auto-deploys:** every `git push` to `main` redeploys automatically.

## Local development is unaffected

`npm run dev` still uses the local file store and your `.env.local`. The KV path
only activates where `KV_REST_API_*` exist (i.e. on Vercel).
