/** A small, hand-picked set of Kierkegaard quotes for the front page. */

export const KIERKEGAARD_QUOTES: string[] = [
  "Life can only be understood backwards; but it must be lived forwards.",
  "Anxiety is the dizziness of freedom.",
  "To dare is to lose one's footing momentarily. Not to dare is to lose oneself.",
  "The most common form of despair is not being who you are.",
  "Patience is necessary, and one cannot reap immediately where one has sown.",
  "Once you label me you negate me.",
  "There are two ways to be fooled. One is to believe what isn't true; the other is to refuse to believe what is true.",
  "The function of prayer is not to influence God, but rather to change the nature of the one who prays.",
  "Boredom is the root of all evil — the despairing refusal to be oneself.",
  "Face the facts of being what you are, for that is what changes what you are.",
];

/** Deterministic quote-of-the-day so it's stable within a calendar day. */
export function quoteOfTheDay(date = new Date()): string {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return KIERKEGAARD_QUOTES[dayIndex % KIERKEGAARD_QUOTES.length];
}
