# Noqeev

**AI resume tailoring, a real job board, and an agent that fills out applications for you. Built around one promise: your data is yours, and we're not interested in collecting it.**

Noqeev is a resume builder that actually reads the job posting. Set up your profile once (your work history, your skills, how you talk about what you've done), and from then on, every resume you generate is tailored to the specific job you're applying for, not a generic template with your name swapped in. No credit card, no locked downloads, no watermark on the PDF you worked for.

This repo is the whole product: the resume builder itself, a real jobs board pulling from live sources, an "Apply with AI" agent that can fill out an application end-to-end (and stops for your review before anything gets submitted), a small social-content toolkit for independent professionals (`/brand`), and the admin tooling that keeps it all running.

---

## What's actually in here

**The resume builder.** Paste a job description, get a tailored resume back. Real AI (Claude, with Groq as a fallback if Claude's unavailable), not a template engine with find-and-replace. Five distinct layouts, each structurally different (not just recolored), each honestly labeled for ATS-safety since a two-column layout really can trip up some applicant-tracking parsers. Real `.docx` and PDF exports, no watermark, full i18n in English/Spanish/French/Portuguese.

**The jobs board.** Real listings ingested from live sources (Greenhouse, Ashby, Arbeitnow, Remotive, and others), refreshed on a schedule, not a static seed file. Trending-category stats computed from the actual current inventory, never invented.

**Apply with AI.** An agent that reads a real job posting and fills out the application form for you, then stops. It has no submit capability by design; a human reviews a snapshot of exactly what it's about to send before anything goes out under their name.

**`/brand`.** A lightweight toolkit for independent professionals to draft social content and plan what to post, intentionally *not* an auto-poster. Noqeev doesn't hold API keys to your social accounts; it reminds you, you post.

**Admin panel.** Break-glass login that works even if the database is having a bad day, vendor/API health monitoring, incident tracking, and the manual triggers for the background jobs described below.

---

## Why it's built this way

A few decisions show up repeatedly in this codebase and are worth stating up front, because they explain a lot of what you'll read in the code comments:

- **No fabricated people.** Demo content, placeholder resumes, example candidates: none of it invents a specific person's name, email, or identity. Where an example is needed, it's labeled "Your Name," "Your City," unambiguously a template standing in for *you*, never someone who supposedly exists.
- **Honest about real limitations.** The sidebar layout is flagged as a genuine ATS risk, not quietly treated as equal to the others. The `/brand` scheduler is labeled "not an auto-poster" rather than implying automation that isn't there. If something doesn't do what it might sound like it does, the UI says so.
- **Not in the business of collecting your data.** Demo/public endpoints persist nothing. There's no ad-tech, no resale of resume content, no dark patterns steering you toward handing over more than you need to.

---

## Tech stack

| | |
|---|---|
| **Frontend** | Next.js (App Router), React, Tailwind CSS v4, Framer Motion |
| **Backend** | Flask, SQLAlchemy, Gunicorn |
| **Database** | PostgreSQL (Neon, serverless Postgres) |
| **AI** | Claude (primary) via Anthropic's API, Groq (fallback) |
| **Deployment** | Vercel (both frontend and backend, as separate services behind one `vercel.json`) |
| **Error tracking** | Sentry (active once `SENTRY_DSN` is set) |
| **Automation (browser)** | Playwright, drives the Apply-with-AI agent's form-filling |

The frontend is mostly one root client component (`app/page.js`) that switches between screens by view-state rather than by file-based routes. A few top-level paths (the marketing site, a handful of deep links) are real Next.js routes, but most of the authenticated app lives behind that one switch, with each screen lazy-loaded on first visit.

---

## Project structure

```
Resume-builder/
├── backend/
│   ├── app/
│   │   ├── api/            # Flask blueprints, one file per feature area
│   │   ├── agent/          # Apply-with-AI's step loop + browser automation
│   │   ├── jobs_ingest/    # Job board source adapters + the ingestion pipeline
│   │   ├── utils/          # AI client, storage backends, email, schedulers
│   │   └── models.py       # Every table, one file
│   ├── requirements.txt
│   └── run.py               # Local dev entrypoint, runs on :5002
│
├── frontend/
│   ├── app/                 # Next.js App Router: layout, root page, a few real routes
│   ├── components/
│   │   ├── premium/         # The actual app screens (Dashboard, JobsBoard, GuestMode builder, ...)
│   │   │   └── landing/     # The public marketing site
│   │   └── ui/              # Shared primitives (shadcn-based)
│   ├── lib/                 # i18n, hooks, small client-side utilities
│   └── public/
│
└── vercel.json               # Both services' deploy config in one file
```

---

## Getting started

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# see Environment variables below: create backend/.env with the real values
python run.py              # runs on http://localhost:5002
```

### Frontend

```bash
cd frontend
npm install
# frontend/.env.local:
#   NEXT_PUBLIC_API_URL=http://localhost:5002
npm run dev                 # runs on http://localhost:3000
```

Open `http://localhost:3000`. The public landing page loads first; sign up (email verification required) to reach the real app.

### Environment variables

`backend/.env` (not committed; ask whoever's running this for the real values):

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `CLAUDE_API_KEY` | Primary AI provider |
| `GROQ_API_KEY` | AI fallback, used only if Claude errors |
| `JWT_SECRET` | Signs auth tokens |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `RESEND_API_KEY` / `MAIL_FROM` | Transactional email (verification, reminders) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web push notifications |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Google sign-in |
| `BREAK_GLASS_ADMIN_USERNAME` / `BREAK_GLASS_ADMIN_PASSWORD_HASH` | Emergency admin login that works even if the database is down |
| `ADMIN_BOOTSTRAP_EMAIL` | First account auto-granted admin on signup — also the only account that can open `/brand`, which now requires real admin login |
| `CRUX_API_KEY` / `SCRAPEGRAPHAI_API_KEY` | Job-ingestion data sources |
| `FRONTEND_URL` | Used in generated links (emails, OAuth redirects) |
| `SENTRY_DSN` *(optional)* | Error tracking. The app runs fine without it, but you won't hear about crashes except from users. |
| `ENABLE_SCHEDULERS` *(optional)* | Forces background jobs (ingestion, reminders, SEO snapshots) to run locally; in production they're gated on the host environment |

`frontend/.env.local`:

| Variable | What it's for |
|---|---|
| `NEXT_PUBLIC_API_URL` | Where the frontend sends API requests |

> There's no `.env.example` checked in yet. This table is the closest thing to one right now. Worth turning into a real file.

---

## Deployment

Both services deploy from `vercel.json`: one config, two Vercel "services" (`frontend` and `backend`), with `/api/*` rewritten to the backend and everything else to the frontend. `backend/render.yaml` also exists from an earlier deployment target; as of this writing the app genuinely runs on Vercel (confirmed via a real production incident whose stack trace pointed at Vercel's own `/var/task` filesystem), so treat the Render config as historical unless you've specifically re-verified it's still in use.

---

## Current state, worth knowing before you dig in

Written plainly, because the alternative is someone finding these out the hard way:

- **No automated test suite yet.** No pytest, no Jest/Vitest/Playwright test runner. The highest-value place to start would be the Apply-with-AI submit-gate logic and the account-deletion cascade, since both touch things that are expensive to get wrong.
- **The in-memory rate limiter assumes a single long-running process.** On Vercel's serverless model that assumption doesn't fully hold. Worth moving to a shared store (Redis) before leaning on it for anything security-critical.
- **No `.env.example`.** The table above is a stopgap; a real file would make onboarding a new environment much less error-prone.
- **The artisan marketplace was deliberately removed,** not abandoned mid-build. If you find references to "artisans" in older migrations or comments, that's why.

None of this is a reason not to build here. It's the honest starting point for making the next change a safe one.

---

## A note on tone

If you read through the codebase, you'll notice the comments explain *why*, not *what*: the reasoning behind a decision, a past incident that shaped it, a tradeoff that was weighed. That's deliberate, and worth keeping up. The code should be able to explain itself to the next person (quite possibly you, in six months) without them having to reconstruct the reasoning from scratch.
