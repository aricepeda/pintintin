import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildFullSet,
  FULL_SET_SIZE,
  tilesPerHand,
  createInitialState,
  applyAction,
  pickBotAction,
  activeSeats,
  type Seat,
} from "../src/index";

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe("tiles", () => {
  it("full set has 28 unique tiles", () => {
    const set = buildFullSet();
    expect(set).toHaveLength(FULL_SET_SIZE);
    expect(new Set(set.map((t) => t.id)).size).toBe(FULL_SET_SIZE);
  });
  it("hand sizes: 4p=6, 3p=7, 2p=7", () => {
    expect(tilesPerHand(4)).toBe(6);
    expect(tilesPerHand(3)).toBe(7);
    expect(tilesPerHand(2)).toBe(7);
  });
});

describe("match simulation", () => {
  for (const playerCount of [2, 3, 4] as const) {
    it(`a bot-driven ${playerCount}p match terminates and conserves tiles`, () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10_000 }), (seed) => {
          const rng = seededRng(seed);
          let state = createInitialState({ rng, targetScore: 50, playerCount });
          let safety = 5_000;
          while (state.phase !== "matchEnded" && safety-- > 0) {
            if (state.phase === "roundEnded") {
              const total = activeSeats(playerCount).reduce(
                (sum, s) => sum + state.hands[s].length,
                0,
              );
              expect(total + state.board.length).toBe(playerCount * tilesPerHand(playerCount));
              const next = createInitialState({ rng, targetScore: state.targetScore, playerCount });
              state = { ...next, scores: state.scores, roundNo: state.roundNo + 1 };
              continue;
            }
            const action = pickBotAction(state, state.currentSeat as Seat);
            state = applyAction(state, action).state;
          }
          expect(state.phase).toBe("matchEnded");
        }),
        { numRuns: 10 },
      );
    });
  }

  it("illegal play is rejected", () => {
    const rng = seededRng(42);
    const state = createInitialState({ rng, playerCount: 4 });
    const wrongSeat: Seat = ((state.currentSeat + 1) % 4) as Seat;
    expect(() =>
      applyAction(state, { type: "PLAY", seat: wrongSeat, tileId: "0-0", end: "right" }),
    ).toThrow();
  });
});
