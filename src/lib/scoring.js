/**
 * src/lib/scoring.js
 * End-of-day verdict — given the day's tasks and completion set,
 * decide whether the user gets a praise or a roast.
 */
import { pickPraise, pickRoast } from './roasts';

/**
 * @param {{tasks: Array, completedIds: Set<number>}} input
 * @returns {{verdict: 'praise'|'roast'|'empty', message: string, missed: Array}}
 */
export function verdictFor({ tasks, completedIds }) {
  if (!tasks || tasks.length === 0) {
    return {
      verdict: 'empty',
      message: 'No tasks were planned for today. Plan tomorrow tonight.',
      missed: [],
    };
  }
  const missed = tasks.filter((t) => !completedIds.has(t.id));
  const seed = tasks.length * 31 + missed.length * 7 + new Date().getDate();
  if (missed.length === 0) {
    return { verdict: 'praise', message: pickPraise(seed), missed: [] };
  }
  return { verdict: 'roast', message: pickRoast(seed), missed };
}
