// Offline sample mode: stand-ins for the four AI tasks, used when no AI key is
// configured (provider "mock"). There is no model and no network here. Each
// function builds its output from the input with plain code, always gives the
// same output for the same input, and says in its text that it is a sample
// made without AI. The task files wrap these results with provider "mock".

import type { GeneratedActivity, ItemInput, ItemType, ParentSummary } from "../types";
import { clip, collapse, fold, formatScore } from "./prompts";
import type {
  FreeTextAnswer,
  FreeTextGrade,
  GenerateActivityInput,
  GradeFreeTextInput,
  ParentSummaryInput,
  ResultItem,
  TutorInput,
} from "./types";

/** Below the review threshold on purpose: a sample grade always goes to the teacher. */
export const MOCK_CONFIDENCE = 0.4;

// --- Text helpers ------------------------------------------------------------

interface Token {
  text: string;
  start: number;
  end: number;
}

// Latin letters with accents and ñ cover English and Filipino.
const WORD = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:['’-][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g;
const WORD_CHAR = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(WORD)) {
    const start = match.index ?? 0;
    tokens.push({ text: match[0], start, end: start + match[0].length });
  }
  return tokens;
}

/** Lowercase without accents. */
function plain(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** A very light stem, so that "plants" and "plant" count as the same word. */
function stem(word: string): string {
  const base = plain(word).replace(/['’]s$/, "");
  if (base.length > 4 && /(ches|shes|sses|xes|zes)$/.test(base)) return base.slice(0, -2);
  if (base.length > 3 && base.endsWith("s") && !base.endsWith("ss")) return base.slice(0, -1);
  return base;
}

const STOPWORDS = new Set(
  (
    "a an the and or but nor so yet if then than that this these those there here it its " +
    "is are was were be been being am do does did done has have had having will would can " +
    "could shall should may might must not no yes of in on at to from by for with without " +
    "into onto over under about above below between among through during before after as " +
    "also such very more most much many some any all each every both either neither other " +
    "another same own only just too he she they we you i him her them us me his their our " +
    "your my who whom whose which what when where why how up down out off again once because " +
    "while until although though like called named known use used uses using make makes made " +
    "one two three first second way ways thing things part parts kind kinds type types " +
    // Filipino
    "ang ng mga sa na ay at ito iyon iyan siya sila kami tayo kayo ako ikaw ka ko mo niya " +
    "nila namin natin ninyo kung para mula nang din rin ni kay si sina isang may mayroon " +
    "hindi wala oo pa ba po naman lang lamang dahil kasi pero ngunit subalit o kaya upang " +
    "nito niyon dito diyan doon ano sino saan kailan bakit paano alin bawat lahat iba " +
    "tinatawag tulad gaya tumutukoy halimbawa"
  ).split(" "),
);

function isImportant(word: string): boolean {
  if (/^\d+$/.test(word)) return word.length >= 2;
  return word.length >= 4 && !STOPWORDS.has(plain(word)) && !STOPWORDS.has(stem(word));
}

/** The distinct stems of the words that carry meaning, in order of appearance. */
function importantStems(text: string): string[] {
  const seen = new Set<string>();
  for (const token of tokenize(text)) {
    if (isImportant(token.text)) seen.add(stem(token.text));
  }
  return [...seen];
}

/** The meaningful words as written, without repeats, for showing in a rubric. */
function keywords(text: string, max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const tokens = tokenize(text);
  for (const [index, token] of tokens.entries()) {
    if (!isImportant(token.text) || seen.has(stem(token.text))) continue;
    seen.add(stem(token.text));
    // The first word of a sentence is capitalised by position, not because it is a name.
    out.push(index === 0 ? token.text.toLowerCase() : token.text);
    if (out.length === max) break;
  }
  return out;
}

function isCapitalised(word: string): boolean {
  return /^[A-ZÀ-ÖØ-Þ]/.test(word);
}

function isNumber(word: string): boolean {
  return /^\d+$/.test(word);
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  const boundary = /[.!?]+["”’')\]]*\s+(?=[A-ZÀ-ÖØ-Þ0-9"“‘(])/g;
  let start = 0;
  for (const match of line.matchAll(boundary)) {
    const end = (match.index ?? 0) + match[0].length;
    out.push(line.slice(start, end).trim());
    start = end;
  }
  out.push(line.slice(start).trim());
  return out.filter((sentence) => sentence !== "");
}

/** Sentences of the lesson, without list markers and without repeats. */
function splitSentences(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rawLine of content.replace(/\r\n?/g, "\n").split("\n")) {
    const line = collapse(rawLine.replace(/^\s*(?:[-*•#>]+|\d{1,2}[.)])\s*/, ""));
    for (const sentence of splitLine(line)) {
      const key = fold(sentence);
      if (key === "" || seen.has(key)) continue;
      seen.add(key);
      out.push(sentence);
    }
  }
  return out;
}

// Sentences that start like this usually need the one before them to make sense.
const LEANS_ON_CONTEXT =
  /^(it|its|they|their|them|this|these|those|that|he|she|his|her|we|our|you|your|however|also|then|but|and|so|because|for example|for instance|in addition|such|here|there|halimbawa)\b/i;

function isStatement(sentence: string, strict: boolean): boolean {
  const count = tokenize(sentence).length;
  if (count < (strict ? 6 : 4) || count > 40 || sentence.length > 260) return false;
  if (/[?:]["”’')\]]*$/.test(sentence)) return false;
  if (!strict) return true;
  return /[.!]["”’')\]]*$/.test(sentence) && !LEANS_ON_CONTEXT.test(sentence);
}

function withFullStop(sentence: string): string {
  return /[.!]["”’')\]]*$/.test(sentence) ? sentence : `${sentence}.`;
}

function quote(text: string, max: number): string {
  return `“${clip(collapse(text), max)}”`;
}

// --- 1. Activity ---------------------------------------------------------------

const BLANK = "______";
const TERM_CUES = new Set(["called", "named", "termed", "known", "tinatawag"]);
const LINKERS = new Set(["a", "an", "the", "as", "na", "ng"]);
// "Evaporation is ...", "Evaporation happens when ...": the first word is being defined.
const DEFINING_VERBS = new Set([
  "is",
  "are",
  "was",
  "were",
  "means",
  "happens",
  "occurs",
  "refers",
  "ay",
]);

// The word after one of these is usually a thing, not an action, and things
// make better blanks ("through its ______" rather than "the plant ______ in").
const NOUN_MARKERS = new Set(
  (
    "a an the its their his her this these those of in on at through into from with by for " +
    "ang ng sa mga si ni kay"
  ).split(" "),
);

type TermKind = "number" | "name" | "word";

function kindOf(term: string): TermKind {
  if (isNumber(term)) return "number";
  return isCapitalised(term) ? "name" : "word";
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What plain code can tell about a lesson's words without understanding them. */
interface WordStats {
  /** How often each stem appears in the lesson. */
  frequency: Map<string, number>;
  /** Words seen without a capital, so a capital at a sentence start is not read as a name. */
  lowercase: Set<string>;
}

function countWords(content: string): WordStats {
  const frequency = new Map<string, number>();
  const lowercase = new Set<string>();
  for (const token of tokenize(content)) {
    if (token.text === token.text.toLowerCase()) lowercase.add(token.text);
    if (isImportant(token.text)) {
      frequency.set(stem(token.text), (frequency.get(stem(token.text)) ?? 0) + 1);
    }
  }
  return { frequency, lowercase };
}

/**
 * The word in a sentence most worth asking about: a term introduced by
 * "called", the word a sentence defines, a name, a number, or a long word
 * the lesson comes back to.
 */
function pickTerm(sentence: string, stats: WordStats): string | null {
  const tokens = tokenize(sentence);
  let lastImportant = -1;
  for (let index = 0; index < tokens.length; index++) {
    if (isImportant(tokens[index].text)) lastImportant = index;
  }

  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < tokens.length; index++) {
    const word = tokens[index].text;
    if (!isImportant(word)) continue;
    const uses = stats.frequency.get(stem(word)) ?? 0;
    // A word used a few times is a topic of the lesson; one used everywhere is too easy.
    let score = Math.min(word.length, 12) / 4 + (uses >= 4 ? 1 : uses >= 2 ? 2 : 0);
    if (isNumber(word)) score += 2;
    // New information tends to come at the end of a sentence.
    if (index === lastImportant) score += 1.5;
    if (index === 0) {
      const next = tokens.length > 1 ? plain(tokens[1].text) : "";
      if (DEFINING_VERBS.has(next)) score += 3;
    } else {
      if (isCapitalised(word)) score += 3;
      const previous = plain(tokens[index - 1].text);
      if (NOUN_MARKERS.has(previous)) score += 1.5;
      const before = index > 1 ? plain(tokens[index - 2].text) : "";
      if (TERM_CUES.has(previous) || (LINKERS.has(previous) && TERM_CUES.has(before))) score += 6;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  if (bestIndex < 0) return null;

  if (bestIndex === 0) {
    const word = tokens[0].text;
    return stats.lowercase.has(word.toLowerCase()) ? word.toLowerCase() : word;
  }

  // Keep names of more than one word whole, e.g. both words of a person's name.
  let first = bestIndex;
  let last = bestIndex;
  if (isCapitalised(tokens[bestIndex].text)) {
    const joined = (left: Token, right: Token) =>
      sentence.slice(left.end, right.start) === " " &&
      isCapitalised(left.text) &&
      isCapitalised(right.text);
    while (first > 1 && joined(tokens[first - 1], tokens[first])) first--;
    while (last < tokens.length - 1 && joined(tokens[last], tokens[last + 1])) last++;
  }
  return sentence.slice(tokens[first].start, tokens[last].end);
}

/** Replaces every whole-word occurrence of the term with a blank. */
function blankOut(sentence: string, term: string): string {
  const haystack = sentence.toLowerCase();
  const needle = term.toLowerCase();
  let out = "";
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    const end = at + needle.length;
    const wholeWord =
      (at === 0 || !WORD_CHAR.test(haystack[at - 1])) &&
      (end >= haystack.length || !WORD_CHAR.test(haystack[end]));
    out += sentence.slice(from, at) + (wholeWord ? BLANK : sentence.slice(at, end));
    from = end;
  }
  return out + sentence.slice(from);
}

/** Turns a statement into its opposite, or returns null when that is not safe to do. */
function negate(sentence: string): string | null {
  if (/\b(not|never|no|none|cannot|neither|nor|hindi|wala)\b|n['’]t\b/i.test(sentence)) return null;
  const match = /\b(is|are|was|were|can|will)\b(?! (only|also|both|either)\b)/.exec(sentence);
  if (match === null) return null;
  const replacement = match[1] === "can" ? "cannot" : `${match[1]} not`;
  return sentence.slice(0, match.index) + replacement + sentence.slice(match.index + match[1].length);
}

function objectiveItem(
  type: "true_false" | "identification" | "multiple_choice",
  question: string,
  choices: string[] | null,
  answerKey: string,
  sentence: string,
): ItemInput {
  return {
    type,
    question,
    choices,
    answerKey,
    acceptedAnswers: [],
    rubric: null,
    explanation: `The lesson says: ${quote(sentence, 300)}`,
    points: 1,
  };
}

function trueStatementItem(sentence: string): ItemInput {
  return objectiveItem("true_false", sentence, ["True", "False"], "True", sentence);
}

function falseStatementItem(sentence: string): ItemInput | null {
  const negated = negate(sentence);
  if (negated === null) return null;
  return objectiveItem("true_false", negated, ["True", "False"], "False", sentence);
}

function identificationItem(sentence: string, term: string): ItemInput {
  const question = `Fill in the blank: ${blankOut(sentence, term)}`;
  return objectiveItem("identification", question, null, term, sentence);
}

interface DistractorPools {
  /** The terms picked from the other sentences: the best wrong options. */
  terms: string[];
  /** Other meaningful words of the lesson, used when the terms run out. */
  words: string[];
}

/** Wrong options for a blank, preferring terms of the same kind as the answer. */
function pickDistractors(
  term: string,
  sentence: string,
  pools: DistractorPools,
  slot: number,
): string[] {
  const kind = kindOf(term);
  const inSentence = new Set(tokenize(sentence).map((token) => stem(token.text)));
  const usable = (pool: string[]) =>
    pool.filter(
      (other) =>
        stem(other) !== stem(term) &&
        !fold(term).includes(fold(other)) &&
        !tokenize(other).some((token) => inSentence.has(stem(token.text))),
    );
  const terms = usable(pools.terms);
  const words = usable(pools.words);

  let candidates: string[];
  if (kind === "number") {
    // Too few numbers in the lesson: nearby numbers make believable wrong options.
    const value = Number(term);
    const nearby = [value + 1, value - 1, value + 10, value - 10]
      .filter((n) => n > 0)
      .map(String);
    candidates = [...[...terms, ...words].filter((other) => kindOf(other) === "number"), ...nearby];
  } else {
    const sameKind = terms.filter((other) => kindOf(other) === kind);
    // Start at a different term for each item so the same wrong options do not repeat.
    const start = sameKind.length > 0 ? slot % sameKind.length : 0;
    candidates = [
      ...sameKind.slice(start),
      ...sameKind.slice(0, start),
      // Same kind first: a lone capital letter among the options would give the answer away.
      ...words.filter((other) => kindOf(other) === kind),
      ...terms.filter((other) => kindOf(other) !== "number"),
      ...words.filter((other) => kindOf(other) !== "number"),
    ];
  }

  const seen = new Set<string>([fold(term)]);
  const out: string[] = [];
  for (const candidate of candidates) {
    if (seen.has(fold(candidate))) continue;
    seen.add(fold(candidate));
    out.push(candidate);
    if (out.length === 3) break;
  }
  return out;
}

function multipleChoiceItem(
  sentence: string,
  term: string,
  pools: DistractorPools,
  slot: number,
): ItemInput | null {
  const distractors = pickDistractors(term, sentence, pools, slot);
  if (distractors.length < 2) return null;
  const blanked = blankOut(sentence, term);
  // A blank that opens the sentence would give the answer away by its capital letter.
  const shown = (choice: string) => (blanked.startsWith(BLANK) ? capitalise(choice) : choice);
  const choices = distractors.map(shown);
  choices.splice(slot % (distractors.length + 1), 0, shown(term));
  return objectiveItem(
    "multiple_choice",
    `Choose the answer that completes the sentence: ${blanked}`,
    choices,
    shown(term),
    sentence,
  );
}

function shortAnswerItem(question: string, modelAnswer: string): ItemInput {
  const ideas = keywords(modelAnswer, 6);
  const rubric =
    ideas.length > 0
      ? `A full answer is in the learner's own words and includes these ideas from the lesson: ${ideas.join(", ")}. Give part marks when only some of them are there.`
      : "A full answer is in the learner's own words and matches what the lesson says. Give part marks for an answer that is partly right.";
  return {
    type: "short_answer",
    question,
    choices: null,
    answerKey: modelAnswer,
    acceptedAnswers: [],
    rubric,
    explanation: `One good answer: ${clip(modelAnswer, 400)}`,
    points: 2,
  };
}

// A true_false slot is filled by a true statement or by a negated one.
type Recipe = ItemType | "false_statement";

const OBJECTIVE_ROTATION: ItemType[] = ["true_false", "identification", "multiple_choice"];

/** The item type wanted for each slot of the activity. */
function planTypes(
  preferredType: GenerateActivityInput["preferredType"],
  count: number,
): ItemType[] {
  if (preferredType !== "auto" && preferredType !== "mixed") {
    return Array.from({ length: count }, () => preferredType);
  }
  const plan = Array.from(
    { length: count - 1 },
    (_, slot) => OBJECTIVE_ROTATION[slot % OBJECTIVE_ROTATION.length],
  );
  return [...plan, "short_answer"];
}

const SAMPLE_REASON =
  "This is a sample activity made without AI: the items were built by picking sentences from the lesson. Add an AI key to have the format chosen and the questions written by AI.";

/**
 * Builds a simple activity from the sentences of the lesson: true or false
 * statements, fill-in-the-blank items and a short answer about the main idea.
 */
export function mockGenerateActivity(input: GenerateActivityInput): GeneratedActivity {
  const count = Math.min(
    30,
    Math.max(3, Number.isFinite(input.itemCount) ? Math.round(input.itemCount) : 10),
  );
  const title = collapse(input.lessonTitle);
  const lessonName = title ? `the lesson ${quote(title, 100)}` : "this lesson";

  const sentences = splitSentences(input.lessonContent);
  let statements = sentences.filter((sentence) => isStatement(sentence, true));
  if (statements.length < 3) {
    statements = sentences.filter((sentence) => isStatement(sentence, false)).map(withFullStop);
  }

  const stats = countWords(input.lessonContent);
  const terms = statements.map((sentence) => pickTerm(sentence, stats));
  const pools: DistractorPools = {
    terms: terms.filter((term): term is string => term !== null),
    words: tokenize(statements.join(" "))
      .filter((token) => isImportant(token.text))
      .map((token) =>
        stats.lowercase.has(token.text.toLowerCase()) ? token.text.toLowerCase() : token.text,
      ),
  };

  const mainIdea = shortAnswerItem(
    `In two or three sentences, explain the main idea of ${lessonName} in your own words.`,
    clip(statements.slice(0, 2).join(" ") || collapse(input.lessonContent), 600) ||
      "Answers will vary. Check that the answer matches the lesson.",
  );

  const build = (recipe: Recipe, index: number, slot: number): ItemInput | null => {
    const sentence = statements[index];
    const term = terms[index];
    switch (recipe) {
      case "true_false":
        return trueStatementItem(sentence);
      case "false_statement":
        return falseStatementItem(sentence);
      case "identification":
        return term === null ? null : identificationItem(sentence, term);
      case "multiple_choice":
        return term === null ? null : multipleChoiceItem(sentence, term, pools, slot);
      case "short_answer":
        return term === null
          ? null
          : shortAnswerItem(
              `What does the lesson say about ${quote(term, 80)}? Answer in one or two sentences.`,
              sentence,
            );
    }
  };

  const items: ItemInput[] = [];
  const usedQuestions = new Set<string>();
  const usedSentences = new Set<number>();
  const usedPairs = new Set<string>();
  const usedKeys = new Set<string>();
  let cursor = 0;

  const asksForTerm = (item: ItemInput) =>
    item.type === "identification" || item.type === "multiple_choice";

  const add = (item: ItemInput) => {
    items.push(item);
    usedQuestions.add(fold(item.question));
    if (asksForTerm(item)) usedKeys.add(fold(item.answerKey));
  };

  // The same sentence must not appear both as a true and as a false statement.
  const pairKey = (recipe: Recipe, index: number) =>
    `${recipe === "false_statement" ? "true_false" : recipe}:${index}`;

  /**
   * Fills one slot. The first round only takes sentences and answers that
   * have not been used; the second round reuses a sentence for another type.
   */
  const fill = (wanted: ItemType, slot: number): boolean => {
    const others = OBJECTIVE_ROTATION.filter((type) => type !== wanted);
    // Every second true or false item is a false statement, when one can be made.
    const wantsFalse =
      wanted === "true_false" &&
      items.filter((item) => item.type === "true_false").length % 2 === 1;
    const recipes: Recipe[] = wantsFalse
      ? ["false_statement", wanted, ...others]
      : [wanted, ...others];

    for (const freshOnly of [true, false]) {
      for (const recipe of recipes) {
        for (let offset = 0; offset < statements.length; offset++) {
          const index = (cursor + offset) % statements.length;
          const taken = freshOnly
            ? usedSentences.has(index)
            : usedPairs.has(pairKey(recipe, index));
          if (taken) continue;
          const item = build(recipe, index, slot);
          if (item === null || usedQuestions.has(fold(item.question))) continue;
          if (freshOnly && asksForTerm(item) && usedKeys.has(fold(item.answerKey))) continue;
          add(item);
          usedSentences.add(index);
          usedPairs.add(pairKey(recipe, index));
          cursor = index + 1;
          return true;
        }
      }
    }
    return false;
  };

  const plan = planTypes(input.preferredType, count);
  const mixed = input.preferredType === "auto" || input.preferredType === "mixed";
  for (const [slot, wanted] of plan.entries()) {
    // The main-idea question closes a mixed activity and opens an all-short-answer one.
    const wantsMainIdea = wanted === "short_answer" && (mixed || slot === 0);
    if (wantsMainIdea) add(mainIdea);
    else if (!fill(wanted, slot)) break;
  }

  // A lesson with almost no usable sentences still gets a complete activity.
  const fillers = [
    mainIdea,
    shortAnswerItem(`Write one thing you learned from ${lessonName}.`, mainIdea.answerKey),
    shortAnswerItem(`Give one example from ${lessonName} and explain it.`, mainIdea.answerKey),
  ];
  for (const filler of fillers) {
    if (items.length >= 3) break;
    if (!usedQuestions.has(fold(filler.question))) add(filler);
  }

  const types = new Set(items.map((item) => item.type));
  return {
    title: clip(title ? `Sample activity: ${title}` : "Sample activity", 120),
    instructions: "Answer each question using what you learned in the lesson.",
    type: types.size === 1 ? items[0].type : "mixed",
    reason: SAMPLE_REASON,
    items,
  };
}

// --- 2. Grading ------------------------------------------------------------------

const SAMPLE_CHECK_NOTE =
  "This is a sample check made without AI, so your teacher will confirm the score.";

// Words a rubric uses to talk about marking, which are not ideas from the lesson.
const RUBRIC_WORDS = new Set(
  (
    "answer answers full part partial mark marks point points credit give gives award " +
    "learner student mention mentions explain explains include includes idea ideas lesson " +
    "correct own word words there when must needs need say says state states"
  )
    .split(" ")
    .map(stem),
);

/** Lowercase, no accents, no punctuation, no leading article. */
function comparable(text: string): string {
  return collapse(plain(text).replace(/[^a-z0-9 ]+/g, " ")).replace(/^(the|a|an|ang|si) /, "");
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** How many wrong letters still count as the same word: none for short words. */
function spellingTolerance(target: string): number {
  if (target.length <= 3) return 0;
  return target.length <= 7 ? 1 : 2;
}

function matchesIdentification(answer: FreeTextAnswer): boolean {
  const response = comparable(answer.response);
  if (response === "") return false;
  return [answer.answerKey, ...answer.acceptedAnswers]
    .map(comparable)
    .filter((target) => target !== "")
    .some(
      (target) =>
        response === target ||
        ` ${response} `.includes(` ${target} `) ||
        editDistance(response, target) <= spellingTolerance(target),
    );
}

function gradeOne(answer: FreeTextAnswer): FreeTextGrade {
  const grade = (score: number, feedback: string): FreeTextGrade => ({
    itemId: answer.itemId,
    score,
    feedback: `${feedback} ${SAMPLE_CHECK_NOTE}`,
    confidence: MOCK_CONFIDENCE,
  });

  if (answer.response.trim() === "") return grade(0, "You did not answer this question.");

  if (answer.type === "identification") {
    return matchesIdentification(answer)
      ? grade(answer.points, "Your answer matches the expected answer.")
      : grade(0, `The expected answer is ${quote(answer.answerKey, 120)}, and your answer does not match it.`);
  }

  const expected = importantStems(`${answer.answerKey} ${answer.rubric ?? ""}`).filter(
    (word) => !RUBRIC_WORDS.has(word),
  );
  const given = new Set(importantStems(answer.response));
  const matched = expected.filter((word) => given.has(word)).length;
  // Half of the expected words, and never more than six, earn full marks.
  const needed = Math.min(6, Math.max(1, Math.ceil(expected.length / 2)));
  const fraction = expected.length === 0 ? 0 : Math.min(1, matched / needed);
  const score = Math.round(answer.points * fraction * 2) / 2;

  if (score >= answer.points && score > 0) {
    return grade(score, "Your answer includes the key ideas of the expected answer.");
  }
  if (score > 0) {
    return grade(
      score,
      "Your answer includes some of the key ideas. Compare it with the expected answer to see what is missing.",
    );
  }
  return grade(
    0,
    "Your answer does not include the key ideas of the expected answer yet. Compare the two to see what to add.",
  );
}

/**
 * Compares the important words of each response with the answer key and the
 * rubric. Always returns low confidence so the teacher is asked to check.
 */
export function mockGradeFreeText(input: GradeFreeTextInput): FreeTextGrade[] {
  return input.answers.map(gradeOne);
}

// --- 3. Parent summary -------------------------------------------------------------

/** Added to a summary while the teacher still has answers to check. */
export const PENDING_NOTE: Record<keyof ParentSummary, string> = {
  en: "The teacher is still checking some answers, so the score may change.",
  fil: "Tinitingnan pa ng teacher ang ilang sagot, kaya puwedeng magbago ang score.",
};

const SAMPLE_SUMMARY_NOTE: Record<keyof ParentSummary, string> = {
  en: "This is a sample summary made without AI.",
  fil: "Sample na buod ito na ginawa nang walang AI.",
};

const BULLETS_MAX = 3;

/**
 * Fills a fixed template in English and Filipino from the item results.
 * The real task also uses it, without the sample note, to fill any field a
 * model left empty.
 */
export function mockParentSummary(
  input: ParentSummaryInput,
  options: { sampleNote: boolean } = { sampleNote: true },
): ParentSummary {
  const name = collapse(input.studentName).split(" ")[0] ?? "";
  const lesson = quote(input.lessonTitle || "the lesson", 100);
  const activity = quote(input.activityTitle || "the activity", 100);
  const score = formatScore(input.totalScore);
  const max = formatScore(input.maxScore);
  const share = input.maxScore > 0 ? input.totalScore / input.maxScore : 0;

  const right = input.items.filter((item) => item.points > 0 && item.score >= item.points);
  const missed = input.items.filter((item) => item.score < item.points);
  const hasPractice = missed.length > 0;

  const enName = name || "your child";
  const enLevel =
    share >= 0.85
      ? "Most of this lesson is well understood."
      : share >= 0.6
        ? "Much of the lesson is understood, and a few parts need more practice."
        : "This lesson is still being learned, and some practice at home will help.";
  const filLevel =
    share >= 0.85
      ? "Naintindihan niya ang halos buong lesson."
      : share >= 0.6
        ? "Marami siyang naintindihan sa lesson, at may ilang bahagi pang kailangang i-practice."
        : "Pinag-aaralan pa niya ang lesson na ito, at makakatulong ang kaunting practice sa bahay.";

  const sentences = (language: keyof ParentSummary, parts: string[]) =>
    [
      ...parts,
      ...(input.pendingReview ? [PENDING_NOTE[language]] : []),
      ...(options.sampleNote ? [SAMPLE_SUMMARY_NOTE[language]] : []),
    ].join(" ");

  return {
    en: {
      overview: sentences("en", [
        `${name || "Your child"} answered the activity ${activity} about the lesson ${lesson} and got ${score} out of ${max}.`,
        enLevel,
      ]),
      didWell: right
        .slice(0, BULLETS_MAX)
        .map((item) => `Got this right: ${quote(item.question, 120)}`),
      toPractice: missed
        .slice(0, BULLETS_MAX)
        .map(
          (item) =>
            `Go over this again: ${quote(item.question, 120)} Correct answer: ${quote(item.correctAnswer, 80)}`,
        ),
      homeTip: hasPractice
        ? `Ask ${enName} to read the questions above aloud and explain each correct answer in their own words. Five to ten minutes is enough.`
        : `Ask ${enName} to teach you the lesson ${lesson} in their own words, as if you were the student. Five to ten minutes is enough.`,
    },
    fil: {
      overview: sentences("fil", [
        `Sinagutan ${name ? `ni ${name}` : "ng anak ninyo"} ang activity na ${activity} tungkol sa lesson na ${lesson} at nakakuha siya ng ${score} sa ${max}.`,
        filLevel,
      ]),
      didWell: right
        .slice(0, BULLETS_MAX)
        .map((item) => `Tama ang sagot niya rito: ${quote(item.question, 120)}`),
      toPractice: missed
        .slice(0, BULLETS_MAX)
        .map(
          (item) =>
            `Balikan ito: ${quote(item.question, 120)} Tamang sagot: ${quote(item.correctAnswer, 80)}`,
        ),
      homeTip: hasPractice
        ? `Ipabasa nang malakas ${name ? `kay ${name}` : "sa anak ninyo"} ang mga tanong sa itaas at ipaliwanag niya sa sarili niyang salita kung bakit iyon ang tamang sagot. Sapat na ang lima hanggang sampung minuto.`
        : `Hayaan ${name ? `si ${name}` : "ang anak ninyo"} na ituro sa inyo ang lesson na ${lesson} gamit ang sarili niyang salita, na parang kayo ang estudyante. Sapat na ang lima hanggang sampung minuto.`,
    },
  };
}

// --- 4. Tutor ----------------------------------------------------------------------

const FILIPINO_MARKERS = new Set(
  (
    "ano bakit paano saan sino kailan ang ng mga po hindi sagot ko ba naman kasi ito yung " +
    "ako mali tama pwede puwede salamat anak namin niya bang paki ipaliwanag tanong"
  ).split(" "),
);

function looksFilipino(text: string): boolean {
  return tokenize(text).some((token) => FILIPINO_MARKERS.has(plain(token.text)));
}

const ASKS_WHO =
  /\b(are you (an? |the )?(ai|robot|bot|human|person|teacher|real)|who are you|what are you|tao ka ba|ai ka ba|robot ka ba|sino ka)\b/i;

const ITEM_NUMBER = /(?:number|no\.?|item|question|tanong|bilang|#)\s*(\d{1,2})\b/i;

function overlap(a: string[], b: Set<string>): number {
  return a.filter((word) => b.has(word)).length;
}

/** The graded item the question is most likely about, if any. */
function findItem(question: string, items: ResultItem[]): ResultItem | null {
  const numbered = ITEM_NUMBER.exec(question);
  if (numbered !== null) {
    const item = items.find((candidate) => candidate.position === Number(numbered[1]));
    if (item !== undefined) return item;
  }
  const asked = new Set(importantStems(question));
  let best: ResultItem | null = null;
  let bestShared = 0;
  for (const item of items) {
    const shared = overlap(importantStems(`${item.question} ${item.correctAnswer}`), asked);
    if (shared > bestShared) {
      best = item;
      bestShared = shared;
    }
  }
  return best;
}

function findLessonSentence(question: string, lessonContent: string): string | null {
  const asked = new Set(importantStems(question));
  let best: string | null = null;
  let bestShared = 0;
  for (const sentence of splitSentences(lessonContent)) {
    const shared = overlap(importantStems(sentence), asked);
    if (shared > bestShared) {
      best = sentence;
      bestShared = shared;
    }
  }
  return best;
}

/**
 * A fixed reply that points to the matching item or lesson sentence and says
 * plainly that real tutor answers need an AI key.
 */
export function mockTutorReply(input: TutorInput): { reply: string } {
  const filipino = looksFilipino(input.question);
  const parent = input.audience === "parent";
  const name = collapse(input.studentName).split(" ")[0] ?? "";
  const lesson = quote(input.lessonTitle || "the lesson", 100);

  if (ASKS_WHO.test(input.question)) {
    return {
      reply: filipino
        ? "Ako ang AralLoop tutor, isang automated na katulong at hindi tao. Naka-sample mode ako ngayon, kaya nakahandang sagot lang ito at hindi galing sa AI. Kailangan ng AI key para sa totoong paliwanag."
        : "I am the AralLoop tutor, an automated helper and not a person. I am in sample mode right now, so this is a prepared reply and not written by AI. Real explanations need an AI key.",
    };
  }

  const item = findItem(input.question, input.items);
  const sentence = item === null ? findLessonSentence(input.question, input.lessonContent) : null;

  const intro = filipino
    ? "Naka-sample mode ito, kaya nakahandang sagot lang ito at hindi galing sa AI."
    : "This is sample mode, so this is a prepared reply and not written by AI.";
  const outro = filipino
    ? "Kailangan ng AI key para sa totoong paliwanag."
    : "Real explanations need an AI key.";

  let body: string;
  if (item !== null) {
    const answer = quote(item.correctAnswer, 160);
    const feedback = clip(collapse(item.feedback), 220);
    body = filipino
      ? `Sa tanong ${item.position}, ${answer} ang tamang sagot.${feedback ? ` Ito ang feedback: ${feedback}` : ""}`
      : `For question ${item.position}, ${answer} is the correct answer.${feedback ? ` The feedback says: ${feedback}` : ""}`;
  } else if (sentence !== null) {
    body = filipino
      ? `Ito ang bahagi ng lesson na pinakamalapit sa tanong: ${quote(sentence, 260)}`
      : `The part of the lesson closest to the question says: ${quote(sentence, 260)}`;
  } else {
    body = filipino
      ? `Basahin ulit ang lesson na ${lesson} at ang feedback sa bawat tanong.`
      : `Read the lesson ${lesson} again, and the feedback under each question.`;
  }

  let help = "";
  if (parent) {
    help = filipino
      ? ` Puwede ninyong ipaliwanag ${name ? `kay ${name}` : "sa anak ninyo"} ang bahaging ito at ipaulit sa sarili niyang salita.`
      : ` You can go over this part with ${name || "your child"} and ask them to say it back in their own words.`;
  }

  return { reply: `${intro} ${body}${help} ${outro}` };
}
