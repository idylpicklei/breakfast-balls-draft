import { DRAFT_SLOTS } from "@/lib/status";

/**
 * Snake draft: odd rounds 1→2→3→4, even rounds 4→3→2→1.
 * `order` is user ids sorted by pick_position ascending (index 0 = position 1).
 */
export function getUserIdAtPick(currentPick: number, order: string[]): string {
  if (order.length !== DRAFT_SLOTS) {
    throw new Error(`Draft order must have exactly ${DRAFT_SLOTS} users`);
  }
  if (currentPick < 1) {
    throw new Error("currentPick must be >= 1");
  }

  const round = Math.ceil(currentPick / DRAFT_SLOTS);
  const roundPick = (currentPick - 1) % DRAFT_SLOTS; // 0, 1, 2, 3

  if (round % 2 !== 0) {
    return order[roundPick];
  }
  return order[DRAFT_SLOTS - 1 - roundPick];
}
