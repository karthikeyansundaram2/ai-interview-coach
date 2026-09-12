# AI Interview Coach

A live mock technical interview. Pick a topic and level — or upload your resume and choose the round —
and an AI interviewer asks one question at a time (including coding problems you answer in a code editor),
decides when the interview is over, and gives you a scored Pass / Fail report with preparation tips.

```
frontend/   Next.js 16 (App Router, TypeScript, Tailwind v4)   -> http://localhost:3000
backend/    Python 3.12 FastAPI + Groq                          -> http://localhost:8000
```

## Setup

**Backend** (Python 3.12 via `uv`):

```bash
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.txt
cp .env.example .env      # then put your Groq key in backend/.env
```

**Frontend**:

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

## Run (two terminals)

```bash
# Terminal 1 — backend
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev
```

- App: http://localhost:3000
- API docs (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Secrets — read this before pushing or deploying

The Groq key lives in **`backend/.env` only**. That file is:

- ignored by git (`.gitignore` ignores every `.env*` except `*.example` templates),
- ignored by Vercel and Docker builds (`.vercelignore`, `.dockerignore`),
- blocked by a versioned pre-commit hook (`.githooks/pre-commit`, enabled via `git config core.hooksPath .githooks`)
  that refuses any commit containing a `.env` file or a `gsk_…` key.

If you clone this repo fresh, re-enable the hook: `git config core.hooksPath .githooks`.

**Deploying:** never put the key in code or config. Set `GROQ_API_KEY` as an environment variable in the
hosting platform (e.g. `vercel env add GROQ_API_KEY`, or your container/PaaS secret settings). The frontend
never sees the key — only the backend talks to Groq.

## Deploying (backend → Render, frontend → Vercel)

Both free tiers. Nothing in the code assumes localhost: the backend listens on `$PORT`, the frontend reads the
backend URL from `NEXT_PUBLIC_API_URL`, and CORS allows `CORS_ORIGINS` plus any `*.vercel.app` origin.

**Render (backend)** — either *New → Blueprint* with the included `render.yaml`, or *New → Web Service*:

| Setting | Value |
| --- | --- |
| Root Directory | `backend` |
| Runtime | Python 3 (`.python-version` pins 3.12) |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |
| Env: `GROQ_API_KEY` | your key (dashboard only — never in the repo) |
| Env: `CORS_ORIGINS` | `https://ai-interview-coach-drab-one.vercel.app,http://localhost:3000` |

**Vercel (frontend)** — *Add New → Project → import the repo*:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework | Next.js (auto-detected) |
| Env: `NEXT_PUBLIC_API_URL` | the Render URL, no trailing slash (e.g. `https://ai-interview-coach-backend.onrender.com`) |

Render's free tier sleeps after 15 min idle — the first request takes 30–60 s; the setup screen tells the user so.

## Configuration (`backend/.env`)

| Variable       | Default                  | Notes                                                                 |
| -------------- | ------------------------ | --------------------------------------------------------------------- |
| `GROQ_API_KEY` | —                        | Required. Get one at https://console.groq.com/keys                    |
| `GROQ_MODEL`   | `openai/gpt-oss-120b`    | Groq retired `llama-3.3-70b-versatile`; this is the closest option.   |
| `CORS_ORIGINS` | `http://localhost:3000`  | Comma-separated list of allowed frontend origins                      |
| `CORS_ORIGIN_REGEX` | `https://.*\.vercel\.app` | Regex for extra allowed origins (Vercel previews). Empty disables.  |

`backend/.env` is git-ignored; `.env.example` is the committed template.

## API

No database — the frontend sends the conversation back on every call.

| Method | Path                | Body                                        | Returns                                    |
| ------ | ------------------- | ------------------------------------------- | ------------------------------------------ |
| GET    | `/health`           | —                                           | `{status, groq_key_configured, model}`     |
| POST   | `/resume/parse`     | multipart `file` (PDF / DOCX / TXT ≤ 5 MB)  | `{filename, text, word_count, profile}`    |
| POST   | `/interview/start`  | `{topic, difficulty, context}`              | `{message, interview_over}`                |
| POST   | `/interview/answer` | `{topic, difficulty, messages, answer, context}` | `{message, interview_over}`           |
| POST   | `/interview/report` | `{topic, difficulty, messages, context}`    | `{score, band, result, strengths, weaknesses, topics_to_revise, verdict, preparation_tips}` |

`messages` is a list of `{role: "interviewer" | "candidate", content}`. `context` is optional personalisation:
`{round, target_role, resume_text, resume_filename}` — `round` is one of Phone screen / Technical / System design /
Behavioral / Hiring manager / Final round. `topic` may be empty when `resume_text` is present: the interview is then
driven by the resume. Code answers are sent as fenced ```` ``` ```` blocks. Every error is `{detail: "<friendly message>"}`.

## How the interviewer works

- `backend/app/interviewer.py` — one question per turn; strong answers move on, partial answers get one probing follow-up, wrong answers get a one-line note. Ends early if the candidate is struggling, wraps up once key areas are covered, and never exceeds 8 questions. The model replies as JSON `{message, interview_over}` so the app knows when it's over.
- `backend/app/report.py` — grades the transcript into structured JSON. Bands: 85+ excellent, 70–84 good, 55–69 adequate, <55 weak. Pass is 55 and above (see `PASS_THRESHOLD`).

## Frontend notes

- `/` is the homepage; `/interview` is the app (`src/components/InterviewApp.tsx` switches between setup, interview
  and report). The in-progress interview is kept in `sessionStorage` so a refresh doesn't lose it.
- Design system (from the `ui-ux-pro-max` skill, "Bold Typography / Editorial"): near-black ground, one vermilion
  accent for actions, Inter Tight headlines, JetBrains Mono labels, Playfair italic for the interviewer's voice,
  square corners and hairline rules. Tokens live in `src/app/globals.css`.
- Composer: **Text** mode — Enter sends, Shift+Enter newline. **Code** mode (for DSA questions) — monospace,
  Tab indents, Enter newline, ⌘/Ctrl+Enter sends; the answer is sent as a fenced code block.
- "End" in the interview header asks for a second click, then grades what you've answered so far.
