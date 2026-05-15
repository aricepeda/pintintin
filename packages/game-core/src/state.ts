import type {
  Action,
  End,
  FullState,
  GameEvent,
  Pip,
  PublicState,
  Seat,
  Tile,
} from "./types";
import { GameError } from "./types";
import { activeSeats, dealHands, findStarter, findOpenerTile, type Rng } from "./tiles";
import {
  canPlayTile,
  handHasAnyLegalMove,
  nextSeat,
  resolveRound,
} from "./rules";

export interface CreateMatchOptions {
  targetScore?: number;
  playerCount: 2 | 3 | 4;
  rng: Rng;
  /** Override the opener seat. If omitted, falls back to highest-double rule. */
  forcedStarter?: Seat;
}

function emptyCounts(): Record<Seat, number> {
  return { 0: 0, 1: 0, 2: 0, 3: 0 };
}

function handCountsFrom(hands: Record<Seat, Tile[]>): Record<Seat, number> {
  return { 0: hands[0].length, 1: hands[1].length, 2: hands[2].length, 3: hands[3].length };
}

export function createInitialState(opts: CreateMatchOptions): FullState {
  const targetScore = opts.targetScore ?? 100;
  const playerCount = opts.playerCount;
  const hands = dealHands(opts.rng, playerCount);
  const starter = opts.forcedStarter !== undefined ? opts.forcedStarter : findStarter(hands, playerCount);
  return {
    board: [],
    leftEnd: null,
    rightEnd: null,
    hands,
    handCounts: handCountsFrom(hands),
    currentSeat: starter,
    scores: emptyCounts(),
    roundNo: 1,
    passesInARow: 0,
    stateVersion: 0,
    phase: "playing",
    starterSeat: starter,
    targetScore,
    playerCount,
    activeSeats: activeSeats(playerCount),
  };
}

export function startNextRound(prev: FullState, rng: Rng, forcedStarter?: Seat): FullState {
  const hands = dealHands(rng, prev.playerCount);
  const starter = forcedStarter !== undefined ? forcedStarter : findStarter(hands, prev.playerCount);
  return {
    ...prev,
    board: [],
    leftEnd: null,
    rightEnd: null,
    hands,
    handCounts: handCountsFrom(hands),
    currentSeat: starter,
    roundNo: prev.roundNo + 1,
    passesInARow: 0,
    stateVersion: prev.stateVersion + 1,
    phase: "playing",
    starterSeat: starter,
    lastEvent: undefined,
  };
}

export interface ApplyResult {
  state: FullState;
  events: GameEvent[];
}

export function applyAction(state: FullState, action: Action): ApplyResult {
  if (state.phase !== "playing") {
    throw new GameError("WRONG_PHASE", `Cannot act in phase ${state.phase}`);
  }
  if (action.seat !== state.currentSeat) {
    throw new GameError("NOT_YOUR_TURN", `It is seat ${state.currentSeat}'s turn`);
  }

  const events: GameEvent[] = [];
  let next: FullState;

  if (action.type === "PASS") {
    const hand = state.hands[action.seat];
    if (handHasAnyLegalMove(hand, state.leftEnd, state.rightEnd)) {
      throw new GameError("MUST_PLAY", "You have a legal move and cannot pass");
    }
    next = {
      ...state,
      passesInARow: state.passesInARow + 1,
      currentSeat: nextSeat(state.currentSeat, state.playerCount),
      stateVersion: state.stateVersion + 1,
    };
    events.push({ type: "PASSED", seat: action.seat });
  } else {
    const hand = state.hands[action.seat];
    const tile = hand.find((t) => t.id === action.tileId);
    if (!tile) throw new GameError("NO_SUCH_TILE", "Tile not in your hand");
    if (!canPlayTile(tile, state.leftEnd, state.rightEnd, action.end)) {
      throw new GameError("ILLEGAL_PLAY", "Tile does not match that end");
    }

    const newHand = hand.filter((t) => t.id !== action.tileId);
    const newHands: Record<Seat, Tile[]> = { ...state.hands, [action.seat]: newHand };

    let newLeft: Pip | null;
    let newRight: Pip | null;
    let endTag: End | "start";

    let flipped = false;
    if (state.leftEnd === null && state.rightEnd === null) {
      const openerTile = findOpenerTile(hand);
      if (tile.id !== openerTile.id) {
        throw new GameError("MUST_PLAY_OPENER", "Must open with your highest double (or highest tile)");
      }
      newLeft = tile.a;
      newRight = tile.b;
      endTag = "start";
      flipped = false;
    } else if (action.end === "left") {
      const matchPip = state.leftEnd!;
      // Connecting pip must face RIGHT (inward). If tile.a matches, flip so a is on right.
      flipped = tile.a === matchPip;
      newLeft = tile.a === matchPip ? tile.b : tile.a;
      newRight = state.rightEnd;
      endTag = "left";
    } else {
      const matchPip = state.rightEnd!;
      // Connecting pip must face LEFT (inward). If tile.b matches, flip so b is on left.
      flipped = tile.b === matchPip;
      newRight = tile.a === matchPip ? tile.b : tile.a;
      newLeft = state.leftEnd;
      endTag = "right";
    }

    next = {
      ...state,
      hands: newHands,
      handCounts: { ...state.handCounts, [action.seat]: newHand.length },
      board: [...state.board, { tile, playedBy: action.seat, end: endTag, flipped }],
      leftEnd: newLeft,
      rightEnd: newRight,
      passesInARow: 0,
      currentSeat: nextSeat(state.currentSeat, state.playerCount),
      stateVersion: state.stateVersion + 1,
    };
    events.push({ type: "PLAYED", seat: action.seat, tile, end: endTag });
  }

  const result = resolveRound(next);
  if (result) {
    const newScores = { ...next.scores };
    if (result.winnerSeat !== null) {
      newScores[result.winnerSeat] = newScores[result.winnerSeat] + result.pointsAwarded;
    }
    const matchWinner = activeSeats(next.playerCount).find(
      (s) => newScores[s] >= next.targetScore,
    );
    next = {
      ...next,
      scores: newScores,
      phase: matchWinner !== undefined ? "matchEnded" : "roundEnded",
      matchWinner,
    };
    events.push({
      type: "ROUND_ENDED",
      winnerSeat: result.winnerSeat,
      reason: result.reason,
      scores: newScores,
      pointsAwarded: result.pointsAwarded,
    });
    if (matchWinner !== undefined) {
      events.push({ type: "MATCH_ENDED", winnerSeat: matchWinner });
    }
  }

  next.lastEvent = events[events.length - 1];
  return { state: next, events };
}

export function projectPublic(state: FullState): PublicState {
  const {
    board, leftEnd, rightEnd, handCounts, currentSeat, scores, roundNo,
    passesInARow, stateVersion, phase, lastEvent, matchWinner, activeSeats: seats,
  } = state;
  return {
    board, leftEnd, rightEnd, handCounts, currentSeat, scores, roundNo,
    passesInARow, stateVersion, phase, lastEvent, matchWinner, activeSeats: seats,
  };
}

export function projectFor(state: FullState, seat: Seat) {
  return {
    yourSeat: seat,
    yourHand: state.hands[seat],
    publicState: projectPublic(state),
  };
}
