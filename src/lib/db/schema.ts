// PostgreSQL schema. Applied automatically on first connection (every
// statement is idempotent), and mirrored in db/schema.sql for reference.
//
// The same SQL runs on the embedded database used for local development
// (PGlite) and on a hosted PostgreSQL such as Supabase.
//
// Keep SQL comments and semicolons inside text out of it: client.ts splits it
// on ";" and db/schema.sql is compared with it line by line.
//
// The "alter table submissions" statement adds grading_provider to a database
// that was created before that column existed. On a new database it does
// nothing, because "create table" above it already has the column. The two
// "alter table users" statements do the same for email and password_hash.

export const SCHEMA_SQL = `
create table if not exists classes (
  id          text primary key,
  name        text not null,
  grade_level text not null,
  subject     text not null,
  join_code   text not null unique
);

create table if not exists users (
  id       text primary key,
  name     text not null,
  role     text not null check (role in ('teacher', 'student', 'parent')),
  class_id text not null references classes(id) on delete cascade,
  child_id text references users(id) on delete set null,
  email         text unique,
  password_hash text
);

alter table users
  add column if not exists email text unique;

alter table users
  add column if not exists password_hash text;

create table if not exists sessions (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists lessons (
  id         text primary key,
  class_id   text not null references classes(id) on delete cascade,
  title      text not null,
  content    text not null,
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id           text primary key,
  lesson_id    text not null references lessons(id) on delete cascade,
  class_id     text not null references classes(id) on delete cascade,
  title        text not null,
  instructions text not null default '',
  type         text not null check (type in ('multiple_choice', 'true_false', 'identification', 'short_answer', 'mixed')),
  ai_reason    text not null default '',
  status       text not null default 'draft' check (status in ('draft', 'published')),
  ai_provider  text not null check (ai_provider in ('openai', 'gemini', 'mock')),
  ai_model     text not null default '',
  created_at   timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists items (
  id               text primary key,
  activity_id      text not null references activities(id) on delete cascade,
  position         integer not null,
  type             text not null check (type in ('multiple_choice', 'true_false', 'identification', 'short_answer')),
  question         text not null,
  choices          jsonb,
  answer_key       text not null,
  accepted_answers jsonb not null default '[]'::jsonb,
  rubric           text,
  explanation      text,
  points           integer not null default 1 check (points > 0)
);

create table if not exists submissions (
  id               text primary key,
  activity_id      text not null references activities(id) on delete cascade,
  student_id       text not null references users(id) on delete cascade,
  total_score      double precision not null default 0,
  max_score        double precision not null default 0,
  needs_review     boolean not null default false,
  summary          jsonb,
  summary_provider text check (summary_provider in ('openai', 'gemini', 'mock')),
  grading_provider text check (grading_provider in ('openai', 'gemini', 'mock')),
  submitted_at     timestamptz not null default now(),
  unique (activity_id, student_id)
);

alter table submissions
  add column if not exists grading_provider text check (grading_provider in ('openai', 'gemini', 'mock'));

create table if not exists answers (
  id            text primary key,
  submission_id text not null references submissions(id) on delete cascade,
  item_id       text not null references items(id) on delete cascade,
  response      text not null default '',
  score         double precision not null default 0,
  feedback      text not null default '',
  graded_by     text not null check (graded_by in ('code', 'ai', 'teacher', 'pending')),
  confidence    double precision,
  needs_review  boolean not null default false,
  unique (submission_id, item_id)
);

create index if not exists lessons_class_idx      on lessons (class_id);
create index if not exists activities_class_idx   on activities (class_id);
create index if not exists items_activity_idx     on items (activity_id);
create index if not exists submissions_student_idx on submissions (student_id);
create index if not exists answers_submission_idx on answers (submission_id);
create index if not exists sessions_user_idx      on sessions (user_id);
`;

/** Every table, children before the tables they refer to. */
export const TABLES = [
  "sessions",
  "answers",
  "submissions",
  "items",
  "activities",
  "lessons",
  "users",
  "classes",
] as const;
