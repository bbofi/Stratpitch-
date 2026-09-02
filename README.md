# StratPitch — Deployment Package

This is the full, real website version of StratPitch — the one your customers
will actually use. It includes everything built so far: the demographic
profiler, sales pitch generator, objection handler, the WhatsApp paywall, and
the new login + Customers CRM tab backed by your Supabase project.

## What changed from the chat-preview version

Two things only work inside Claude's chat preview and had to be swapped out
for real equivalents here:

1. **AI calls** now go through `/api/generate` (a serverless function you
   control) instead of calling Anthropic directly from the browser. This
   keeps your real API key private — it lives only on the server, never in
   code the browser can see.
2. **Local storage** (free-script counter, saved script history) now uses
   your browser's real `localStorage` instead of the chat-only storage API.

Everything else — the Supabase login, customer records, and objection
handling — is exactly what you already tested and set up.

## One-time setup

### 1. Install Node.js (if you don't already have it)
Download from [nodejs.org](https://nodejs.org) — get the LTS version.

### 2. Get your Anthropic API key
- Go to [console.anthropic.com](https://console.anthropic.com)
- Create an API key under **API Keys**
- Add at least $5 in credit under **Billing**

### 3. Push this folder to GitHub
- Create a new GitHub repository (e.g. `stratpitch`)
- Upload this entire folder's contents to it

### 4. Import into Vercel
- Go to [vercel.com](https://vercel.com) → sign up/log in with GitHub
- Click **Add New → Project** → select your `stratpitch` repo
- Vercel will auto-detect this as a Vite project — leave the default build
  settings as they are
- Before clicking Deploy, go to **Environment Variables** and add:
  - `ANTHROPIC_API_KEY` = your real key from Step 2
- Click **Deploy**

### 5. Get your live link
Once deployed, Vercel gives you a URL like `stratpitch-yourname.vercel.app`
— this is the real, working website. Open it, create an account, and test
the full flow: sign up, generate a pitch, add a customer, log an objection.

## Files in this package

| File | Purpose |
|---|---|
| `src/App.jsx` | The entire StratPitch app — UI, AI prompts, Supabase calls |
| `src/main.jsx` | Mounts the app into the page |
| `api/generate.js` | Serverless function that securely calls Anthropic |
| `index.html` | Page shell, loads Tailwind and fonts |
| `package.json` / `vite.config.js` | Build configuration |
