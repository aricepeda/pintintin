import type { Action, FullState, Seat, End } from "./types";
import { canPlayTile } from "./rules";

export function pickBotAction(state: FullState, seat: Seat): Action {
  const hand = state.hands[seat];
  for (const tile of hand) {
    for (const end of ["right", "left"] as End[]) {
      if (canPlayTile(tile, state.leftEnd, state.rightEnd, end)) {
        return { type: "PLAY", seat, tileId: tile.id, end };
      }
    }
  }
  return { type: "PASS", seat };
}
