import { chatListResult } from '../../moodle/tools.js';
export const meta = { id: 'chat-list' };
export async function run(order, ctx) {
  return chatListResult(order);
}
