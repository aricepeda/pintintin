import {
  applyAction,
  createInitialState,
  pickBotAction,
  projectFor,
  projectPublic,
  startNextRound,
  activeSeats,
  handHasAnyLegalMove,
  type FullState,
  type Seat,
  type GameEvent,
} from "@pintintin/game-core";
import { randomBytes } from "node:crypto";
import { logger } from "../logger.js";
import { config } from "../config.js";

export type SeatOccupant =
  | { kind: "human"; userId: string; displayName: string; connected: boolean; disconnectAt?: number }
  | { kind: "bot" }
  | { kind: "empty" };

export interface RoomEmitter {
  toAll(event: string, payload: unknown): void;
  toUser(userId: string, event: string, payload: unknown): void;
  onMatchEnded?(roomId: string): void;
  onMatchStarted?(roomId: string): void;
}

function cryptoRng(): () => number {
  return () => {
    const buf = randomBytes(4);
    return buf.readUInt32BE(0) / 0x100000000;
  };
}

const COUNTDOWN_MS = 5_000;

export class Room {
  public state: FullState | null = null;
  public seats: Record<Seat, SeatOccupant>;
  public phase: "waiting" | "playing" | "ended" = "waiting";
  private turnTimer: NodeJS.Timeout | null = null;
  private autoPassTimer: NodeJS.Timeout | null = null;
  private rng = cryptoRng();
  // Mid-match arrivals wait silently here; they get seated at the next round.
  private pendingHumans: { userId: string; displayName: string }[] = [];
  // Observers are in the room but have not claimed a seat yet.
  public observers = new Map<string, { displayName: string }>();
  // Pre-match countdown that triggers auto-start when ≥2 humans are seated.
  private countdownTimer: NodeJS.Timeout | null = null;
  public countdownDeadline: number | null = null;

  constructor(
    public readonly id: string,
    public readonly stake: number,
    public readonly playerCount: 2 | 3 | 4,
    seats: Record<Seat, SeatOccupant>,
    private emitter: RoomEmitter,
    public readonly tableId: string = id,
    public readonly tableName: string = "",
  ) {
    this.seats = seats;
  }

  isFull(): boolean {
    return activeSeats(this.playerCount).every((s) => this.seats[s].kind === "human");
  }

  connectedHumanCount(): number {
    let n = 0;
    for (const s of activeSeats(this.playerCount)) {
      const occ = this.seats[s];
      if (occ.kind === "human" && occ.connected) n++;
    }
    return n;
  }

  addHuman(userId: string, displayName: string): { ok: boolean; seat?: Seat; pending?: boolean; reason?: string } {
    const existing = this.seatOf(userId);
    if (existing !== null) return { ok: true, seat: existing };

    // Mid-match: queue silently — seated at the next round.
    if (this.phase === "playing") {
      if (this.pendingHumans.some((p) => p.userId === userId)) return { ok: true, pending: true };
      const totalSlots = activeSeats(this.playerCount).length;
      const occupied = this.connectedHumanCount() + this.pendingHumans.length;
      if (occupied >= totalSlots) return { ok: false, reason: "full" };
      this.pendingHumans.push({ userId, displayName });
      return { ok: true, pending: true };
    }

    if (this.phase !== "waiting") return { ok: false, reason: "in-progress" };
    for (const seat of activeSeats(this.playerCount)) {
      if (this.seats[seat].kind === "empty") {
        this.seats[seat] = { kind: "human", userId, displayName, connected: true };
        this.maybeStartOrResetCountdown();
        return { ok: true, seat };
      }
    }
    return { ok: false, reason: "full" };
  }

  isUserPending(userId: string): boolean {
    return this.pendingHumans.some((p) => p.userId === userId);
  }

  addObserver(userId: string, displayName: string): boolean {
    if (this.seatOf(userId) !== null) return true; // already seated
    this.observers.set(userId, { displayName });
    return true;
  }

  removeObserver(userId: string): boolean {
    return this.observers.delete(userId);
  }

  claimSeat(userId: string, seat: Seat, displayNameFallback?: string): { ok: boolean; reason?: string } {
    if (this.phase !== "waiting") return { ok: false, reason: "match-in-progress" };
    if (this.seatOf(userId) !== null) return { ok: false, reason: "already-seated" };
    const occ = this.seats[seat];
    if (occ.kind !== "empty") return { ok: false, reason: "seat-taken" };
    const obs = this.observers.get(userId);
    const displayName = obs?.displayName ?? displayNameFallback ?? `Jugador ${userId.slice(0, 6)}`;
    this.seats[seat] = { kind: "human", userId, displayName, connected: true };
    this.observers.delete(userId);
    this.maybeStartOrResetCountdown();
    return { ok: true };
  }

