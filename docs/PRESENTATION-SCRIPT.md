# AralLoop presentation script

RAITE 2026 · The unCTRLable · 5 minutes, then questions.

The script follows the slides in order and skips slide 11. It has about 410 spoken words, which is a little over 3 minutes of talking. The rest of the 5 minutes is clicking and waiting for the AI during the live demo. The timings leave about 10 seconds spare.

## Who does what

Assign the three roles before you rehearse.

| Role | Does | Slides |
|---|---|---|
| Speaker A | Opens and closes | 1 to 4, 9, 10, 12 |
| Speaker B | Narrates the live demo | 5 |
| Speaker C | Drives the app during the demo, then explains the AI and how it is built | 5 (clicking), 6 to 8 |

## Outline

| Time | Slide | Speaker | Point to land |
|---|---|---|---|
| 0:00 | 1 Cover | A | Who we are and what AralLoop does |
| 0:15 | 2 The problem | A | Teacher, student and parent all lose out |
| 0:30 | 3 The solution | A | One loop, and the teacher approves every step |
| 0:38 | 4 The loop | A | Yellow is AI, blue is the teacher |
| 0:45 | 5 Live demo | B and C | Teacher, student, teacher, parent |
| 3:25 | 6 Where AI is used | C | Four AI jobs, each checked by code |
| 3:45 | 7 Why AI is needed | C | Language tasks that forms cannot do |
| 4:00 | 8 How it is built | C | The stack, and the answer key stays on the server |
| 4:12 | 9 Responsible AI | A | Not a cheating tool, and AI is labelled |
| 4:27 | 10 Fit for real schools | A | Runs in a browser. It is a prototype |
| 4:40 | 12 Thank you | A | The one-line summary |

## Script

### 0:00 · Slide 1, cover · Speaker A

> Good [morning / afternoon], judges. We are The unCTRLable from Pampanga State University. AralLoop turns a teacher's lesson into an activity, checks the answers, and tells parents what their child should practise.

### 0:15 · Slide 2, the problem · Speaker A

> Today, a teacher writes and checks every activity by hand. A student waits days to learn what they got wrong. And a parent only finds out at grading time, too late to help.

### 0:30 · Slide 3, the solution · Speaker A

> AralLoop closes that gap in one loop, and the teacher approves every step.

### 0:38 · Slide 4, the loop · Speaker A

> Yellow is where AI works. Blue is where the teacher decides. Let us show you.

Speaker C switches to the app. Speaker B takes over.

### 0:45 · Slide 5, live demo · Speaker B talks, Speaker C clicks

**Teacher, about 55 seconds.** Account: Ms. Carmela Reyes.

Clicks: "New lesson" → upload `How-heat-travels.pdf` → save → "Generate activity" → point at "Why this format" → "Publish". Do not edit the draft.

> I am Ms. Reyes, a Grade 7 Science teacher. I upload today's lesson as a PDF and click Generate activity.
>
> In a few seconds, Gemini has drafted the items, the answer key and a rubric, and it explains why it chose this format.
>
> It is only a draft. Students see nothing until I click Publish.

**Student, about 50 seconds.** Account: Miguel Santos.

Clicks: open the new activity → answer every item, with one written answer only partly right → "Submit answers" → show the feedback on the written answer.

> Now I am Miguel, a student. I answer once, and I leave one written answer only partly right. Submit.
>
> The score is back at once. Code checked the multiple-choice items. AI graded my written answer, gave part of the points, and told me what was missing.

**Teacher again, about 25 seconds.** Account: Ms. Carmela Reyes.

Clicks: open the results of "The water cycle and our farms" → open Joshua's flagged answer → "Change score" → "Save score".

> Back to the teacher. This answer is marked "Needs your review", because the AI was not confident. She changes the score and saves. The teacher has the last word.

**Parent, about 30 seconds.** Account: Mrs. Liza Santos.

