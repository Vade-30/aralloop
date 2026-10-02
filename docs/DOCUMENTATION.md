# AralLoop project documentation

RAITE 2026 hackathon. Theme: "Transforming Education Through Artificial Intelligence".

Team: The unCTRLable · Members: Darlene Joy A. De Leon, Nicole T. Mallari, Sidrick Benjie G. Piquero · School: Pampanga State University · Coaches: John Mark S. Policarpio, Reden Paul L. Rivera · Repository: https://github.com/Vade-30/aralloop

Related files: [README](../README.md) (how to run it) · [Architecture diagram](ARCHITECTURE.md)

Reading guide: sections 1 to 7 are the main story. Sections 8 to 12 are reference tables. Sections 13 to 15 cover limits, next steps and the judging criteria.

## Status

AralLoop is a working prototype. Every step of the loop is implemented and has been clicked through in a browser. One full loop has been run with live AI on Google Gemini (activity draft, grading, tutor and parent summary all worked). One thing is **not yet verified**: a hosted PostgreSQL database (only the embedded database has been run). Without an API key the app runs a labelled sample mode, which is plain code and not AI.

## 1. Problem statement

Teachers spend much of their time outside class writing activities and checking them by hand. Because checking is slow, students wait days for feedback, and learning gaps are found late. Parents are left out almost completely: most only learn how their child is doing when grades are released, so those who want to help at home do not know what to help with.

In one sentence: the path from lesson to activity to feedback to parent is slow and manual, and each delay costs the student a chance to catch up.

[Optional: one real figure from your adviser, for example hours per week spent making and checking activities. Remove this line if you do not have one.]

## 2. Solution

AralLoop is a classroom web app that covers that whole path:

1. The teacher pastes or uploads a lesson.
2. AI drafts an activity: it chooses the format and writes the items, the answer key and a rubric.
3. The teacher edits and publishes. Nothing reaches students before that.
4. The student answers once.
5. Code checks the objective items. AI grades the free-text answers in one call, with feedback and a confidence value. Low confidence is flagged for the teacher.
6. The teacher can override any score.
7. The parent gets a plain-language summary in English and Filipino, written when first opened.
8. After submitting, the student or parent can ask an AI tutor about the activity.

## 3. Who benefits

- **Teachers** get a first draft of an activity and a first pass of checking, and keep the final say on both. They also see which items the class missed most.
- **Students** get a score and feedback on every item right after submitting, and can ask why an answer was wrong.
- **Parents** get a short summary in their own language: what the child got right, what to practise, and one thing to do at home.

We have not measured time saved or learning gains, and the prototype has not been tested with real teachers, students or parents.

## 4. The four questions

| Question | Answer |
|---|---|
| What educational problem does it solve? | Slow, manual activity-making and checking; late feedback for students; parents left out. |
| Why is AI needed? | Three steps are language tasks: writing questions that fit a lesson, judging a free-text answer against a rubric, and rewriting results as a plain summary in two languages. Our sample mode shows the limit of plain code: it can only blank out words and count matching keywords. Everything code can do, code does (section 6). |
| Who benefits? | Teachers, students and parents (section 3). |
| Can schools actually use it? | It runs in a browser, so nobody installs anything. The teacher approves every activity and can change every grade. AI use is small: normally one call per generated activity, at most one per submission, one per summary and one per tutor question. Before real use it still needs real sign-in, a hosted deployment and a consent process (section 13). |

## 5. Features by role

**Teacher**

- Dashboard: lessons, their activities, draft or published status, how many students submitted, how many submissions need review.
- New lesson: paste text or upload .txt, .md, .pdf or .docx files (up to 4 MB each), or photos of the lesson pages, which the AI reads. Up to 10 files can be chosen at once; their text is joined in the order of the file names, and a file that cannot be read is named while the others are kept. The extracted text is shown for checking before it is saved.
- Generate: choose 3 to 15 items and a format, or let the AI choose the format.
- Draft editor: shows the AI's reason for the format. Edit the title, instructions and every item; add or remove items; save, publish or delete the draft.
- Results: number submitted, class average, answers waiting for review, item analysis with a "Most missed" mark, and each answer with how it was graded and the AI's confidence.
- Override: change the score and feedback of any answer. The total is recomputed.