  private maybeStartOrResetCountdown() {
    if (this.phase !== "waiting") return;
    // Allow countdown with ≥1 human (rest auto-filled with bots in startMatchIfReady).
    if (this.connectedHumanCount() < 1) return;
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownDeadline = Date.now() + COUNTDOWN_MS;
    this.emitter.toAll("match:countdown", { deadline: this.countdownDeadline });
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = null;
      this.countdownDeadline = null;
      this.startMatchIfReady();
    }, COUNTDOWN_MS);
  }

  private cancelCountdown() {
    if (!this.countdownTimer) return;
    clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    this.countdownDeadline = null;
    this.emitter.toAll("match:countdownCanceled", {});
  }

  private seatPendingHumans() {
    for (const seat of activeSeats(this.playerCount)) {
      if (this.pendingHumans.length === 0) break;
      const occ = this.seats[seat];
      if (occ.kind === "empty" || occ.kind === "bot") {
        const next = this.pendingHumans.shift()!;
        this.seats[seat] = { kind: "human", userId: next.userId, displayName: next.displayName, connected: true };
      }
    }
  }

  removeHuman(userId: string): boolean {
    // Also drop them from the mid-match pending queue if they're queued.
    const pIdx = this.pendingHumans.findIndex((p) => p.userId === userId);
    if (pIdx >= 0) this.pendingHumans.splice(pIdx, 1);
    if (this.phase !== "waiting") return pIdx >= 0;
    const seat = this.seatOf(userId);
    if (seat === null) return pIdx >= 0;
    this.seats[seat] = { kind: "empty" };
    this.compactSeats();
    if (this.connectedHumanCount() < 2) this.cancelCountdown();
    return true;
  }

  // Tracks who opened the current and previous rounds — used to determine
  // who opens after a tied/blocked round (same player opens again).
  public currentOpenerSeat: Seat | null = null;
  public lastOpenerSeat: Seat | null = null;

  startMatchIfReady(): boolean {
    if (this.phase !== "waiting") return false;
    const humans = this.connectedHumanCount();
    if (humans < 1) return false;
    // Fill empty seats with bots so a single human can play against the AI.
    for (const seat of activeSeats(this.playerCount)) {
      if (this.seats[seat].kind === "empty") {
        this.seats[seat] = { kind: "bot" };
      }
    }
    this.phase = "playing";
    this.emitter.onMatchStarted?.(this.id);
    // Run the opener draw, then deal hands when animation finishes.
    this.runOpenerDraw();
    return true;
  }

  private runOpenerDraw() {
    // Each active seat draws a random tile from a fresh full set.
    const pool: { a: number; b: number }[] = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) pool.push({ a, b });
    // Fisher-Yates shuffle.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const tmp = pool[i]!; pool[i] = pool[j]!; pool[j] = tmp;
    }
    const draws: Record<number, { a: number; b: number }> = {};
    let winnerSeat: Seat = 0 as Seat;
    let bestSum = -1;
    for (const seat of activeSeats(this.playerCount)) {
      const tile = pool.pop()!;
      draws[seat] = tile;
      const sum = tile.a + tile.b;
      if (sum > bestSum) { bestSum = sum; winnerSeat = seat; }
    }
    this.emitter.toAll("game:openerDraw", { draws, winnerSeat, durationMs: 3500 });
    setTimeout(() => {
      if (this.phase !== "playing") return;
      this.currentOpenerSeat = winnerSeat;
      this.lastOpenerSeat = winnerSeat;
      this.state = createInitialState({
        rng: this.rng,
        targetScore: config.targetScore,
        playerCount: this.playerCount,
        forcedStarter: winnerSeat,
      });
      this.startMatch();
    }, 3500);
  }

  private compactSeats() {
    const all = activeSeats(this.playerCount);
    const humans: SeatOccupant[] = [];
    for (const s of all) {
      const occ = this.seats[s];
      if (occ.kind === "human") humans.push(occ);
    }
    for (let i = 0; i < all.length; i++) {
      const seat = all[i] as Seat;
      this.seats[seat] = humans[i] ?? { kind: "empty" };
    }
  }

  startMatch() {
    if (!this.state) return;
    for (const seat of activeSeats(this.playerCount)) {
      const occ = this.seats[seat];
      if (occ.kind === "human") {
        this.emitter.toUser(occ.userId, "game:dealt", projectFor(this.state, seat));
      }
    }
    this.emitter.toAll("game:turnTimer", {
      seat: this.state.currentSeat,
      deadline: Date.now() + config.turnTimerMs,
    });
    this.scheduleTurnTimer();
    this.driveOpener();
  }

  private scheduleTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    // Disabled: don't auto-pass connected humans for taking too long.
    // Bots/disconnected seats still get driven by driveBots / runSeatAuto.
    const occ = this.seats[this.state.currentSeat];
    if (occ.kind === "human" && occ.connected) return;
    this.turnTimer = setTimeout(() => this.onTurnTimeout(), config.turnTimerMs);
  }

  private onTurnTimeout() {
    const seat = this.state.currentSeat;
    const occ = this.seats[seat];
    if (occ.kind === "bot" || (occ.kind === "human" && !occ.connected)) {
      this.runSeatAuto();
    } else {
      try {
        this.apply({ type: "PASS", seat });
      } catch {
        const action = pickBotAction(this.state, seat);
        try {
          this.apply(action);
        } catch (err) {
          logger.error({ err, seat }, "auto play failed");
        }
      }
    }
  }

  handleHumanAction(userId: string, action: { type: "PLAY" | "PASS"; tileId?: string; end?: "left" | "right" }) {
    const seat = this.seatOf(userId);
    if (seat === null) throw new Error("not seated");
    if (action.type === "PLAY") {
      this.apply({ type: "PLAY", seat, tileId: action.tileId!, end: action.end! });
    } else {
      this.apply({ type: "PASS", seat });
    }
  }

  private apply(action: Parameters<typeof applyAction>[1]) {
    const { state, events } = applyAction(this.state!, action);
    this.state = state;
    this.broadcastEvents(events);
    if (state.phase === "matchEnded") {
      this.cleanup();
      this.resetToWaiting();
      this.emitter.onMatchEnded?.(this.id);
      return;
    }
    if (state.phase === "roundEnded") {
      // Wait for human to click "Siguiente Ronda"
      return;
    }
    this.emitter.toAll("game:turnTimer", {
      seat: state.currentSeat,
      deadline: Date.now() + config.turnTimerMs,
    });
    this.scheduleTurnTimer();
    this.driveBots();
    this.scheduleAutoPass();
  }

  private scheduleAutoPass() {
    if (this.autoPassTimer) {
      clearTimeout(this.autoPassTimer);
      this.autoPassTimer = null;
    }
    if (!this.state || this.state.phase !== "playing") return;
    const seat = this.state.currentSeat;
    const occ = this.seats[seat];
    // Bots / disconnected humans are handled by driveBots / runSeatAuto.
    if (occ.kind !== "human" || !occ.connected) return;
    // Don't auto-pass during the opener (no board yet): the opener will be played.
    if (this.state.board.length === 0) return;
    const hand = this.state.hands[seat];
    if (handHasAnyLegalMove(hand, this.state.leftEnd, this.state.rightEnd)) return;
    this.autoPassTimer = setTimeout(() => {
      this.autoPassTimer = null;
      if (!this.state || this.state.phase !== "playing") return;
      if (this.state.currentSeat !== seat) return;
      try {
        this.apply({ type: "PASS", seat });
      } catch (err) {
        logger.error({ err, seat }, "auto pass failed");
      }
    }, 1400);
  }

  requestNextRound() {
    if (!this.state || this.state.phase !== "roundEnded") return;
    this.nextRound();
  }

  // Dev-only: force a fresh hand mid-match without restarting the server.
  devForceReset() {
    if (!this.state) return;
    if (this.turnTimer) { clearTimeout(this.turnTimer); this.turnTimer = null; }
    if (this.autoPassTimer) { clearTimeout(this.autoPassTimer); this.autoPassTimer = null; }
    this.seatPendingHumans();
    this.state = startNextRound(this.state, this.rng);
    this.currentOpenerSeat = this.state.currentSeat;
    for (const seat of activeSeats(this.playerCount)) {
      const occ = this.seats[seat];
      if (occ.kind === "human") {
        this.emitter.toUser(occ.userId, "game:dealt", projectFor(this.state, seat));
      }
    }
    this.emitter.toAll("game:turnTimer", {
      seat: this.state.currentSeat,
      deadline: Date.now() + config.turnTimerMs,
    });
    this.scheduleTurnTimer();
    this.driveOpener();
  }

  private nextRound() {
    // Seat any pending mid-match arrivals before dealing the new round.
    this.seatPendingHumans();
    // Determine next opener:
    // - Round had a winner (domino or blocked decided) → winner opens next.
    // - Round was blocked AND tied (no winner) → same opener opens again.
    const prev = this.state!;
    const lastEvent = prev.lastEvent;
    let nextOpener: Seat | undefined;
    if (lastEvent && lastEvent.type === "ROUND_ENDED") {
      if (lastEvent.winnerSeat !== null) {
        nextOpener = lastEvent.winnerSeat;
      } else {
        // Blocked + tied → previous opener opens again.
        nextOpener = this.currentOpenerSeat ?? undefined;
      }
    }
    this.lastOpenerSeat = this.currentOpenerSeat;
    if (nextOpener !== undefined) this.currentOpenerSeat = nextOpener;
    this.state = startNextRound(prev, this.rng, nextOpener);
    for (const seat of activeSeats(this.playerCount)) {
      const occ = this.seats[seat];
      if (occ.kind === "human") {
        this.emitter.toUser(occ.userId, "game:dealt", projectFor(this.state, seat));
      }
    }
    this.emitter.toAll("game:turnTimer", {
      seat: this.state.currentSeat,
      deadline: Date.now() + config.turnTimerMs,
    });
    this.scheduleTurnTimer();
    this.driveOpener();
  }

  private driveOpener() {
    if (!this.state) return;
    const seat = this.state.currentSeat;
    const hand = this.state.hands[seat];
    let openTile = null;
    for (let pip = 6; pip >= 0; pip--) {
      const t = hand.find((h) => h.a === pip && h.b === pip);
      if (t) { openTile = t; break; }
    }
    if (!openTile) {
      // No doubles dealt — let normal play proceed
      this.driveBots();
      return;
    }
    // Only auto-play the opener for non-human seats (bots / disconnected).
    // Human players must place the opener manually — the client highlights it.
    const occ = this.seats[seat];
    if (occ.kind === "human" && occ.connected) return;
    const tile = openTile;
    setTimeout(() => {
      if (!this.state || this.state.currentSeat !== seat || this.state.board.length > 0 || this.state.phase !== "playing") return;
      try {
        this.apply({ type: "PLAY", seat, tileId: tile.id, end: "left" });
      } catch (err) {
        logger.error({ err }, "opener auto play failed");
      }
    }, 5000);
  }

  private driveBots() {
    if (!this.state) return;
    const seat = this.state.currentSeat;
    if (this.seats[seat].kind !== "bot") return;
    setTimeout(() => {
      if (!this.state || this.state.currentSeat !== seat || this.state.phase !== "playing") return;
      try {
        this.apply(pickBotAction(this.state, seat));
      } catch (err) {
        logger.error({ err }, "bot move failed");
      }
    }, 3500);
  }

  private runSeatAuto() {
    if (!this.state) return;
    try {
      this.apply(pickBotAction(this.state, this.state.currentSeat));
    } catch (err) {
      logger.error({ err }, "auto move failed");
    }
  }

  private broadcastEvents(events: GameEvent[]) {
    for (const ev of events) {
      switch (ev.type) {
        case "PLAYED":
          this.emitter.toAll("game:moveApplied", {
            seat: ev.seat,
            tile: ev.tile,
            end: ev.end,
            nextSeat: this.state.currentSeat,
            stateVersion: this.state.stateVersion,
            publicState: projectPublic(this.state),
          });
          break;
        case "PASSED":
          this.emitter.toAll("game:passed", {
            seat: ev.seat,
            nextSeat: this.state.currentSeat,
            stateVersion: this.state.stateVersion,
            publicState: projectPublic(this.state),
          });
          break;
        case "ROUND_ENDED":
          this.emitter.toAll("game:roundEnded", {
            ...ev,
            hands: this.state.hands,
          });
          break;
        case "MATCH_ENDED":
          this.emitter.toAll("game:matchEnded", ev);
          break;
      }
    }
  }

  seatOf(userId: string): Seat | null {
    for (const seat of activeSeats(this.playerCount)) {
      const occ = this.seats[seat];
      if (occ.kind === "human" && occ.userId === userId) return seat;
    }
    return null;
  }

  markDisconnected(userId: string) {
    const seat = this.seatOf(userId);
    if (seat === null) return;
    const occ = this.seats[seat];
    if (occ.kind !== "human") return;
    occ.connected = false;
    occ.disconnectAt = Date.now();
    this.emitter.toAll("room:playerDisconnected", {
      seat,
      graceEndsAt: Date.now() + config.disconnectGraceMs,
    });
    if (this.phase === "waiting" && this.connectedHumanCount() < 2) this.cancelCountdown();
  }

  markReconnected(userId: string) {
    const seat = this.seatOf(userId);
    if (seat === null) return;
    const occ = this.seats[seat];
    if (occ.kind !== "human") return;
    occ.connected = true;
    occ.disconnectAt = undefined;
    if (this.state) {
      this.emitter.toUser(userId, "room:resync", projectFor(this.state, seat));
    }
    this.emitter.toAll("room:playerReconnected", { seat });
    if (this.phase === "waiting") this.maybeStartOrResetCountdown();
  }

  private cleanup() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (this.autoPassTimer) clearTimeout(this.autoPassTimer);
    this.autoPassTimer = null;
  }

  destroy() {
    this.cleanup();
  }

  resetToWaiting() {
    for (const s of activeSeats(this.playerCount)) {
      this.seats[s] = { kind: "empty" };
    }
    this.state = null;
    this.phase = "waiting";
    this.cancelCountdown();
    // Pending mid-match arrivals graduate to real seats now that we're waiting.
    this.seatPendingHumans();
    this.maybeStartOrResetCountdown();
  }
}
