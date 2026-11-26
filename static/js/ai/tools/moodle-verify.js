import { moodleVerifyIndex, moodleVerifyResult } from '../../moodle/tools.js';
export const meta = { id: 'moodle-verify' };
export async function run(order, ctx) {
  const check = moodleVerifyResult(order);
  check.invalid.forEach((name) => {
    if (name.length >= 5 && !ctx.rejectedNames.includes(name)) ctx.rejectedNames.push(name);
  });
  if (check.valid.length) ctx.verifiedAny = true;
  return check.note;
}