Clicks: open Miguel's newest result → wait for the summary → switch to Filipino.

> Last, Miguel's mother. She gets a short summary: what he did well, what to practise, and one thing to try at home. One tap, and it is in Filipino.

Speaker C switches back to the slides.

### 3:25 · Slide 6, where AI is used · Speaker C

> AI does four jobs: it drafts the activity, grades written answers, writes the parent summary, and runs the tutor. Every AI reply is validated by code before it is saved. Multiple choice and exact answers never go to AI. Code checks them.

### 3:45 · Slide 7, why AI is needed · Speaker C

> Why AI? Because judging an answer in a student's own words, and explaining it to a parent in plain Filipino, are language tasks. Forms cannot do that.

### 4:00 · Slide 8, how it is built · Speaker C

> It is built with Next.js, React and TypeScript, PostgreSQL, and Google Gemini. Pages render on the server, which keeps the answer key out of the student's browser.

### 4:12 · Slide 9, responsible AI · Speaker A

> The answer key never reaches a student before they submit, and the tutor opens only after, so this is not a cheating tool. Every AI output is labelled.

### 4:27 · Slide 10, fit for real schools · Speaker A

> It runs in any browser, with nothing to install. It is a prototype with sample data, not yet tried with a real class.

Skip slide 11 and go straight to slide 12.

### 4:40 · Slide 12, thank you · Speaker A

> AralLoop: one loop, with the teacher in control. Thank you.

## If you are running late

Check the clock when the demo ends. If it is past 3:40, cut in this order:

1. Skip slide 8.
2. Skip slide 7.
3. On slide 9, say only "This is not a cheating tool, and every AI output is labelled."

Inside the demo, the step you can drop is the teacher's review of the flagged answer.

## Before you start

- [ ] The app header says "AI: Gemini", not "Sample mode".
- [ ] Click "Reset sample data" on the first screen so the class is in its starting state.
- [ ] Open three browser windows before you start, one per account: the teacher, the student and the parent. The app remembers one account per browser, so use separate browsers or private windows. Switching accounts during a 5-minute talk costs too much time.
- [ ] `sample-lessons/How-heat-travels.pdf` is easy to reach from the upload dialog.
- [ ] Decide the number of items when you rehearse. Fewer items make the student step faster (the minimum is 3), but the activity must still have one written question.
- [ ] Decide in advance what the student types for each answer.
- [ ] Run the whole demo once on the venue's internet and time it.

## If the AI fails during the demo

Do not retry more than once. Say "the AI service is busy, so here is one we prepared", and use the sample class:

- Student: sign in as Miguel and open "Parts of a plant cell", which is already answered (7 / 10), to show the feedback.
- Teacher: the results of "The water cycle and our farms" need no AI call.
- Parent: Miguel's "Parts of a plant cell" summary is already stored and switches to Filipino without a call.

These sample items are labelled "Sample mode · not real AI" on screen, so say that they were prepared by the team.

## Questions and answers

Keep each answer short and let the judge ask a follow-up.

| Likely question | Short answer |
|---|---|
| What if the AI grades wrong? | Objective items are graded by code. Written answers carry a confidence value, unsure ones are flagged, and the teacher can change any score. |
| Can students cheat with it? | The server does not send the answer key to a student before that student submits, and the tutor only opens after submitting. Be upfront that the prototype has no real login: choosing a sample account stands in for it, and a real deployment would use school sign-in. |
| What does it cost? | Give your measured figure, or say you have not measured it yet. |
| Does it work offline? | No. The AI steps need a connection. Say it is future work. |
| What about privacy? | Only a name, a role and scores are stored, and the prototype uses sample data. |
| Why not just use ChatGPT? | A chat window gives a teacher a quiz. It does not deliver it to a class, collect answers, grade them, or tell the parent. |
| What comes next? | School sign-in and class lists, a link to the school's gradebook, and more languages such as Kapampangan. |
