# AralLoop

AralLoop is a classroom web app that takes a teacher's lesson and uses AI to draft an activity, check students' free-text answers, and write a plain-language summary for parents in English and Filipino. The teacher reviews the draft before students see it and can change any score.

It is a prototype built for the RAITE 2026 hackathon (theme: "Transforming Education Through Artificial Intelligence"). It uses sample data only.

- Project documentation: [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)
- Architecture diagram: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## The loop

1. A teacher pastes a lesson or uploads a file (.txt, .md, .pdf or .docx) or a photo of the lesson page, which the AI reads.
2. AI drafts an activity. It chooses the format, writes the items, the answer key and a rubric for short answers, and says why it chose that format.
3. The teacher edits the draft and publishes it. Students see nothing before that.
4. A student answers the activity once.
5. Multiple-choice, true-or-false and exact identification answers are checked by code. The remaining free-text answers are graded by AI in one call, with feedback and a confidence value. Low-confidence grades are flagged for the teacher.
6. The teacher sees the results and an item analysis, and can override any score.
7. A parent opens a summary of the result in English or Filipino. It is written the first time it is opened.
8. After submitting, the student or the parent can ask an AI tutor about the activity.

## Quick start

You need Node.js 20.9 or newer to run the app. `npm test` needs Node 22.12 or newer (Vitest 5), and `npm run check:ai` uses a Node flag (`--env-file-if-exists`) that older Node 20 releases do not have. Node 22 or 24 covers everything. The project was developed on Node 24.

```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
```

Open `.env.local` and add your Google Gemini key as `GEMINI_API_KEY`. Then:

```bash
npm run check:ai               # makes one small call per key and says if it worked
npm run dev
```

Open http://localhost:3000.

No database setup is needed. With `DATABASE_URL` empty, the app starts an embedded PostgreSQL (PGlite), stores it in `.data/pglite`, creates the tables and inserts the sample class.

