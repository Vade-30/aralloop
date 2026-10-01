# AralLoop (working name) — RAITE 2026 Hackathon Plan

Theme: "Transforming Education Through Artificial Intelligence"
Event: October 2, 2026 · 3 members · 8-minute demo + 5-minute Q&A

---

## 1. Problem statement

Teachers spend much of their time outside class writing activities and checking
them by hand. Because checking is slow, students wait days for feedback, and
learning gaps are found late. Parents are left out almost completely: most only
learn how their child is doing when grades are released, so those who want to
help at home do not know what to help with.

**In one sentence:** the path from *lesson* to *activity* to *feedback* to
*parent* is slow and manual, and each delay costs the student a chance to
catch up.

> If you can get one real number before the presentation (for example, ask
> your adviser how many hours a week they spend making and checking
> activities), put it on the problem slide. Do not invent a statistic.

### Solution statement

AralLoop is a classroom platform where a teacher uploads a lesson and AI turns
it into a ready activity, checks student answers against a teacher-approved key
with feedback on every item, and gives parents a plain-language summary of what
their child should practise. The teacher approves each step.

### The four questions judges want answered (slide 15 of the guidelines)

| Question | Answer |
|---|---|
| What educational problem does it solve? | Slow, manual activity-making and checking; late feedback; parents left out. |
| Why is AI needed? | Reading a lesson and writing a fitting activity, judging free-text answers, and rewriting results in plain language for a parent are language tasks. A normal CRUD system cannot do any of the three. |
| Who benefits? | Teachers (less workload), students (feedback in seconds), parents (they know what to help with). |
| Can schools actually use it? | It runs in a browser on a phone, needs no installation, uses a low-cost model, and the teacher stays in control of every activity and grade. |

Suggested problem statements covered (slide 5): teacher workload reduction,
parent-school communication, personalized learning, learning analytics.

---

## 2. The loop (what the app does)

1. **Teacher uploads a lesson** (paste text or upload a file) into a class.
2. **AI generates an activity.** It chooses the format that fits the content
   (multiple choice, identification, true/false, short answer), and produces
   the answer key and a rubric for open-ended items.
3. **Teacher reviews, edits and publishes.** Nothing reaches students unreviewed.
4. **Student answers** in the app and submits.
5. **Grading.** Objective items are checked by code. AI grades only free-text
   answers against the rubric, gives feedback per item, and flags answers it is
   unsure about for the teacher.
6. **Teacher sees results** and can override any score.
7. **Parent sees a summary** in English or Filipino: what the lesson was, how
   the child did, and what to practise.

Stretch (only if time allows): a small "ask about this activity" chat that
explains instructions but refuses to give answers.

---

## 3. AI design

| Step | Input | Output | Notes |
|---|---|---|---|
| Generate activity | Lesson text, grade level | JSON: activity type, reason for the type, items, answer key, rubric, points | Use structured (JSON) output so the UI never has to parse free text. |
| Grade free-text | Question, rubric, student answer | Score, feedback, confidence | Low confidence goes to the teacher for review. |
| Parent summary | Lesson title, item results | Short plain-language summary, English or Filipino | One call per submission. |

- **Model:** OpenAI API, small low-cost model. Keep a Google Gemini free-tier
  key as a fallback behind the same function.
- **Save credits:** grade objective items in code, call AI once per activity
  and once per submission, and store every AI result in the database so a page
  reload never calls the API again.
- **"Why not multi-agent?"** Three focused calls with clear inputs and outputs
  are cheaper, faster and easier to debug than four chained agents. Say this
  plainly if a judge asks.

---

## 4. Tech stack (all on the allowed list)

| Layer | Choice |
|---|---|
| Frontend | React (Next.js) |
| Backend | Node.js (Next.js API routes) |
| Database | Supabase (PostgreSQL) |
| AI | OpenAI API, Gemini as fallback |
| Cloud | Vercel |

Swap any of these for an allowed tool your team knows better.

### Data model

- `classes` — id, name, join_code
- `users` — id, name, role (teacher / student / parent), class_id, child_id (for parents)
- `lessons` — id, class_id, title, content
- `activities` — id, lesson_id, type, status (draft / published), ai_reason
- `items` — id, activity_id, type, question, choices, answer_key, rubric, points
- `submissions` — id, activity_id, student_id, total_score, parent_summary
- `answers` — id, submission_id, item_id, response, score, feedback, needs_review

### Screens

- **Start:** pick a role (teacher / student / parent). No real login for the prototype.
- **Teacher:** class page → upload lesson → review generated activity → publish → results table with override.
- **Student:** activity list → answer → results with per-item feedback.
- **Parent:** child's latest results and summary, with language toggle.

---

## 5. Minimum features checklist (slide 14)

- [ ] Working UI — the screens above
- [ ] Functional AI feature — generate, grade, summarise
- [ ] Error handling — AI call fails or times out, AI returns invalid JSON, empty lesson, empty answer, lesson too long
- [ ] Sample educational data — one class, three students, one parent, two lessons you wrote yourselves
- [ ] Working demonstration — one activity already published and answered, as a backup if the live call fails

