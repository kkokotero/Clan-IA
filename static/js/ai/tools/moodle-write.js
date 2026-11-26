import { applyMoodleWrite } from '../../moodle/tools.js';
export const meta = { id: 'moodle-write' };
export async function run(order, ctx) {
  return applyMoodleWrite(order);
}