With no AI key the app still runs, in sample mode. See [Sample mode](#sample-mode).

## Sample accounts

There are no passwords. The first screen lists the sample accounts; choose one to use the app as that person. "Switch account" in the header goes back to the list. "Reset sample data" on the first screen restores everything below.

All names and data are made up. The sample class is Grade 7 - Sampaguita, Science, with two lessons written by the team and one published activity for each.

| Account | Role | What to try |
|---|---|---|
| Ms. Carmela Reyes | Teacher | Click "New lesson", paste a lesson, generate an activity, edit an item, publish. Open the results of "The water cycle and our farms": one of Joshua's answers is flagged for review (confidence 45%). Change its score. Look at the item analysis. |
| Miguel Santos | Student | "The water cycle and our farms" is not started. Answer it and submit to see grading and feedback. "Parts of a plant cell" is already answered (7 / 10): open it to review the feedback and ask the tutor. |
| Althea Cruz | Student | Has answered both activities (9 / 10 on each). |
| Joshua Dela Cruz | Student | Has answered both activities (6 / 10 on each). His water cycle result shows "Teacher is checking" until the teacher reviews the flagged answer. |
| Mrs. Liza Santos | Parent of Miguel | Open Miguel's "Parts of a plant cell" result and switch the summary between English and Filipino. After Miguel submits the water cycle activity, open that result: its summary is written at that moment. Ask the tutor how to help at home. |

The two sample activities, their grades and Miguel's stored summary were written by hand by the team. The app labels them "Sample mode · not real AI", even when an AI key is set.

## Environment variables

All are optional. Copy `.env.example` to `.env.local` and fill in what you have.

| Variable | What it does |
|---|---|
| `GEMINI_API_KEY` | Google Gemini key. Without it the app runs in sample mode. |
| `GEMINI_MODEL` | Gemini model id. Default: `gemini-3.5-flash-lite` (set in `src/lib/ai/gemini.ts`). |
| `AI_PROVIDER` | Forces the provider: `gemini` or `mock`. If the Gemini key is missing, the app uses sample mode. |
| `DATABASE_URL` | PostgreSQL connection string for a hosted database such as Supabase. Empty means the embedded database. |
| `PGLITE_DIR` | Folder for the embedded database. Default: `.data/pglite`. `memory` keeps nothing on disk. |
| `ALLOW_DEMO_RESET` | Set to `false` to turn off "Reset sample data". The reset needs no sign-in and deletes everything, so set this to `false` on any site that other people can open. Leave it unset only on your own machine. |

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the development server on http://localhost:3000. |
| `npm run build` | Builds the app for production. |
| `npm run start` | Serves the production build. |
| `npm run lint` | Runs ESLint. |
| `npm run typecheck` | Generates Next.js route types, then runs the TypeScript compiler without output. |
| `npm test` | Runs the automated tests with Vitest. They use an in-memory database and never call a real AI service. |
| `npm run check:ai` | Prints which provider and model the app will use (never the key), makes one small real call with the configured key, and says what to fix if a call fails. |

## Project structure

```
src/
  app/
    page.tsx                 first screen: choose a sample account
    teacher/                 class dashboard, new lesson, lesson page, draft editor, results
    student/                 activity list, answer form, results with feedback and tutor
    parent/                  child's results, summary in English and Filipino, tutor
    api/                     13 route handlers (see the API reference in the documentation)
  components/                screens' building blocks, grouped by role; ui/ holds shared pieces
  lib/
    types.ts                 domain types shared by every layer
    contracts.ts             request schemas (zod), response types and size limits
    grading.ts               checks objective items by code, sends the rest to AI in one call
    extract.ts               reads lesson text from .txt, .md, .pdf, .docx files and photos
    session.ts               prototype sign-in: a cookie with a sample user id
    http.ts                  route wrapper: validation, role checks, error responses
    ai/
      provider.ts            picks the provider, timeout, retry, fallback, output validation
      gemini.ts              one structured-output request, sent with fetch
      generate-activity.ts   AI task 1: lesson to draft activity
      grade.ts               AI task 2: grade free-text answers
      parent-summary.ts      AI task 3: summary in English and Filipino
      tutor.ts               AI task 4: after-submission tutor
      mock.ts                sample mode (no AI)
    db/
      client.ts              embedded PGlite, or the pg driver when DATABASE_URL is set
      schema.ts              the tables, applied on first connection
      seed.ts                the sample class
      repo.ts                all SQL
db/schema.sql                reference copy of the schema
scripts/check-ai.ts          the `npm run check:ai` script
docs/                        project documentation and architecture diagram
```

## Deployment

**Not yet tried.** The code path for a hosted database exists but has only been run against the embedded database. The intended setup is Vercel with a Supabase PostgreSQL database:

1. Create a Supabase project. Copy the connection string from Project Settings, Database, Connection string, Transaction pooler.
2. Import the repository into Vercel.
3. Set the environment variables in Vercel: `DATABASE_URL` (the Supabase string), `GEMINI_API_KEY`, and `ALLOW_DEMO_RESET=false`. Anyone who has the link can open a deployed site, and "Reset sample data" needs no sign-in, so without this setting one tap by a visitor deletes a lesson made during a demo.
4. Deploy. On the first request the app creates the tables and inserts the sample class if the database is empty, so the reset is not needed to get the sample data. `db/schema.sql` has the same statements if you prefer to run them in the Supabase SQL editor.

Things to know before trying it:

- The embedded database cannot be used on Vercel. Without `DATABASE_URL` the app stops with an error that says so.
- The routes that call AI set `maxDuration = 60` seconds. Check that the Vercel plan allows that.
- File uploads are limited to 4 MB, to stay under Vercel's request size limit.

## Sample mode

With no AI key (or with `AI_PROVIDER=mock`) the app runs in sample mode. **Sample mode is not AI.** There is no model and no network call. Plain code stands in for each AI step so that the screens can be shown and tested:

- The activity is built from sentences of the lesson: a word is blanked out, or a statement is kept or negated for true or false, and one short-answer item asks about the main idea.
- Free-text answers are compared with the answer key by keyword overlap. Every such grade gets a low confidence value, so it is always flagged for the teacher.
- The parent summary fills a fixed template in English and Filipino.
- The tutor returns a prepared reply that points to the matching item or lesson sentence.

Sample output says what it is. The header shows "Sample mode · no AI key". Labels read "Sample mode · not real AI" where they would otherwise read "AI-generated" or "Graded by AI". The text itself also says so, for example "This is a sample summary made without AI." The app stores which service produced each activity, grade and summary, so the label stays correct after a key is added.

## Known limitations

- **One live trial only.** One full loop (activity draft, grading, tutor, parent summary) was run with a Gemini key and the default model `gemini-3.5-flash-lite` on 2026-10-02, and all four tasks worked. That is a single trial, not a measure of quality across lessons. Run `npm run check:ai` after adding a key.
- **The hosted database path has not been run.** Only the embedded database has been used.
- **Sign-in is a prototype.** Anyone who opens the site can choose any sample account, including the teacher. There are no passwords, and the cookie holds a plain user id. Do not put real student data in it.
- **One class.** The sample data has one class with a join code, but there is no screen to create a class, add users or join with the code.
- **One attempt per activity.** A published activity cannot be edited or deleted.
- **It needs an internet connection** to reach the AI service. There is no offline AI.
- **Scanned PDFs are not read.** They contain images, not text. The teacher is told to paste the text instead.
- **Long lessons are cut.** A lesson can be up to 20,000 characters, and the AI reads about the first 12,000. The teacher sees a notice when this happens.
- **Tutor conversations are not saved.** They are kept in the browser until the page is reloaded or closed.
- The full loop has been clicked through in a desktop browser in sample mode. It has not been tested with real teachers, students or parents, or on a range of phones.

## Checks

At the time of writing, `npm run lint`, `npm run typecheck`, `npm test` (297 tests in 13 files) and `npm run build` pass.

## Team

- Team name: The unCTRLable
- Members: Darlene Joy A. De Leon, Nicole T. Mallari, Sidrick Benjie G. Piquero
- School: Pampanga State University
- Coaches: John Mark S. Policarpio, Reden Paul L. Rivera
- Repository: https://github.com/Vade-30/aralloop