**Student**

- List of published activities, each with "Start" or the score and "Review".
- Answer form with a warning for blank answers. One attempt only.
- Results: for each item, the student's answer, the correct answer, feedback, an explanation and who graded it.
- Tutor chat about the submitted activity.

**Parent**

- The child's results, newest first, and the activities not answered yet.
- Summary with an English / Filipino switch: overview, did well, to practise, try this at home.
- The child's answers, and a tutor chat worded for parents.

**Everyone**: a first screen to choose a sample account, a "Reset sample data" button, and a header badge showing which AI service is in use (or sample mode).

## 6. How AI is used

All five tasks go through one function (`generateJson` in `src/lib/ai/provider.ts`). It sends one request with `fetch`, asks the provider for structured JSON output that follows a schema, then parses and validates the reply against the same schema in code. Each task then applies its own checks. The tasks are separate calls, not chained agents.

The AI service is Google Gemini. The default model id is `gemini-3.5-flash-lite`. It is set in the code, can be changed with an environment variable, and has been confirmed with live calls. The provider layer is written so that a second provider can be added as a fallback; the prototype is set up and verified with Gemini only.

### Task 1: generate an activity (`generate-activity.ts`)

- **In:** subject, grade level, lesson title, the lesson text (about the first 12,000 characters), the number of items, and the format ("auto" or a named type).
- **Out:** title, instructions, activity type, a short reason for the format, and the items. Each item has a type, question, choices, answer key, accepted answers, rubric, explanation and points.
- **Checks by code:** items with an empty question or key are dropped. Multiple choice needs at least three distinct choices and a key that matches one of them; "A." labels are stripped and at most four choices are kept. True-or-false keys are normalised to "True" or "False". A short answer with no rubric uses the model answer as its rubric. Points are clamped to 1 to 5. Repeated questions are removed. Fewer than three usable items is a failure with a clear message.
- **Why code cannot do it:** writing a question that tests one idea, with plausible wrong options, and choosing a format that fits the content both require understanding the text.

### Task 2: grade free-text answers (`grade.ts`, called from `grading.ts`)

- **In:** lesson title, grade level, and a numbered list of only the answers code could not settle: question, points, answer key, accepted answers, rubric and the student's response. One call per submission. The student's name is not sent.
- **Out:** for each answer, a score, one or two sentences of feedback, and a confidence from 0 to 1.
- **Checks by code:** one grade per answer, matched by number. Scores are clamped to 0 up to the item's points. Identification is all or nothing; a part mark there caps the confidence at 0.5. Short-answer scores are rounded to half points. An answer the model skipped is stored as "pending" for the teacher, not as an AI grade. Any grade with confidence below 0.7 is flagged for review.
- **Why code cannot do it:** deciding whether "mitocondria" means mitochondria, or whether a sentence in English, Filipino or both contains the ideas a rubric asks for, is a judgement about meaning.

### Task 3: parent summary (`parent-summary.ts`)

- **In:** the child's name, grade level, subject, lesson and activity titles, the score, whether the teacher is still checking, and each item's question, correct answer, child's answer, score and feedback.
- **Out:** four fields in English and the same four in Filipino: overview, did well, to practise, home tip. One call returns both languages, so switching language sends no request.
- **Checks by code:** lists are capped at three points and texts at fixed lengths. An empty overview or home tip is filled from a fixed template. If the teacher is still checking and the overview does not say so, a fixed sentence saying the score may change is added. The summary is stored, and cleared when the teacher overrides a score, so it always matches the final scores.
- **Why code cannot do it:** turning item results into a few natural sentences that name topics, in everyday Filipino and not a word-for-word translation, is a writing task.

