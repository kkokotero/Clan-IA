import { chatReadResult } from '../../moodle/tools.js';
export const meta = { id: 'chat-read' };
export async function run(order, ctx) {
  return chatReadResult(order);
}
