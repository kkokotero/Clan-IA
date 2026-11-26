import { applyMoodleOpen } from '../../moodle/tools.js';
export const meta = { id: 'moodle-open' };
export async function run(order, ctx) {
  return applyMoodleOpen(order);
}
