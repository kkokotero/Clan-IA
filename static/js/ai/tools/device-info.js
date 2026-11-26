import { applyDeviceInfo } from '../device.js';
export const meta = { id: 'device-info' };
export async function run(order, ctx) {
  return applyDeviceInfo(order);
}