---

## 6. Staying off the prohibited list (slide 16)

| Rule | How the app complies |
|---|---|
| No academic dishonesty | Students never see the answer key before submitting. The stretch chat explains instructions only. |
| No harmful content | Generation is limited to the teacher's lesson; teacher reviews before publishing. |
| No copyright violation | Sample lessons are written by the team. Teachers upload their own materials. |
| No sensitive data without consent | Sample data only. The app stores a name, a role and scores, nothing else. |
| No deceptive AI | Every generated activity, grade and summary is labelled "AI-generated, reviewed by teacher". |

---

## 7. Build order (assumes about 8 working hours)

| Block | Work | Done when |
|---|---|---|
| 0:00–0:45 | Project setup, database tables, seed data, API key test | A page lists the seeded class and lessons |
| 0:45–2:30 | Lesson upload → AI generates activity → teacher review and publish | A pasted lesson becomes an editable activity |
| 2:30–4:00 | Student answers and submits; objective items graded in code | A student sees a score |
| 4:00–5:15 | AI grading of free-text answers with feedback; error handling | A short answer gets a score and a comment |
| 5:15–6:00 | Teacher results table with override | Teacher can change a score |
| 6:00–6:45 | Parent summary with language toggle | Parent page shows a summary in Filipino |
| 6:45–7:15 | Deploy, test the full loop on a phone | Live URL works end to end |
| 7:15–8:00 | Slides, README, architecture diagram, documentation, rehearsal | All five submissions ready |

**Cut order if you run behind:** stretch chat → teacher override → parent
language toggle → parent summary. Steps 1–5 of the loop are the minimum demo.

### Team split

- **Member 1 — Frontend:** all screens, role picker, mobile layout.
- **Member 2 — AI and backend:** the three AI calls, prompts, JSON schema, grading logic, error handling.
- **Member 3 — Data and deliverables:** database, seed data, deployment, then slides, README, architecture diagram and documentation. Start the documents by hour 5, not at the end.

---

## 8. Submission checklist (slide 13)

- [ ] Source code (repository link or zip)
- [ ] Presentation slides
- [ ] Project documentation
- [ ] Architecture diagram
- [ ] README (what it is, how to run it, environment variables, sample accounts)

---

## 9. How this maps to the judging criteria (slide 17)

| Criterion | Weight | What to show |
|---|---|---|
| Innovation & Creativity | 25% | The closed loop that includes the parent, not a standalone quiz generator or chatbot. |
| Educational Impact | 25% | Feedback in seconds instead of days; parents know what to practise. |
| AI Integration | 20% | Three distinct AI uses, each with a reason; AI picks the activity format. |
| Technical Implementation | 15% | Structured output, code-based grading for objective items, fallback model, stored results. |
| User Experience | 10% | Three simple role views that work on a phone. |
| Presentation & Demo | 5% | One live run of the full loop. |

Bonus points within reach (slide 18): multi-language support (Filipino parent
summary), responsible AI (teacher review, AI labels, confidence flags), data
privacy (minimal data), scalability (hosted, stateless API).

---

## 10. Demo script (8 minutes)

| Time | What happens |
|---|---|
| 0:00–1:00 | The problem, told as one teacher, one student, one parent. |
| 1:00–3:00 | Teacher pastes a lesson; AI generates an activity and explains its format choice; teacher edits one item and publishes. |
| 3:00–4:30 | Student answers on a phone, including one deliberately wrong short answer; score and feedback appear. |
| 4:30–5:30 | Teacher opens results, sees the flagged answer, overrides a score. |
| 5:30–6:30 | Parent view; switch the summary to Filipino. |
| 6:30–7:30 | Architecture diagram and how AI is used. |
| 7:30–8:00 | Who benefits and what comes next. |

### Likely Q&A

- **What if the AI grades wrong?** Objective items are graded by code, not AI. Free-text grades carry a confidence flag and the teacher can override any score.
- **Can students use it to cheat?** The answer key is never sent to the student's browser before submission.
- **What does it cost a school?** One AI call per activity and one per submission on a small model. Measure your actual usage during testing and quote that.
- **Does it work offline?** No. Say so, and name it as future work.
- **What about student privacy?** Only a name, a role and scores are stored; the prototype uses sample data.
- **Why not just use ChatGPT?** ChatGPT gives a teacher a quiz in a chat window. It does not deliver it to a class, collect answers, grade them, or tell the parent.

---

## 11. Before the event

- [ ] Confirm whether pre-written code is allowed or everything must be built on site.
- [ ] Confirm how many hours of build time there are; adjust section 7.
- [ ] Test the OpenAI key and check the remaining balance in dollars. Set a spending limit.
- [ ] Create the Gemini fallback key.
- [ ] Write two sample lessons yourselves (one facts-heavy, one concept-heavy) so the AI visibly picks different formats.
- [ ] Decide the final name.
