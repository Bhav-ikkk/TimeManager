/**
 * src/lib/quotes.js
 * Short, calming motivational lines used in reminder notifications.
 * Kept short on purpose so they fit a phone notification body.
 */
export const QUOTES = [
  'One task. Full focus. Go.',
  'Small win now beats big plan later.',
  'Discipline is choosing what you want most over what you want now.',
  'Show up. Then keep showing up.',
  'You will never regret doing the next right thing.',
  'Mood follows action. Start.',
  'Be the kind of person you would be proud of tonight.',
  'Two minutes in. The rest gets easier.',
  'Quiet effort beats loud intentions.',
  'Future you is watching. Make them smile.',
  'Done is better than perfect. Begin.',
  'Your only job for the next hour is this.',
  'Stack one good hour. Then another.',
  'Slow is smooth. Smooth is fast.',
  'You decide who you become — one task at a time.',
  'Skip the scroll. Earn the pride.',
  'Pressure is privilege. Use it.',
  'You are exactly where the work begins.',
  'No streak grows without today.',
  'Be boringly consistent.',
];

export function pickQuote(seed = Date.now()) {
  return QUOTES[Math.abs(seed) % QUOTES.length];
}