### Task 4: after-submission tutor (`tutor.ts`)

- **In:** who is asking (student or parent), the learner's name and grade level, the lesson text, the graded results, up to the last 10 chat messages and the question (up to 500 characters).
- **Out:** one plain-text reply.
- **Checks by code:** the route works only for an existing submission, and only for the student who owns it, that student's parent, or the class teacher. The reply is cut at 1,200 characters; an empty reply is an error. The prompt tells the model to use only the lesson, to say it is an AI if asked, and to refuse unrelated or unsuitable requests. The tutor has no code path to change a score.
- **Why code cannot do it:** answering "why did I lose points on question 4?" in the asker's own language is a conversation.

### Task 5: reading a lesson from a photo (`read-lesson-image.ts`)

- **In:** one photo of a lesson page (JPEG, PNG, WebP or HEIC). The browser first makes it smaller, to at most 2,000 pixels on its long side.
- **Out:** the words on the page and its heading, if it shows one.
- **Checks by code:** the route is for teachers only and the file limit is 4 MB. The text is cleaned and cut to 20,000 characters, and a result under 80 characters is refused with the advice to take the photo again. Nothing is stored: the text goes into the lesson form with the photo beside it, and the teacher checks it before saving. The prompt tells the model to copy only, to write "[unclear]" for a word it cannot read, and to treat everything written in the photo as data, not as instructions.
- **Why code cannot do it:** a photo holds pixels, not characters. Text, PDF and Word files are still read by code, without AI.
- **Sample mode:** there is no stand-in for this task. Without an API key a photo is refused with the advice to paste the text.

### What is deliberately not done by AI

- **Objective items are checked by code** (`checkByCode` in `src/lib/grading.ts`): multiple choice, true or false, and identification answers that match the key or an accepted answer after normalising case, accents, punctuation and leading articles ("the", "ang", "si"). True or false also accepts "tama" and "mali". Blank answers score zero without a call.
- **Totals, the class average and the item analysis** are arithmetic over stored scores (`results-model.ts`). The results page says "Counted from the scores, without AI."
- **Stored results are reused.** Reloading a page never calls the AI again.

## 7. Responsible AI and safety

| Rule | How the code enforces it |
|---|---|
| Teacher review before students see anything | A generated activity is stored as a draft. Students get "not found" for a draft. Only the teacher's publish request changes its status. |
| The answer key never reaches a student's browser before submission | The student's activity page renders on the server. Before submission it passes only `PublicItem` objects to the answer form: id, position, type, question, choices and points. No API route returns items to a student, and the submit response returns scores and feedback only. A test renders the page and searches the props and the HTML for the key, rubric and explanation. |
| One attempt | Unique constraint on (activity, student). A second submit gets a 409 response. |
| The teacher has the final say on grades | AI grades below 0.7 confidence are marked "Needs your review". The teacher can override any answer, which is then marked "Set by teacher". The confidence is the model's own estimate: a signal for the teacher, not a measured accuracy. |
| AI output is labelled | Each answer shows who decided the score: "Checked by answer key", "Graded by AI", "Set by teacher" or "Waiting for teacher". Activities and summaries carry an AI label. The tutor panel says it is an AI helper that can make mistakes. |
| Sample output is never passed off as AI | The app stores which service produced each activity, grade and summary. Sample-mode output is labelled "Sample mode · not real AI" and says so in its text. The hand-written sample data carries the same label. |
| Prompt injection | Lesson text, student answers and chat messages are wrapped in tagged blocks. Tag-like text inside them is stripped so they cannot close a block, and every system prompt says the blocks are data, never instructions. Code limits the damage too: a grade cannot exceed the item's points, and generated content goes to a draft the teacher reads. Not yet tested against a live model. |
| The tutor is not a cheating tool | It is addressed by submission id, so it cannot be reached before the student has submitted. |
| No harmful content | The prompts restrict the model to the teacher's lesson and tell it to write nothing unsuitable for children and never to shame a learner. These are instructions to the model, not code checks; the teacher's review is the safeguard. |
| No sensitive personal data | The app stores a name, a role, a class link, answers and scores. All data in the prototype is made up. Logs hold the task, provider, duration and token counts, never the prompt, the reply or the key. The child's name is sent to the AI service for the summary and the tutor; a real deployment should review that. |

