// Sample educational data: one class, one teacher, three students, one parent,
// two lessons written for this project, and two published activities that
// students have already answered (the backup for a live demo).
//
// Everything here is fictional and was written for AralLoop. Submission totals
// are computed from the answers below, so they cannot drift out of step.

import type {
  ActivityType,
  GradedBy,
  ItemInput,
  ParentSummary,
  Role,
} from "../types";
import type { Db, QueryFn } from "./client";
import { TABLES } from "./schema";

/** Fixed ids so the role picker, the tests and the docs can refer to them. */
export const SEED_IDS = {
  classId: "class-7-sampaguita",
  teacherId: "user-teacher-reyes",
  studentIds: ["user-student-miguel", "user-student-althea", "user-student-joshua"],
  parentId: "user-parent-santos",
} as const;

/** Fixed ids of the sample lessons and activities. */
export const SEED_CONTENT_IDS = {
  plantCellLessonId: "lesson-plant-cell",
  waterCycleLessonId: "lesson-water-cycle",
  /** Answered by all three students. */
  plantCellActivityId: "activity-plant-cell",
  /** Answered by Althea and Joshua; left open for Miguel, the live demo student. */
  waterCycleActivityId: "activity-water-cycle",
} as const;

const [MIGUEL, ALTHEA, JOSHUA] = SEED_IDS.studentIds;

// --- insert helper -----------------------------------------------------------

/**
 * Inserts several rows with one statement, which matters on a hosted database
 * where every statement is a network round trip. A column written as
 * "name::jsonb" gets that cast on its placeholder. Table and column names
 * must be constants from the code, never user input.
 *
 * Lives here rather than in repo.ts because client.ts imports this file, so
 * this file cannot import anything that imports the client.
 */
