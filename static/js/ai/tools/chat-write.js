import { applyChatWrite } from '../../moodle/tools.js';
export const meta = { id: 'chat-write' };
export async function run(order, ctx) {
  return applyChatWrite(order);
}