## 8. Error handling

Every API error has the shape `{ "error": { "code", "message" } }` with a message that is safe to show. Request bodies are validated with zod; the first problem becomes a 400 response.

| Where | What can go wrong | What the app does |
|---|---|---|
| Any AI call | Timeout, network error, rejected key, rate limit, unusable output | 45 seconds per try, 55 seconds in total. Unusable output is retried once. A busy or failing service (HTTP 429 rate limit, 408 or 5xx) is asked once more after 1.5 seconds. If it still fails, the route returns 503 with a specific message, such as "The AI service took too long to answer. Please try again." |
| Lesson upload | Unsupported type, over 4 MB, empty file, locked or damaged PDF, scanned PDF, photo with no readable text, photo in sample mode, too little text | A specific message each time, with the advice to paste the text instead. Text over 20,000 characters is cut at a paragraph or sentence end and the teacher is told. |
| Generate activity | AI fails, or fewer than three usable items | The lesson is already saved. The form says so, and "Try again" repeats only the generation. |
| Edit and publish | Inconsistent item, no items, already published | A message naming the item number. A published activity cannot be edited or deleted (409). |
| Submit answers | AI grading fails, or the model skips an answer | The submission is still saved and objective items keep their scores. The unsettled answers are stored as "pending" with score 0 and flagged for the teacher. The student is told the teacher will review them and the score may change. |
| Submit answers | Sent twice, or answers for another activity | 409 for the second submit; 400 for answers that do not belong. |
| Parent summary | AI fails | Nothing is stored. The panel shows the error and a "Try again" button. |
| Tutor | AI fails | The question stays in the chat with the error and a "Try again" button. |
| Any page | Database unreachable or another failure | An error screen with "Try again" and a link to the start. |
| Access | No account chosen, wrong role, another class's data | 401, 403, and 404 (so another class's data is not revealed to exist). |

## 9. Data model

PostgreSQL, eight tables (`src/lib/db/schema.ts`, copy in `db/schema.sql`).

| Table | Main columns |
|---|---|
| `classes` | id, name, grade_level, subject, join_code |
| `users` | id, name, role (teacher, student, parent), class_id, child_id (parents only), email (unique), password_hash (both empty for the sample accounts) |
| `sessions` | token_hash, user_id, expires_at |
| `lessons` | id, class_id, title, content, created_at |
| `activities` | id, lesson_id, class_id, title, instructions, type, ai_reason, status (draft, published), ai_provider, ai_model, created_at, published_at |
| `items` | id, activity_id, position, type, question, choices, answer_key, accepted_answers, rubric, explanation, points |
| `submissions` | id, activity_id, student_id, total_score, max_score, needs_review, summary (both languages), summary_provider, grading_provider, submitted_at; unique (activity_id, student_id) |
| `answers` | id, submission_id, item_id, response, score, feedback, graded_by (code, ai, teacher, pending), confidence, needs_review; unique (submission_id, item_id) |

```
classes 1 ── * users            (a parent's child_id points to a student in users)
classes 1 ── * lessons 1 ── * activities 1 ── * items
activities 1 ── * submissions * ── 1 users (the student)
submissions 1 ── * answers * ── 1 items
```

All SQL is in `src/lib/db/repo.ts` and uses parameters. Writes that touch several rows (create an activity, store a submission, override a score) run in one transaction.

## 10. API reference

Routes are under `src/app/api`. Pages read the database on the server, so there are no GET routes. "Teacher" means the teacher of the class the data belongs to. Request schemas and response types are in `src/lib/contracts.ts`.

