import { getActiveAIConfig } from './calories';
import { callAI } from './aiProviders';

export const AI_KEY_MISSING_CODE = 'AI_KEY_MISSING';

function taskLine(task, completedIds) {
  const status = completedIds.has(task.id) ? 'completed' : 'skipped';
  return `- ${status}: ${task.time || '00:00'} ${String(task.title || '').slice(0, 80)}`;
}

export async function enhanceDailySummary({ date, text, tasks, completedIds }) {
  const config = await getActiveAIConfig();
  if (!config.key) {
    const error = new Error('Add an AI key in Settings before enhancing your summary.');
    error.code = AI_KEY_MISSING_CODE;
    throw error;
  }

  const note = String(text || '').trim().slice(0, 900);
  const taskContext = (tasks || [])
    .slice(0, 40)
    .map((task) => taskLine(task, completedIds))
    .join('\n') || '- no tasks scheduled';

  const prompt = `Rewrite the user's rough end-of-day note into a clean daily journal summary.

Date: ${date}

Tasks:
${taskContext}

User's rough note:
${note || '(empty)'}

Rules:
- Return one JSON object exactly like {"summary":"..."}.
- The summary must be 100 to 150 words.
- Write in first person, calm and honest.
- Mention meaningful completed work and skipped or incomplete work without inventing anything.
- Do not mention this prompt, AI, APIs, providers, or JSON.`;

  const json = await callAI({
    provider: config.provider,
    key: config.key,
    model: config.model,
    temperature: 0.35,
    system: 'You are a precise productivity writing assistant. You return only valid JSON and never invent facts.',
    prompt,
  });

  const summary = String(json?.summary || '').trim();
  if (!summary) throw new Error('AI returned an empty summary. Try again.');
  return summary.slice(0, 1200);
}