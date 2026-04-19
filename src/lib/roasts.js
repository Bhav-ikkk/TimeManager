/**
 * src/lib/roasts.js
 * End-of-day verdict lines.
 *
 * `praise`  — used when every scheduled task for the day was completed.
 * `roasts`  — sharp, funny, never cruel; used when something was missed.
 *
 * Keep all lines self-contained, under ~140 chars, no profanity, no targeted
 * insults — just the kind of nudge a brutally honest friend would give.
 */
export const PRAISE = [
  'Cleared the entire timetable. Quiet beast mode.',
  'Every task done. Sleep proud tonight.',
  'You did exactly what you said you would. Rare. Respect.',
  'A perfectly executed boring day. The best kind.',
  'No misses. Stack another tomorrow.',
  'Discipline = 1, Excuses = 0. Nice scoreboard.',
  'You honoured your own plan. That is power.',
  'You showed up for yourself today. Keep it.',
];

export const ROASTS = [
  'Your timetable called. It is asking who hurt it.',
  'Plans were made. Plans were ignored. Bold strategy.',
  'You scheduled it. You ghosted it. Classic.',
  'Even your future self is unsubscribing.',
  'The plan worked perfectly — for someone else.',
  'You did not run out of time. You ran out of follow-through.',
  'Today you out-procrastinated yourself. Achievement unlocked.',
  'Your discipline is on airplane mode again.',
  'Nice journal entry. Shame about the actual day.',
  'You treated your timetable like a suggestion box.',
  'Big plans, small action. The trademark combo.',
  'You owe one task an apology. Then do it tomorrow.',
  'Motivation showed up. You were not home.',
  'Streak status: under construction. Indefinitely.',
  'You scrolled instead. We both know it.',
];

export function pickPraise(seed = Date.now()) {
  return PRAISE[Math.abs(seed) % PRAISE.length];
}

export function pickRoast(seed = Date.now()) {
  return ROASTS[Math.abs(seed) % ROASTS.length];
}