export async function insertRows(
  query: QueryFn,
  table: string,
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
  options: { ignoreConflicts?: boolean } = {},
): Promise<void> {
  if (rows.length === 0) return;
  const names = columns.map((column) => column.split("::")[0]);
  const casts = columns.map((column) => {
    const cast = column.split("::")[1];
    return cast ? `::${cast}` : "";
  });
  const params: unknown[] = [];
  const tuples = rows.map((row) => {
    const placeholders = casts.map((cast, index) => {
      params.push(row[index] ?? null);
      return `$${params.length}${cast}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const conflict = options.ignoreConflicts ? " on conflict do nothing" : "";
  await query(
    `insert into ${table} (${names.join(", ")}) values ${tuples.join(", ")}${conflict}`,
    params,
  );
}

/** jsonb parameter: SQL null stays null, everything else is sent as JSON text. */
export function toJsonb(value: unknown): string | null {
  return value === null || value === undefined ? null : JSON.stringify(value);
}

// --- people ------------------------------------------------------------------

const SEED_CLASS = {
  id: SEED_IDS.classId,
  name: "Grade 7 - Sampaguita",
  gradeLevel: "Grade 7",
  subject: "Science",
  joinCode: "SAMPA7",
};

interface SeedUser {
  id: string;
  name: string;
  role: Role;
  childId: string | null;
}

// Students come before the parent because child_id refers to a student row.
const SEED_USERS: SeedUser[] = [
  { id: SEED_IDS.teacherId, name: "Ms. Carmela Reyes", role: "teacher", childId: null },
  { id: MIGUEL, name: "Miguel Santos", role: "student", childId: null },
  { id: ALTHEA, name: "Althea Cruz", role: "student", childId: null },
  { id: JOSHUA, name: "Joshua Dela Cruz", role: "student", childId: null },
  { id: SEED_IDS.parentId, name: "Mrs. Liza Santos", role: "parent", childId: MIGUEL },
];

// --- lessons -----------------------------------------------------------------

// Facts-heavy: names and functions, so the AI leans towards objective items.
const PLANT_CELL_LESSON = `Every plant, from the smallest moss to the tallest narra tree, is made of cells. A cell is the smallest unit of a living thing that can carry out the work of life. Plant cells are too small to see with the eyes alone, but under a microscope each one looks like a tiny room with several parts inside. Each part has its own job.

Cell wall. The cell wall is the stiff outer layer of a plant cell. It is made mostly of cellulose. It gives the cell its shape and holds the plant upright, which is why a stem can stand without bones.

Cell membrane. Just inside the cell wall is the cell membrane. It is thin and flexible. The cell membrane controls what goes into and out of the cell. It lets water and nutrients in and lets waste out.

Cytoplasm. The cytoplasm is the jelly-like material that fills the cell. The other parts float in it, and many of the cell's chemical reactions happen there.

Nucleus. The nucleus is the control center of the cell. It holds the cell's DNA, which carries the instructions for how the cell grows, works and makes copies of itself.

Chloroplasts. Chloroplasts are small green parts found in the cells of leaves and other green parts of a plant. They contain chlorophyll, the green pigment that traps light. Chloroplasts use sunlight, water and carbon dioxide to make food for the plant. This process is called photosynthesis. Animal cells do not have chloroplasts.

Mitochondria. Mitochondria release the energy stored in food so that the cell can use it. This is why they are often called the powerhouse of the cell. A plant cell has both chloroplasts and mitochondria: chloroplasts make the food, and mitochondria release the energy from it.

Vacuole. The vacuole is a large sac in the middle of a plant cell. It stores water, dissolved nutrients and waste. When the vacuole is full of water, it presses against the cell wall and keeps the plant firm. When a plant does not get enough water, its vacuoles shrink and the plant wilts.

Ribosomes. Ribosomes are very tiny parts that build proteins. The cell needs proteins to grow and to repair itself.

Three parts make a plant cell easy to tell apart from an animal cell: the cell wall, the chloroplasts and the large central vacuole.

Together, the parts of a cell work like the workers in a small factory. Each one does a different job, and the cell stays alive only when all of them do their work.`;

// Concept-heavy: causes and effects, so the AI leans towards short answers.
const WATER_CYCLE_LESSON = `Water on Earth is never used up. It moves again and again between the sea, the air and the land. This movement, which has no beginning and no end, is called the water cycle. The energy that drives it comes from the Sun.

The cycle has four main steps.

Evaporation. The Sun heats the water in seas, rivers, lakes and wet soil. Some of the liquid water turns into an invisible gas called water vapor and rises into the air. Plants add to this. They take in water through their roots and release water vapor through their leaves, a process called transpiration.

Condensation. As water vapor rises, the air around it gets colder. The vapor cools and turns back into tiny drops of liquid water. Millions of these drops gather to form clouds.

Precipitation. When the drops in a cloud join together and become too heavy to stay in the air, they fall to the ground. In the Philippines this is almost always rain.

Collection. Rain that falls on land takes different paths. Some flows over the surface into streams and rivers and then back to the sea. This is called runoff. Some soaks into the soil and becomes groundwater, which feeds wells and springs. Then the cycle begins again.

Why does this matter to a farming community? Think of a barangay where most families grow rice. Rice needs flooded fields for much of its growth, so farmers depend on rain and on the rivers and irrigation canals that the rain fills. They plan the planting season around the months when rain is expected. If the rains come late, seedlings may dry out before they can be moved to the field, and planting and harvest are both delayed. If a dry spell lasts for months, rivers shrink, the water in wells drops, and there may not be enough water for every field.

Too much water is also a problem. Very heavy rain in a short time produces more runoff than the soil and the rivers can hold. Fields flood, young plants are washed away and the rich topsoil is carried off.

A community can work with the water cycle instead of against it. Trees on hillsides slow down runoff and help rain soak into the ground, which refills groundwater and reduces flooding. Their roots also hold the soil in place. Small ponds and tanks store rain for the dry months. Clear canals let water reach the fields that are far from the river.

Knowing how the water cycle works helps a farming community decide when to plant, how much water to save and how to protect the land that feeds it.`;

interface SeedLesson {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const SEED_LESSONS: SeedLesson[] = [
  {
    id: SEED_CONTENT_IDS.plantCellLessonId,
    title: "The parts of a plant cell",
    content: PLANT_CELL_LESSON,
    createdAt: "2026-09-21T00:15:00.000Z",
  },
  {
    id: SEED_CONTENT_IDS.waterCycleLessonId,
    title: "The water cycle and why it matters to a farming community",
    content: WATER_CYCLE_LESSON,
    createdAt: "2026-09-25T00:20:00.000Z",
  },
];

// --- activities --------------------------------------------------------------

interface SeedAnswer {
  response: string;
  score: number;
  feedback: string;
  gradedBy: GradedBy;
  confidence: number | null;
  needsReview: boolean;
}

interface SeedSubmission {
  id: string;
  studentId: string;
  submittedAt: string;
  /** One per item, in item order. */
  answers: SeedAnswer[];
  summary: ParentSummary | null;
}

interface SeedActivity {
  id: string;
  /** Prefix for the ids of this activity's items and answers. */
  slug: string;
  lessonId: string;
  title: string;
  instructions: string;
  type: ActivityType;
  aiReason: string;
  createdAt: string;
  publishedAt: string;
  items: ItemInput[];
  submissions: SeedSubmission[];
}

/** An answer settled by plain code against the answer key. */
function byCode(response: string, score: number, feedback: string): SeedAnswer {
  return { response, score, feedback, gradedBy: "code", confidence: null, needsReview: false };
}

/** An answer judged by the AI; flagged for the teacher below 0.7 confidence. */
function byAi(
  response: string,
  score: number,
  confidence: number,
  feedback: string,
): SeedAnswer {
  return {
    response,
    score,
    feedback,
    gradedBy: "ai",
    confidence,
    needsReview: confidence < 0.7,
  };
}

const MIGUEL_PLANT_CELL_SUMMARY: ParentSummary = {
  en: {
    overview:
      "Miguel answered an activity about the parts of a plant cell and what each part does. He scored 7 out of 10. He knows most of the parts and gave a complete explanation of why a plant wilts.",
    didWell: [
      "He knows that the cell membrane controls what goes into and out of the cell.",
      "He named the nucleus as the control center of the cell.",
      "He explained clearly how the vacuole keeps a plant firm.",
    ],
    toPractice: [
      "Telling chloroplasts and mitochondria apart. Chloroplasts make food using sunlight. Mitochondria release the energy from that food. He switched the two in two items.",
    ],
    homeTip:
      "Show Miguel a green leaf and ask him which part of its cells makes the food, and which part releases the energy from that food.",
  },
  fil: {
    overview:
      "Sumagot si Miguel ng gawain tungkol sa mga bahagi ng selula ng halaman at sa ginagawa ng bawat isa. Nakakuha siya ng 7 sa 10. Alam niya ang karamihan sa mga bahagi, at buo ang paliwanag niya kung bakit nalalanta ang halaman.",
    didWell: [
      "Alam niya na ang cell membrane ang kumokontrol sa pumapasok at lumalabas sa selula.",
      "Tama ang sagot niya na ang nucleus ang sentro ng kontrol ng selula.",
      "Malinaw niyang naipaliwanag kung paano tinutulungan ng vacuole na manatiling matigas ang halaman.",
    ],
    toPractice: [
      "Ang pagkakaiba ng chloroplast at mitochondria. Ang chloroplast ang gumagawa ng pagkain gamit ang sikat ng araw. Ang mitochondria naman ang naglalabas ng enerhiya mula sa pagkaing iyon. Napagpalit niya ang dalawa sa dalawang tanong.",
    ],
    homeTip:
      "Magpakita kay Miguel ng berdeng dahon at itanong kung aling bahagi ng selula nito ang gumagawa ng pagkain, at kung aling bahagi ang naglalabas ng enerhiya mula sa pagkaing iyon.",
  },
};

const SEED_ACTIVITIES: SeedActivity[] = [
  {
    id: SEED_CONTENT_IDS.plantCellActivityId,
    slug: "cell",
    lessonId: SEED_CONTENT_IDS.plantCellLessonId,
    title: "Parts of a plant cell",
    instructions:
      "Answer all six items. Read each question carefully before you answer. You can submit only once.",
    type: "mixed",
    aiReason:
      "This lesson is mostly the names of cell parts and what each one does, so quick objective items fit most of it. One short answer checks whether students can use a part's job to explain what happens to a real plant.",
    createdAt: "2026-09-21T00:40:00.000Z",
    publishedAt: "2026-09-21T01:05:00.000Z",
    items: [
      {
        type: "multiple_choice",
        question: "Which part of a plant cell controls what goes into and out of the cell?",
        choices: ["Cell wall", "Cell membrane", "Nucleus", "Vacuole"],
        answerKey: "Cell membrane",
        acceptedAnswers: [],
        rubric: null,
        explanation:
          "The cell membrane is the thin layer just inside the cell wall. It lets water and nutrients in and lets waste out.",
        points: 1,
      },
      {
        type: "multiple_choice",
        question: "Which part of a plant cell makes food using sunlight?",
        choices: ["Mitochondria", "Ribosomes", "Chloroplasts", "Cytoplasm"],
        answerKey: "Chloroplasts",
        acceptedAnswers: [],
        rubric: null,
        explanation:
          "Chloroplasts contain chlorophyll, which traps light. They use sunlight, water and carbon dioxide to make food.",
        points: 1,
      },
      {
        type: "true_false",
        question: "Animal cells have chloroplasts.",
        choices: ["True", "False"],
        answerKey: "False",
        acceptedAnswers: [],
        rubric: null,
        explanation:
          "Only plant cells have chloroplasts. They are one of the three parts that set a plant cell apart from an animal cell.",
        points: 1,
      },
      {
        type: "identification",
        question: "What part is the control center of the cell and holds its DNA?",
        choices: null,
        answerKey: "Nucleus",
        acceptedAnswers: ["Cell nucleus", "Nucleus of the cell"],
        rubric: null,
        explanation:
          "The nucleus holds the DNA, which carries the instructions for how the cell grows and works.",
        points: 2,
      },
      {
        type: "identification",
        question:
          "What part releases the energy stored in food and is often called the powerhouse of the cell?",
        choices: null,
        answerKey: "Mitochondria",
        acceptedAnswers: ["Mitochondrion"],
        rubric: null,
        explanation:
          "Mitochondria release the energy stored in food so that the cell can use it.",
        points: 2,
      },
      {
        type: "short_answer",
        question:
          "A plant that has not been watered for several days starts to wilt. Use what you know about the vacuole to explain why.",
        choices: null,
        answerKey:
          "The vacuole stores water. When the plant gets no water, the vacuole shrinks and stops pressing against the cell wall, so the cells lose their firmness and the plant wilts.",
        acceptedAnswers: [],
        rubric:
          "3 points: says that the vacuole stores water, that it shrinks or loses water when the plant is not watered, and that it then stops pressing against the cell wall so the plant loses its firmness. 2 points: gives two of these ideas. 1 point: gives one of these ideas. 0 points: gives none of them.",
        explanation:
          "A full vacuole presses against the cell wall and keeps the plant firm. Without water the vacuole shrinks, the pressure is lost and the plant droops.",
        points: 3,
      },
    ],
    submissions: [
      {
        id: "submission-cell-althea",
        studentId: ALTHEA,
        submittedAt: "2026-09-22T02:10:00.000Z",
        summary: null,
        answers: [
          byCode("Cell membrane", 1, "Correct."),
          byCode("Chloroplasts", 1, "Correct."),
          byCode("False", 1, "Correct."),
          byCode("Nucleus", 2, "Correct."),
          byCode("Mitochondria", 2, "Correct."),
          byAi(
            "The vacuole stores water for the cell. If the plant has no water the vacuole becomes small, so the plant wilts.",
            2,
            0.88,
            "You said that the vacuole stores water and that it shrinks without it. To complete the answer, add that a full vacuole presses against the cell wall and keeps the plant firm.",
          ),
        ],
      },
      {
        id: "submission-cell-miguel",
        studentId: MIGUEL,
        submittedAt: "2026-09-22T02:24:00.000Z",
        summary: MIGUEL_PLANT_CELL_SUMMARY,
        answers: [
          byCode("Cell membrane", 1, "Correct."),
          byCode("Mitochondria", 0, 'The correct answer is "Chloroplasts".'),
          byCode("False", 1, "Correct."),
          byCode("nucleus", 2, "Correct."),
          byAi(
            "Chloroplast",
            0,
            0.96,
            "Chloroplasts make the food. The part that releases the energy from that food is the mitochondria.",
          ),
          byAi(
            "The vacuole holds the water of the cell. When the plant has no water the vacuole gets smaller and it cannot push on the cell wall anymore, so the plant becomes soft and wilts.",
            3,
            0.92,
            "You explained that the vacuole stores water, shrinks without it and stops pushing on the cell wall. That is a complete answer.",
          ),
        ],
      },
      {
        id: "submission-cell-joshua",
        studentId: JOSHUA,
        submittedAt: "2026-09-22T11:42:00.000Z",
        summary: null,
        answers: [
          byCode("Cell wall", 0, 'The correct answer is "Cell membrane".'),
          byCode("Chloroplasts", 1, "Correct."),
          byCode("True", 0, 'The correct answer is "False".'),
          byCode("Nucleus", 2, "Correct."),
          byAi(
            "mitocondria",
            2,
            0.9,
            "Correct. Check the spelling: mitochondria.",
          ),
          byAi(
            "The vacuole has no more water so the plant is weak.",
            1,
            0.84,
            "You said that the vacuole runs out of water, which is one of the ideas. Add that the vacuole stores water and presses against the cell wall to keep the plant firm.",
          ),
        ],
      },
    ],
  },
  {
    id: SEED_CONTENT_IDS.waterCycleActivityId,
    slug: "water",
    lessonId: SEED_CONTENT_IDS.waterCycleLessonId,
    title: "The water cycle and our farms",
    instructions:
      "Answer all five items. For the last two, write two or three sentences in your own words. You can submit only once.",
    type: "mixed",
    aiReason:
      "This lesson is about causes and effects, so most of the points go to short answers that ask students to explain. Three quick items first check the key ideas and terms.",
    createdAt: "2026-09-25T00:45:00.000Z",
    publishedAt: "2026-09-25T01:10:00.000Z",
    items: [
      {
        type: "multiple_choice",
        question: "Where does the energy that drives the water cycle come from?",
        choices: ["The Moon", "The Sun", "The wind", "The sea"],
        answerKey: "The Sun",
        acceptedAnswers: [],
        rubric: null,
        explanation:
          "Heat from the Sun turns liquid water into water vapor, which starts the cycle.",
        points: 1,
      },
      {
        type: "true_false",
        question: "Rain that soaks into the soil becomes groundwater, which feeds wells and springs.",
        choices: ["True", "False"],
        answerKey: "True",
        acceptedAnswers: [],
        rubric: null,
        explanation:
          "Some rain flows over the surface as runoff. The rest soaks into the soil and becomes groundwater.",
        points: 1,
      },
      {
        type: "identification",
        question:
          "What is the step called when water vapor cools and turns back into tiny drops of liquid water?",
        choices: null,
        answerKey: "Condensation",
        acceptedAnswers: ["Condensing"],
        rubric: null,
        explanation:
          "In condensation, rising water vapor cools and turns into tiny drops that gather to form clouds.",
        points: 2,
      },
      {
        type: "short_answer",
        question:
          "The rains arrive a month later than usual. Explain how this affects rice farmers.",
        choices: null,
        answerKey:
          "Rice needs flooded fields, and farmers plan their planting around the months when rain is expected. If the rain is late, the fields and canals do not have enough water, seedlings may dry out before they are moved to the field, and planting and harvest are delayed.",
        acceptedAnswers: [],
        rubric:
          "3 points: explains that rice needs a lot of water or flooded fields, that farmers time their planting by the rain, and gives one effect of late rain, such as seedlings drying out, late planting or a late harvest. 2 points: gives two of these ideas. 1 point: gives one of these ideas. 0 points: gives none of them.",
        explanation:
          "Rice grows in flooded fields, so farmers plant when the rain is expected. Late rain means dry seedlings and a later planting and harvest.",
        points: 3,
      },
      {
        type: "short_answer",
        question:
          "Give two ways that trees on hillsides help a farming community during heavy rain.",
        choices: null,
        answerKey:
          "Trees slow down runoff, so less water rushes into the fields and there is less flooding. They also help rain soak into the ground, and their roots hold the soil in place so the topsoil is not carried off.",
        acceptedAnswers: [],
        rubric:
          "3 points: gives two correct ways, such as slowing runoff, reducing floods, helping rain soak into the ground or holding the soil in place, and explains at least one of them. 2 points: gives two correct ways without explaining, or one way with a clear explanation. 1 point: gives one correct way without explaining. 0 points: gives no correct way.",
        explanation:
          "Trees slow runoff and help rain soak into the ground, which reduces flooding. Their roots also keep the topsoil from being washed away.",
        points: 3,
      },
    ],
    submissions: [
      {
        id: "submission-water-althea",
        studentId: ALTHEA,
        submittedAt: "2026-09-28T02:05:00.000Z",
        summary: null,
        answers: [
          byCode("The Sun", 1, "Correct."),
          byCode("True", 1, "Correct."),
          byCode("condensation", 2, "Correct."),
          byAi(
            "Rice needs a lot of water in the field. Farmers plant when the rainy season starts, so if the rain is late the seedlings can dry up and they will plant late and harvest late.",
            3,
            0.93,
            "You explained that rice needs a lot of water, that farmers plant by the rain, and what happens when the rain is late. That is a complete answer.",
          ),
          byAi(
            "Trees slow the water going down the hill and help the rain go into the ground.",
            2,
            0.85,
            "You gave two correct ways. To earn the last point, explain one of them, for example how slower runoff means less flooding in the fields.",
          ),
        ],
      },
      {
        id: "submission-water-joshua",
        studentId: JOSHUA,
        submittedAt: "2026-09-29T10:30:00.000Z",
        summary: null,
        answers: [
          byCode("The Sun", 1, "Correct."),
          byCode("True", 1, "Correct."),
          byAi(
            "Evaporation",
            0,
            0.97,
            "Evaporation is when liquid water turns into water vapor. When the vapor cools and turns back into drops, it is called condensation.",
          ),
          // Low confidence on purpose: this is the answer the teacher overrides in the demo.
          byAi(
            "The farmers will wait for the rain and the palay will be late.",
            1,
            0.45,
            "Your answer says that the rice will be late, which is one effect. It is not clear whether you also mean that rice needs the rain to grow.",
          ),
          byAi(
            "The roots of the trees hold the soil so it will not be washed away, and the trees make the water flow slower so there is less flood.",
            3,
            0.9,
            "You gave two correct ways and explained both. That is a complete answer.",
          ),
        ],
      },
    ],
  },
];

// --- inserting ---------------------------------------------------------------

async function insertSampleData(query: QueryFn): Promise<void> {
  // Ignoring conflicts makes this safe if two server instances start at the
  // same moment and both find the database empty.
  const options = { ignoreConflicts: true };

  await insertRows(
    query,
    "classes",
    ["id", "name", "grade_level", "subject", "join_code"],
    [
      [
        SEED_CLASS.id,
        SEED_CLASS.name,
        SEED_CLASS.gradeLevel,
        SEED_CLASS.subject,
        SEED_CLASS.joinCode,
      ],
    ],
    options,
  );

  await insertRows(
    query,
    "users",
    ["id", "name", "role", "class_id", "child_id"],
    SEED_USERS.map((user) => [user.id, user.name, user.role, SEED_CLASS.id, user.childId]),
    options,
  );

  await insertRows(
    query,
    "lessons",
    ["id", "class_id", "title", "content", "created_at::timestamptz"],
    SEED_LESSONS.map((lesson) => [
      lesson.id,
      SEED_CLASS.id,
      lesson.title,
      lesson.content,
      lesson.createdAt,
    ]),
    options,
  );

  await insertRows(
    query,
    "activities",
    [
      "id",
      "lesson_id",
      "class_id",
      "title",
      "instructions",
      "type",
      "ai_reason",
      "status",
      "ai_provider",
      "ai_model",
      "created_at::timestamptz",
      "published_at::timestamptz",
    ],
    SEED_ACTIVITIES.map((activity) => [
      activity.id,
      activity.lessonId,
      SEED_CLASS.id,
      activity.title,
      activity.instructions,
      activity.type,
      activity.aiReason,
      "published",
      "mock",
      "sample-data",
      activity.createdAt,
      activity.publishedAt,
    ]),
    options,
  );

  const itemId = (activity: SeedActivity, index: number) =>
    `item-${activity.slug}-${index + 1}`;

  await insertRows(
    query,
    "items",
    [
      "id",
      "activity_id",
      "position",
      "type",
      "question",
      "choices::jsonb",
      "answer_key",
      "accepted_answers::jsonb",
      "rubric",
      "explanation",
      "points",
    ],
    SEED_ACTIVITIES.flatMap((activity) =>
      activity.items.map((item, index) => [
        itemId(activity, index),
        activity.id,
        index + 1,
        item.type,
        item.question,
        toJsonb(item.choices),
        item.answerKey,
        toJsonb(item.acceptedAnswers),
        item.rubric,
        item.explanation,
        item.points,
      ]),
    ),
    options,
  );

  await insertRows(
    query,
    "submissions",
    [
      "id",
      "activity_id",
      "student_id",
      "total_score",
      "max_score",
      "needs_review",
      "summary::jsonb",
      "summary_provider",
      "grading_provider",
      "submitted_at::timestamptz",
    ],
    SEED_ACTIVITIES.flatMap((activity) => {
      const maxScore = activity.items.reduce((sum, item) => sum + item.points, 0);
      return activity.submissions.map((submission) => {
        if (submission.answers.length !== activity.items.length) {
          throw new Error(`Sample data: ${submission.id} must answer every item.`);
        }
        return [
          submission.id,
          activity.id,
          submission.studentId,
          submission.answers.reduce((sum, answer) => sum + answer.score, 0),
          maxScore,
          submission.answers.some((answer) => answer.needsReview),
          toJsonb(submission.summary),
          submission.summary ? "mock" : null,
          // The sample grades were written by hand, so they are labelled as
          // sample output and never as the work of a real AI service.
          submission.answers.some((answer) => answer.gradedBy === "ai") ? "mock" : null,
          submission.submittedAt,
        ];
      });
    }),
    options,
  );

  await insertRows(
    query,
    "answers",
    [
      "id",
      "submission_id",
      "item_id",
      "response",
      "score",
      "feedback",
      "graded_by",
      "confidence",
      "needs_review",
    ],
    SEED_ACTIVITIES.flatMap((activity) =>
      activity.submissions.flatMap((submission) =>
        submission.answers.map((answer, index) => [
          `answer-${submission.id.replace("submission-", "")}-${index + 1}`,
          submission.id,
          itemId(activity, index),
          answer.response,
          answer.score,
          answer.feedback,
          answer.gradedBy,
          answer.confidence,
          answer.needsReview,
        ]),
      ),
    ),
    options,
  );
}

/** Inserts the sample data if the classes table is empty. */
export async function seedIfEmpty(db: Db): Promise<void> {
  await db.transaction(async (query) => {
    const [row] = await query<{ count: number }>(
      "select count(*)::int as count from classes",
    );
    if (row && row.count > 0) return;
    await insertSampleData(query);
  });
}

/** Deletes every row and inserts the sample data again. */
export async function resetAndSeed(db: Db): Promise<void> {
  await db.transaction(async (query) => {
    // Table names come from the TABLES constant, not from user input.
    await query(`truncate table ${TABLES.join(", ")} cascade`);
    await insertSampleData(query);
  });
}