| Method | Path | Who may call it | What it does |
|---|---|---|---|
| POST | `/api/session` | Anyone | Chooses a sample account and sets the session cookie. |
| DELETE | `/api/session` | Anyone | Signs out. |
| POST | `/api/lessons/extract` | Teacher | Returns the text of an uploaded file or photo and a suggested title. A photo is read by the AI. Stores nothing. |
| POST | `/api/lessons` | Teacher | Saves a lesson into the teacher's own class. |
| POST | `/api/lessons/[lessonId]/activities` | Teacher | Runs AI task 1 and stores the result as a draft. |
| PATCH | `/api/activities/[activityId]` | Teacher | Replaces the title, instructions and items of a draft. |
| DELETE | `/api/activities/[activityId]` | Teacher | Deletes a draft. |
| POST | `/api/activities/[activityId]/publish` | Teacher | Publishes a draft that has at least one item. |
| POST | `/api/activities/[activityId]/submissions` | Student of the class | Grades and stores the student's one submission. Returns scores and feedback. |
| PATCH | `/api/answers/[answerId]` | Teacher | Overrides one score and its feedback, recomputes the total, clears the stored summary. |
| POST | `/api/submissions/[submissionId]/summary` | Teacher, or the parent of that student | Returns the stored summary, or runs AI task 3 and stores it. |
| POST | `/api/submissions/[submissionId]/ask` | The student who submitted, that student's parent, or the teacher | Runs AI task 4 and returns the reply. |
| POST | `/api/demo/reset` | Anyone, unless `ALLOW_DEMO_RESET=false` | Deletes all data and restores the sample class. |

## 11. Technology stack

| Piece | Why it was chosen |
|---|---|
| Next.js 16 (App Router), React 19 | One codebase for the screens and the API. Pages render on the server, which is what keeps the answer key out of the student's browser. |
| TypeScript | The database layer, the AI layer, the API and the screens share one set of types. |
| Tailwind CSS 4 | Consistent styling with a small set of shared components. |
| zod 4 | Validates each request body, produces the JSON schema sent to the AI provider, and validates the reply. |
| PostgreSQL: PGlite locally, `pg` for a hosted database | PGlite is PostgreSQL embedded in the Node process, so the app runs with no database setup. The same SQL is meant to run on Supabase by setting `DATABASE_URL` (not yet run). |
| Google Gemini API, called with `fetch` | It offers structured JSON output, and plain `fetch` means no SDK is needed. |
| unpdf, mammoth | Read text from PDF and Word files on the server. |
| Vitest | Automated tests against an in-memory PostgreSQL and mocked AI responses. |

## 12. Testing

`npx vitest run` on 2 October 2026: **297 tests in 13 files, all passing.** ESLint and the TypeScript check also pass. The tests use an in-memory database and never call a real AI service.

| Area | Tests | What is covered |
|---|---|---|
| AI provider layer | 71 | Provider selection, request and reply handling (mocked `fetch`), retry on unusable output and on a busy service, fallback, error mapping, timeout |
| The four AI tasks | 47 | Repair of generated items, clamping of grades, summary caps, prompts, sample mode, and each task's schema through the real request builders |
| Grading | 28 | Answer normalising, checking by code, the single AI call, the "pending" path when AI fails |
| File extraction | 31 | Text, PDF and Word files, photos through a stand-in reader, truncation, rejected files |
| Database layer | 24 | Sample data and every write path on a real PostgreSQL engine |
| API routes | 24 | Every route in loop order: who gets in, bad requests, one attempt only, override, summary, tutor, reset |
| Teacher screens and editor rules | 63 | Draft editor rules, item analysis and class average, screens refuse another class's data, sample-mode wording |
| Student screens | 5 | No answer key, rubric or explanation is sent to the browser before submission |
| Parent and home screens | 12 | A parent can open only their own child's results; account picker |

Not covered: a real AI model, a hosted database, and automated clicking through the screens. The click-through was done by hand, in sample mode.

## 13. Limitations and what is unverified

**Unverified**

- Gemini has been run live for one full loop with one lesson, which is a single trial, not a measure of quality across lessons. `npm run check:ai` tests a key in a few seconds.
- Reading a lesson from a photo was tried once with live Gemini, on a generated page of printed Filipino text, and was correct. Real phone photos and handwriting have not been tried.
- The hosted PostgreSQL path and deployment to Vercel have not been tried.
- AI cost and response time have not been measured. The app logs token counts for each call so they can be.
- No testing with real users or on a range of phones.

**Limitations of the prototype**

- Sign-in is by email and password, but the email is not verified, a forgotten password cannot be reset, and log-in attempts are not limited. The sample accounts have no passwords, so anyone who opens the site can act as any of them.
- One class. There is no screen to create a class, add users, or join with the join code.
- One attempt per activity. Published activities cannot be edited.
- AI needs an internet connection. There is no offline AI.
- Scanned PDFs cannot be read as files; the teacher uploads photos of the pages instead, up to 10 at a time. The AI reads only about the first 12,000 characters of a long lesson.
- The summary has two languages only. Tutor conversations are not stored.
- AI can grade wrongly. The confidence flag and the teacher override reduce that risk; they do not remove it.

## 14. Future work

- Real sign-in for schools, and joining a class with the join code.
- Deploy and verify on Vercel with Supabase; measure cost per class.
- Offline support for answering, with grading when the connection returns.
- More languages for the summary, such as Cebuano and Ilocano.
- Export of scores to formats schools already use, and links to existing school systems.
- Regenerating a single item, more than one attempt, and progress over time for each student.
- Reading a lesson of several pages from several photos or from a scanned PDF.
- A consent and data-retention process before any real student data is used.

## 15. How it meets the judging criteria

| Criterion | Weight | What AralLoop offers |
|---|---|---|
| Innovation and creativity | 25% | Keeps the teacher, the student and the parent in the loop on the same lesson, instead of being a standalone quiz generator or chatbot. The AI explains its format choice. The parent is part of the product. |
| Educational impact | 25% | Feedback on every item at submission, a "most missed" view for the teacher, and a summary that tells a parent what to practise. Impact is designed for, not measured. |
| AI integration | 20% | Five distinct AI tasks, each with a stated reason, structured output and code checks on the result. Code does what code can do. |
| Technical implementation | 15% | Schema-validated AI output with retry, code grading for objective items, stored results, transactions, 297 automated tests. |
| User experience | 10% | Three role views in a single-column layout sized for phones, with loading, empty and error states. |
| Presentation and demo | 5% | The sample data has an unanswered activity for a live student run, a flagged answer for the override, and a stored summary as a backup. |

**Bonus considerations**

| Item | Applies? | Detail |
|---|---|---|
| Multi-language support | Yes | The parent summary is written in English and Filipino. The grading prompt accepts answers in English, Filipino or a mix, and the tutor is told to reply in the language of the question. In one live trial on Gemini the summary came back in both languages and the tutor answered a Taglish question in Taglish. |
| Responsible AI | Yes | Teacher review, answer key withheld until submission, confidence flag, teacher override, AI labels, honest sample-mode labels, prompt-injection handling (section 7). |
| Data privacy | Partly | Minimal data, sample data only, no prompts or keys in logs. There is no real authentication yet. |
| Accessibility | Basics only | Labelled form fields, visible keyboard focus, errors announced to screen readers, touch targets of at least 40 px, the Filipino summary marked with its language. No audit has been done. |
| Scalability | By design, not tested | The API keeps no application state in memory between requests: the session is a cookie and all data is in PostgreSQL. AI is called at most once per step and results are stored. Not load-tested; the hosted database is not yet run. |
| Offline capability | No | The app runs locally without a key in sample mode, but that is not AI. |
| Integration with existing school systems | No | Not built. Listed as future work. |
