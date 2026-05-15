import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  withDelay,
  cancelAnimation,
  Easing,
  ReduceMotion,
  LinearTransition,
} from "react-native-reanimated";
import { useGameStore, type RoundEndData } from "../src/store/game";
import { getSocket } from "../src/net/socket";
import { confirmLeaveRoom } from "../src/net/leaveRoom";
import { sitAtSeat } from "../src/net/sitAtSeat";
import { DominoTile } from "../src/components/DominoTile";
import { DraggableTile, type DropZone } from "../src/components/DraggableTile";
import { PlayerAvatar } from "../src/components/PlayerAvatar";
import { canPlayTile, findOpenerTile, isDouble, type Tile, type Seat, type Pip, type BoardTile } from "@pintintin/game-core";
import { playClick, playTick, playShuffle, speak } from "../src/audio";

// Board is stored in chronological play order. For rendering, we need the visual
// chain order: most-recent left plays first, then the opener, then right plays.
function orderBoardForRender(board: readonly BoardTile[]): BoardTile[] {
  const leftPlays: BoardTile[] = [];
  const rightPlays: BoardTile[] = [];
  let start: BoardTile | null = null;
  for (const bt of board) {
    if (bt.end === "start") start = bt;
    else if (bt.end === "left") leftPlays.push(bt);
    else rightPlays.push(bt);
  }
  return [...leftPlays.reverse(), ...(start ? [start] : []), ...rightPlays];
}

const LABELS: Record<number, string> = { 0: "Tú", 1: "Lola", 2: "Pepe", 3: "Carmen" };
const AVATARS: Record<number, string> = { 0: "🧑", 1: "👩‍🦰", 2: "🧔", 3: "👵" };

function seatPositions(active: readonly Seat[]): Record<number, "top" | "left" | "right"> {
  const opp = active.filter((s) => s !== 0);
  const map: Record<number, "top" | "left" | "right"> = {};
  if (opp.length === 1) { map[opp[0]!] = "top"; }
  else if (opp.length === 2) { map[opp[0]!] = "right"; map[opp[1]!] = "top"; }
  else { map[opp[0]!] = "right"; map[opp[1]!] = "top"; map[opp[2]!] = "left"; }
  return map;
}

// Compute board tile size based on chain length and available width.
// Phase 1 (≤12 tiles): max size. Phase 2 (more tiles): shrinks to a min.
const SIZE_MAX = 36;
const SIZE_MIN = 20;
function computeTileSize(count: number, width: number): number {
  if (!width || count <= 12) return SIZE_MAX;
  // Estimated per-tile width ≈ size*2 + ~7 (border + margin). Solve for size.
  const s = (width / count - 7) / 2;
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.floor(s)));
}

// Phase 3 — serpentine wrap. Splits the chain into rows when even at SIZE_MIN
// it would overflow the board width. Right-side overflow stacks UP above the
// center; left-side overflow stacks DOWN below.
type ChainRow = { tiles: BoardTile[]; isCenter: boolean; isFirst: boolean; isLast: boolean };

function chainToRows(ordered: BoardTile[], maxPerRow: number): ChainRow[] {
  if (ordered.length <= maxPerRow) {
    return [{ tiles: ordered, isCenter: true, isFirst: true, isLast: true }];
  }
  const openerIdx = ordered.findIndex((bt) => bt.end === "start");
  if (openerIdx < 0) {
    const rows: ChainRow[] = [];
    for (let i = 0; i < ordered.length; i += maxPerRow) {
      rows.push({ tiles: ordered.slice(i, i + maxPerRow), isCenter: false, isFirst: false, isLast: false });
    }
    if (rows.length > 0) { rows[0]!.isFirst = true; rows[rows.length - 1]!.isLast = true; }
    return rows;
  }

  const leftAvail = openerIdx;
  const rightAvail = ordered.length - openerIdx - 1;
  let leftFit = Math.min(leftAvail, Math.floor((maxPerRow - 1) / 2));
  let rightFit = Math.min(rightAvail, maxPerRow - 1 - leftFit);
  if (leftAvail > leftFit && leftFit + rightFit < maxPerRow - 1) {
    leftFit += Math.min(leftAvail - leftFit, maxPerRow - 1 - leftFit - rightFit);
  }
  const centerStart = openerIdx - leftFit;
  const centerEnd = openerIdx + rightFit + 1;

  const rightOverflow = ordered.slice(centerEnd);     // older→newer right plays
  const leftOverflow = ordered.slice(0, centerStart); // ordered[0] = newest left

  const rows: ChainRow[] = [];

  // Above (right overflow): chunks stacked top-down so newest is at the top
  if (rightOverflow.length > 0) {
    const chunks: BoardTile[][] = [];
    for (let i = 0; i < rightOverflow.length; i += maxPerRow) {
      chunks.push(rightOverflow.slice(i, i + maxPerRow));
    }
    chunks.reverse().forEach((c) => rows.push({ tiles: c, isCenter: false, isFirst: false, isLast: false }));
  }

  rows.push({ tiles: ordered.slice(centerStart, centerEnd), isCenter: true, isFirst: false, isLast: false });

  // Below (left overflow): chunks stacked top-down so newest is at the bottom
  if (leftOverflow.length > 0) {
    const chunks: BoardTile[][] = [];
    for (let i = 0; i < leftOverflow.length; i += maxPerRow) {
      chunks.push(leftOverflow.slice(i, i + maxPerRow));
    }
    chunks.forEach((c) => rows.push({ tiles: c, isCenter: false, isFirst: false, isLast: false }));
  }

  // Mark the visually-first (top-most) and visually-last (bottom-most) rows.
  // The right end of the chain lives at the top row's right; the left end at
  // the bottom row's left.
  rows[0]!.isFirst = true;
  rows[rows.length - 1]!.isLast = true;
  return rows;
}

// Pop-and-fade number used for the pre-match countdown. Re-mounts per tick.
function CountdownPopNumber({ n }: { n: number }) {
  const NEVER = ReduceMotion.Never;
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 120, reduceMotion: NEVER }),
      withTiming(1, { duration: 600, reduceMotion: NEVER }),
      withTiming(0, { duration: 280, reduceMotion: NEVER }),
    );
    scale.value = withSequence(
      withTiming(1.4, { duration: 180, easing: Easing.out(Easing.back(2)), reduceMotion: NEVER }),
      withSpring(1, { damping: 9, stiffness: 220, reduceMotion: NEVER }),
      withTiming(1.8, { duration: 280, reduceMotion: NEVER }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.Text style={[styles.matchCountdownNum, style]}>{n}</Animated.Text>;
}

// Pulsing green glow used to mark the legal end-of-board tile while dragging.
function LegalGlow({ active, children }: { active: boolean; children: React.ReactNode }) {
  const NEVER = ReduceMotion.Never;
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) { cancelAnimation(pulse); pulse.value = 0; return; }
    pulse.value = withRepeat(
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(pulse);
  }, [active]);
  const style = useAnimatedStyle(() => {
    if (!active) return {};
    return {
      shadowColor: "#4caf50",
      shadowOpacity: 0.5 + pulse.value * 0.5,
      shadowRadius: 6 + pulse.value * 16,
      elevation: 10,
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

// Semi-transparent "ghost" of the dragged tile next to a legal end.
// `flipped` orients the tile so the matching pip faces the chain.
function GhostSlot({ tile, flipped, size = 44, chainDir = "horizontal" }: { tile: Tile; flipped?: boolean; size?: number; chainDir?: "horizontal" | "vertical" }) {
  const NEVER = ReduceMotion.Never;
  const opacity = useSharedValue(0.25);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.65, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(opacity);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  // Vertical chain: regular tiles render vertical (along chain), doubles horizontal (perpendicular).
  const orientation = chainDir === "vertical"
    ? (isDouble(tile) ? "horizontal" : "vertical")
    : (isDouble(tile) ? "vertical" : "horizontal");
  const spacing = chainDir === "vertical" ? { marginVertical: 2 } : { marginHorizontal: 2 };
  return (
    <Animated.View style={[spacing, style]}>
      <DominoTile
        a={tile.a} b={tile.b} size={size}
        orientation={orientation}
        flipped={flipped}
      />
    </Animated.View>
  );
}

// "Magnet" entry — tile flies in from the player's seat, overshoots slightly
// past the slot as if pulled, then snaps back with a small scale pop.
function PopInTile({ bt, fromDir, glow, size = 44, chainDir = "horizontal" }: {
  bt: BoardTile; fromDir: "top" | "left" | "right" | "bottom"; glow?: boolean; size?: number; chainDir?: "horizontal" | "vertical";
}) {
  const NEVER = ReduceMotion.Never;
  const APPROACH_MS = 280;

  const dxStart = fromDir === "left" ? -160 : fromDir === "right" ? 160 : 0;
  const dyStart = fromDir === "top" ? -140 : fromDir === "bottom" ? 140 : 0;
  // Overshoot a bit past 0 in the direction of travel
  const dxOver = fromDir === "left" ? 22 : fromDir === "right" ? -22 : 0;
  const dyOver = fromDir === "top" ? 22 : fromDir === "bottom" ? -22 : 0;
  const rotStart = fromDir === "left" ? -12 : fromDir === "right" ? 12 : 0;

  const tx = useSharedValue(dxStart);
  const ty = useSharedValue(dyStart);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const rot = useSharedValue(rotStart);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 120, reduceMotion: NEVER });
    tx.value = withSequence(
      withTiming(dxOver, { duration: APPROACH_MS, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }),
      withSpring(0, { damping: 9, stiffness: 280, reduceMotion: NEVER }),
    );
    ty.value = withSequence(
      withTiming(dyOver, { duration: APPROACH_MS, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }),
      withSpring(0, { damping: 9, stiffness: 280, reduceMotion: NEVER }),
    );
    rot.value = withSpring(0, { damping: 10, stiffness: 240, reduceMotion: NEVER });
    scale.value = withSequence(
      withDelay(APPROACH_MS - 20, withTiming(1.18, { duration: 90, reduceMotion: NEVER })),
      withSpring(1, { damping: 9, stiffness: 280, reduceMotion: NEVER }),
    );
    // Click as the tile lands.
    const clickT = setTimeout(() => playClick(), APPROACH_MS - 10);
    return () => clearTimeout(clickT);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
      { rotate: `${rot.value}deg` },
    ],
  }));

  const orientation = chainDir === "vertical"
    ? (isDouble(bt.tile) ? "horizontal" : "vertical")
    : (isDouble(bt.tile) ? "vertical" : "horizontal");
  const spacing = chainDir === "vertical" ? { marginVertical: 2 } : { marginHorizontal: 2 };
  return (
    <Animated.View style={[spacing, style]}>
      <LegalGlow active={!!glow}>
        <DominoTile
          a={bt.tile.a}
          b={bt.tile.b}
          size={size}
          orientation={orientation}
          flipped={bt.flipped}
        />
      </LegalGlow>
    </Animated.View>
  );
}

// Gold pulse around the active seat's panel when turn changes.
function TurnPulseWrapper({ isActive, children, style: outerStyle }: {
  isActive: boolean; children: React.ReactNode; style?: any;
}) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (isActive) {
      glow.value = 0;
      glow.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.Never }),
        -1, true,
      );
    } else {
      cancelAnimation(glow);
      glow.value = withTiming(0, { duration: 200, reduceMotion: ReduceMotion.Never });
    }
    return () => cancelAnimation(glow);
  }, [isActive]);
  const aStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + glow.value * 0.55,
    shadowRadius: 6 + glow.value * 14,
    transform: [{ scale: 1 + glow.value * 0.025 }],
  }));
  return (
    <Animated.View style={[outerStyle, isActive && { shadowColor: "#f2c14e" }, isActive && aStyle]}>
      {children}
    </Animated.View>
  );
}

// Speaks "Pass" via the browser's SpeechSynthesis API (web). On native it
// silently no-ops — to enable on mobile, add expo-speech.
function speakPass() { speak("Pass", { rate: 1.05 }); }

// Pass announcement positioned next to the player who passed.
function PassAnnouncement({ seat, side }: {
  seat: Seat; side: "top" | "left" | "right" | "bottom";
}) {
  useEffect(() => { speakPass(); }, []);
  // Small bubble anchored close to the seat's panel.
  const positionStyle =
    side === "top"    ? { top: 70,    left: 0, right: 0, alignItems: "center" as const } :
    side === "bottom" ? { bottom: 110, left: 0, right: 0, alignItems: "center" as const } :
    side === "left"   ? { left: 50,   top: "45%" as any, alignItems: "flex-start" as const } :
                        { right: 50,  top: "45%" as any, alignItems: "flex-end" as const };

  return (
    <View pointerEvents="none" style={[styles.passWrap, positionStyle]}>
      <View style={styles.passBubble}>
        <Text style={styles.passBubbleText}>Pass</Text>
      </View>
    </View>
  );
}

// Announcement entry: scale-up + shake.
function AnimatedAnnouncement({ children }: { children: React.ReactNode }) {
  const NEVER = ReduceMotion.Never;
  const scale = useSharedValue(0.2);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 90, reduceMotion: NEVER });
    scale.value = withSequence(
      withTiming(1.2, { duration: 130, easing: Easing.out(Easing.back(3)), reduceMotion: NEVER }),
      withSpring(1, { damping: 12, stiffness: 320, reduceMotion: NEVER }),
    );
    rot.value = withSequence(
      withTiming(-5, { duration: 40, reduceMotion: NEVER }),
      withTiming(5, { duration: 50, reduceMotion: NEVER }),
      withTiming(-3, { duration: 40, reduceMotion: NEVER }),
      withTiming(0, { duration: 50, reduceMotion: NEVER }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rot.value}deg` }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

// Card-flip reveal for round-end tiles.
function FlipTile({ a, b, delay, orientation = "horizontal", size = 22 }: {
  a: any; b: any; delay: number;
  orientation?: "horizontal" | "vertical"; size?: number;
}) {
  const NEVER = ReduceMotion.Never;
  const rotY = useSharedValue(90);
  const opacity = useSharedValue(0);
  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 120, reduceMotion: NEVER });
      rotY.value = withSpring(0, { damping: 12, stiffness: 140, reduceMotion: NEVER });
    }, delay);
    return () => clearTimeout(t);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ perspective: 600 }, { rotateY: `${rotY.value}deg` }],
  }));
  return (
    <Animated.View style={[{ marginHorizontal: 2 }, style]}>
      <DominoTile a={a} b={b} size={size} orientation={orientation} />
    </Animated.View>
  );
}

// Burst of coins that fly up and fade — celebrates a win.
function CoinBurst() {
  const pieces = Array.from({ length: 18 }).map((_, i) => i);
  return (
    <View pointerEvents="none" style={burstStyles.container}>
      {pieces.map((i) => <CoinPiece key={i} index={i} />)}
    </View>
  );
}

function CoinPiece({ index }: { index: number }) {
  const NEVER = ReduceMotion.Never;
  const angle = (index / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
  const dist = 120 + Math.random() * 140;
  const dx = Math.cos(angle) * dist;
  const dy = Math.sin(angle) * dist - 60; // bias upward
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rot = useSharedValue(0);
  const scale = useSharedValue(0.4);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 200, reduceMotion: NEVER });
    tx.value = withTiming(dx, { duration: 1200, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    ty.value = withTiming(dy, { duration: 1200, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    rot.value = withTiming((Math.random() - 0.5) * 720, { duration: 1200, reduceMotion: NEVER });
    opacity.value = withSequence(
      withTiming(1, { duration: 200, reduceMotion: NEVER }),
      withTiming(0, { duration: 900, reduceMotion: NEVER }),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value }, { translateY: ty.value },
      { rotate: `${rot.value}deg` }, { scale: scale.value },
    ],
    opacity: opacity.value,
  }));
  return (
    <Animated.Text style={[burstStyles.coin, style]}>🪙</Animated.Text>
  );
}

const burstStyles = StyleSheet.create({
  container: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center", zIndex: 6000,
  },
  coin: { position: "absolute", fontSize: 28 },
});

// Pulsing legal-drop highlight — ripples while a tile is being dragged.
function PulsingDropHalf({ side, valid }: { side: "left" | "right"; valid: boolean }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (valid) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease), reduceMotion: ReduceMotion.Never }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [valid]);

  const style = useAnimatedStyle(() => {
    if (!valid) {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }
    return {
      opacity: 0.45 + pulse.value * 0.55,
      transform: [{ scale: 1 + pulse.value * 0.04 }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.dropHalf,
        side === "left" ? styles.dropHalfLeft : styles.dropHalfRight,
        valid ? styles.dropHalfValid : styles.dropHalfInvalid,
        style,
      ]}
    />
  );
}

// Animated pip total — counts up from 0 to `target` so you see the math live.
function CountUp({ target, style: textStyle, suffix = "" }: { target: number; style?: any; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const duration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { cancelled = true; };
  }, [target]);
  return <Text style={textStyle}>{val}{suffix}</Text>;
}

// Reveals a hand face-up where face-down tiles used to be, with staggered flip-in.
function RevealedFan({ hand, vertical }: { hand: Tile[]; vertical?: boolean }) {
  return (
    <View style={vertical ? styles.fdCol : styles.fdRow}>
      {hand.map((t, i) => (
        <FlipTile key={t.id} a={t.a} b={t.b} delay={i * 70} />
      ))}
    </View>
  );
}

function FaceDownTiles({ count, vertical, tilesVertical, spotlightIndex }: {
  count: number; vertical?: boolean; tilesVertical?: boolean; spotlightIndex?: number | null;
}) {
  const useVerticalTile = !!tilesVertical;
  const tileStyle = useVerticalTile ? styles.fdTileV : styles.fdTileH;
  const shown = Math.min(count, 6);
  // Clamp spotlight to a visible tile
  const spotIdx = (typeof spotlightIndex === "number" && shown > 0)
    ? Math.min(spotlightIndex, shown - 1) : null;
  return (
    <View style={vertical ? styles.fdCol : styles.fdRow}>
      {Array.from({ length: shown }).map((_, i) => (
        i === spotIdx
          ? <SpotlightFaceTile key={i} baseStyle={tileStyle} />
          : <View key={i} style={tileStyle} />
      ))}
      {count > 6 && <Text style={styles.fdMore}>+{count - 6}</Text>}
    </View>
  );
}

// Pulsing golden glow over a face-down tile to signal who opens.
function SpotlightFaceTile({ baseStyle }: { baseStyle: any }) {
  const NEVER = ReduceMotion.Never;
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(glow);
  }, []);
  const style = useAnimatedStyle(() => ({
    shadowOpacity: 0.4 + glow.value * 0.6,
    shadowRadius: 4 + glow.value * 14,
    transform: [{ scale: 1 + glow.value * 0.18 }],
    backgroundColor: `rgba(242,193,78,${0.6 + glow.value * 0.4})`,
    borderColor: "#f2c14e",
    borderWidth: 2,
  }));
  return <Animated.View style={[baseStyle, { shadowColor: "#f2c14e" }, style]} />;
}

function CoinBadge({ amount }: { amount: number }) {
  return (
    <View style={styles.coin}>
      <Text style={styles.coinIcon}>🪙</Text>
      <Text style={styles.coinText}>{amount.toLocaleString()}</Text>
    </View>
  );
}

function OpenSeatPanel({
  position,
}: {
  seat: Seat;
  position: "top" | "left" | "right" | "bottom";
  onClaim?: () => void;
  disabled?: boolean;
}) {
  const stylesByPos: Record<string, any> = {
    top: styles.topPlayer,
    left: styles.sidePlayer,
    right: styles.sidePlayer,
    bottom: undefined,
  };
  return (
    <View style={[stylesByPos[position], openSeatStyles.panel]}>
      <View style={openSeatStyles.circle} />
      <Text style={openSeatStyles.label}>ESPERANDO...</Text>
    </View>
  );
}

const openSeatStyles = StyleSheet.create({
  panel: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#8a9a82",
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { color: "#8a9a82", fontSize: 32, fontWeight: "300", marginTop: -4 },
  label: { color: "#9fd0aa", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
});

function PlayerPanel({
  seat, isActive, score, handCount, position, isWinner, hideTiles, spotlightIndex, displayName,
}: {
  seat: Seat; isActive: boolean; score: number; handCount: number;
  position: "top" | "left" | "right"; isWinner?: boolean; hideTiles?: boolean;
  spotlightIndex?: number | null; displayName?: string;
}) {
  const label = displayName ?? LABELS[seat]!;
  if (position === "top") {
    return (
      <TurnPulseWrapper isActive={isActive} style={[styles.topPlayer, isActive && styles.activePanel, isWinner && styles.winnerPanel]}>
        {!hideTiles && <FaceDownTiles count={handCount} tilesVertical spotlightIndex={spotlightIndex} />}
        <View style={styles.topPlayerInfo}>
          <View>
            <Text style={styles.playerName}>{label}{isWinner ? " 🏆" : ""}</Text>
            <CoinBadge amount={score} />
          </View>
        </View>
      </TurnPulseWrapper>
    );
  }
  return (
    <TurnPulseWrapper isActive={isActive} style={[styles.sidePlayer, isActive && styles.activePanel, isWinner && styles.winnerPanel]}>
      <Text style={styles.playerNameSide}>{label}{isWinner ? " 🏆" : ""}</Text>
      <CoinBadge amount={score} />
      {!hideTiles && <FaceDownTiles count={handCount} vertical spotlightIndex={spotlightIndex} />}
    </TurnPulseWrapper>
  );
}

// Round-robin dealing overlay — flies face-down tiles from a central stack to
// each seat, one tile per seat per "round". Tiles stack neatly in front of
// each player and persist for the duration of the deal.
function DealingOverlay({
  countsBySeat, seatOrder, targetsBySide, onYourTileTick, onDone,
}: {
  countsBySeat: Record<number, number>;
  seatOrder: { seat: Seat; side: "top" | "left" | "right" | "bottom" }[];
  targetsBySide: Partial<Record<"top" | "left" | "right" | "bottom", { x: number; y: number }>>;
  onYourTileTick: () => void;
  onDone: () => void;
}) {
  const STEP_MS = 180;
  const SHUFFLE_MS = 1800;
  const TRAVEL_MS = 320;
  const TILE_W = 32, TILE_H = 18, GAP = 3;

  type Piece = {
    id: string;
    side: "top" | "left" | "right" | "bottom";
    seatIndexInRow: number; // 0..count-1 (tile index for that seat)
    seatCount: number;
    dealOrder: number;      // global order across the entire deal
  };

  // Build pieces in round-robin order
  const maxRounds = Math.max(0, ...seatOrder.map((s) => countsBySeat[s.seat] ?? 0));
  const pieces: Piece[] = [];
  let order = 0;
  const perSeatPlaced: Record<number, number> = {};
  for (let r = 0; r < maxRounds; r++) {
    for (const { seat, side } of seatOrder) {
      const total = countsBySeat[seat] ?? 0;
      if (total > r) {
        const idx = perSeatPlaced[seat] ?? 0;
        pieces.push({
          id: `${seat}-${r}`, side,
          seatIndexInRow: idx, seatCount: total, dealOrder: order++,
        });
        perSeatPlaced[seat] = idx + 1;
      }
    }
  }
  const [shuffling, setShuffling] = useState(true);
  const totalMs = pieces.length * STEP_MS + 600;

  useEffect(() => {
    playShuffle();
    const shuffleEnd = setTimeout(() => setShuffling(false), SHUFFLE_MS);
    const timers: ReturnType<typeof setTimeout>[] = [];
    pieces.forEach((p) => {
      if (p.side === "bottom") {
        timers.push(setTimeout(onYourTileTick, SHUFFLE_MS + p.dealOrder * STEP_MS + TRAVEL_MS));
      }
    });
    timers.push(setTimeout(onDone, SHUFFLE_MS + totalMs + TRAVEL_MS));
    return () => { clearTimeout(shuffleEnd); timers.forEach(clearTimeout); };
  }, []);

  const targetFor = (p: Piece) => {
    // Use the measured center of each player's hand zone as the anchor, then
    // fan tiles around it along the appropriate axis.
    const anchor = targetsBySide[p.side] ?? { x: 0, y: 0 };
    const horizontalAxis = p.side === "top" || p.side === "bottom";
    const span = horizontalAxis ? TILE_W + GAP : TILE_H + GAP;
    const offset = (p.seatIndexInRow - (p.seatCount - 1) / 2) * span;
    return horizontalAxis
      ? { x: anchor.x + offset, y: anchor.y }
      : { x: anchor.x, y: anchor.y + offset };
  };

  return (
    <View pointerEvents="none" style={dealStyles.layer}>
      {shuffling ? (
        <ShufflePile />
      ) : (
        <>
          <View style={dealStyles.stack}>
            <View style={dealStyles.stackTile} />
            <View style={[dealStyles.stackTile, { top: -2, left: -2 }]} />
            <View style={[dealStyles.stackTile, { top: -4, left: -4 }]} />
          </View>
          {pieces.map((p) => {
              const t = targetFor(p);
              return <DealingTile key={p.id} dx={t.x} dy={t.y} delay={p.dealOrder * STEP_MS} />;
            })}
        </>
      )}
    </View>
  );
}

// Shuffle: 28 face-down tiles piled in random positions, wiggling continuously
// to mimic shuffling a real domino set.
function ShufflePile() {
  const items = Array.from({ length: 28 });
  return (
    <View style={dealStyles.shuffleWrap}>
      {items.map((_, i) => <ShufflePiece key={i} index={i} />)}
    </View>
  );
}

function ShufflePiece({ index }: { index: number }) {
  const NEVER = ReduceMotion.Never;
  // Persistent base offset so the 28 tiles spread instead of stacking on one spot.
  const baseX = (Math.random() - 0.5) * 80;
  const baseY = (Math.random() - 0.5) * 56;
  const baseRot = (Math.random() - 0.5) * 90;
  const tx = useSharedValue(baseX);
  const ty = useSharedValue(baseY);
  const rot = useSharedValue(baseRot);
  useEffect(() => {
    const wiggle = () => {
      tx.value = withTiming(baseX + (Math.random() - 0.5) * 40, { duration: 170, reduceMotion: NEVER });
      ty.value = withTiming(baseY + (Math.random() - 0.5) * 32, { duration: 170, reduceMotion: NEVER });
      rot.value = withTiming(baseRot + (Math.random() - 0.5) * 50, { duration: 170, reduceMotion: NEVER });
    };
    const startDelay = (index % 10) * 15;
    const startT = setTimeout(() => wiggle(), startDelay);
    const id = setInterval(wiggle, 180);
    return () => { clearTimeout(startT); clearInterval(id); };
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        dealStyles.flier,
        { position: "absolute", left: -16, top: -9 },
        style,
      ]}
    />
  );
}

function DealingTile({ dx, dy, delay }: { dx: number; dy: number; delay: number }) {
  const NEVER = ReduceMotion.Never;
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 80, reduceMotion: NEVER });
      scale.value = withSpring(1, { damping: 12, stiffness: 240, reduceMotion: NEVER });
      tx.value = withTiming(dx, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
      ty.value = withTiming(dy, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    }, delay);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value }, { translateY: ty.value }, { scale: scale.value },
    ],
  }));

  return <Animated.View style={[dealStyles.flier, style]} />;
}

const dealStyles = StyleSheet.create({
  layer: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center", zIndex: 4500,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  shuffleWrap: { width: 1, height: 1, alignItems: "center", justifyContent: "center" },
  stack: { position: "absolute", width: 32, height: 18 },
  stackTile: {
    position: "absolute", width: 32, height: 18, backgroundColor: "#f5f0dc",
    borderRadius: 3, borderWidth: 1, borderColor: "#c8b89a",
  },
  flier: {
    position: "absolute", width: 32, height: 18, backgroundColor: "#f5f0dc",
    borderRadius: 3, borderWidth: 1, borderColor: "#c8b89a",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
});

// Pip pill that bounces every time its value changes — used as the running sum.
function PipPill({ value, isWinner }: { value: number; isWinner: boolean }) {
  const NEVER = ReduceMotion.Never;
  const scale = useSharedValue(1);
  const flash = useSharedValue(0);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.35, { duration: 110, easing: Easing.out(Easing.back(2)), reduceMotion: NEVER }),
      withSpring(1, { damping: 9, stiffness: 240, reduceMotion: NEVER }),
    );
    flash.value = 1;
    flash.value = withTiming(0, { duration: 380, reduceMotion: NEVER });
  }, [value]);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: isWinner
      ? `rgba(76,175,80,${0.55 + flash.value * 0.4})`
      : `rgba(0,0,0,${0.55 + flash.value * 0.35})`,
  }));
  return (
    <Animated.View style={[revStyles.pipPill, isWinner && revStyles.pipPillWinner, aStyle]}>
      <Text style={revStyles.pipText}>{value} pts</Text>
      {isWinner && <Text style={revStyles.pipText}> 🏆</Text>}
    </Animated.View>
  );
}

// Sequentially reveals each tile and adds its pips to a running total.
function SummingHand({ hand, isWinner, vertical }: {
  hand: Tile[]; isWinner: boolean; vertical: boolean;
}) {
  const STEP_MS = 350;
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    hand.forEach((_, i) => {
      timers.push(setTimeout(() => setRevealed(i + 1), (i + 1) * STEP_MS));
    });
    return () => timers.forEach(clearTimeout);
  }, []);
  const runningTotal = hand.slice(0, revealed).reduce((s, t) => s + t.a + t.b, 0);
  return (
    <>
      <View style={[revStyles.tiles, vertical && revStyles.tilesVertical]}>
        {hand.map((t, i) => (
          <FlipTile key={t.id} a={t.a} b={t.b} delay={i * STEP_MS} orientation="vertical" size={44} />
        ))}
      </View>
      <PipPill value={runningTotal} isWinner={isWinner} />
    </>
  );
}

// Lays each player's revealed hand on the felt near their edge, all tiles
// rendered vertical at board size, summed live with a bouncing pip pill.
function RevealedHandsOnBoard({
  data, positions, yourSeat, active,
}: {
  data: RoundEndData;
  positions: Record<number, "top" | "left" | "right">;
  yourSeat: Seat;
  active: readonly Seat[];
}) {
  const sideFor = (seat: Seat): "top" | "left" | "right" | "bottom" =>
    seat === yourSeat ? "bottom" : positions[seat] ?? "top";

  return (
    <View pointerEvents="none" style={revStyles.layer}>
      {active.map((seat) => {
        const hand = (data.hands[seat] as Tile[] | undefined) ?? [];
        if (hand.length === 0) return null;
        const side = sideFor(seat);
        const isWinner = seat === data.winnerSeat;
        const isVerticalAxis = side === "left" || side === "right";
        return (
          <View
            key={seat}
            style={[
              revStyles.row,
              side === "top" && revStyles.rowTop,
              side === "bottom" && revStyles.rowBottom,
              side === "left" && revStyles.rowLeft,
              side === "right" && revStyles.rowRight,
            ]}
          >
            <SummingHand hand={hand} isWinner={isWinner} vertical={isVerticalAxis} />
          </View>
        );
      })}
    </View>
  );
}

const revStyles = StyleSheet.create({
  layer: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, zIndex: 50 },
  row: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6 },
  rowTop:    { top: 4,    left: 0, right: 0, justifyContent: "center", flexDirection: "row" },
  rowBottom: { bottom: 4, left: 0, right: 0, justifyContent: "center", flexDirection: "row" },
  rowLeft:   { left: 4,  top: 0, bottom: 0, justifyContent: "center", flexDirection: "column", alignItems: "center" },
  rowRight:  { right: 4, top: 0, bottom: 0, justifyContent: "center", flexDirection: "column", alignItems: "center" },
  tiles: { flexDirection: "row", gap: 2, alignItems: "center" },
  tilesVertical: { flexDirection: "column" },
  pipPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.65)", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, borderWidth: 1, borderColor: "#f2c14e",
  },
  pipPillWinner: { borderColor: "#4caf50", backgroundColor: "rgba(0,0,0,0.75)" },
  pipText: { color: "#f2c14e", fontWeight: "900", fontSize: 13 },
});

export default function Table() {
  const { yourSeat, yourHand, publicState, announcement, roundEndData, setRoundEndData, waiting, matchCountdownDeadline, pending, openerDraw } = useGameStore();

  // Pre-match countdown — ticks every 250ms while the deadline is in the future.
  const [countdownSec, setCountdownSec] = useState<number | null>(null);
  useEffect(() => {
    if (!matchCountdownDeadline) { setCountdownSec(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((matchCountdownDeadline - Date.now()) / 1000));
      setCountdownSec(remaining);
      if (remaining <= 0) setCountdownSec(null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [matchCountdownDeadline]);

  // Lookup display name from waiting payload (real player names), else fallback.
  const seatName = (seat: Seat): string | undefined => {
    const w = waiting?.seats?.find((s) => s.seat === seat);
    if (w && w.occupied) return w.displayName;
    if (w && !w.occupied) return "Esperando…";
    return undefined;
  };
  const [zones, setZones] = useState<DropZone[]>([]);
  const [draggingTile, setDraggingTile] = useState<Tile | null>(null);
  const [rejectTileId, setRejectTileId] = useState<string | null>(null);
  const [autoPassing, setAutoPassing] = useState(false);
  const [dealing, setDealing] = useState(false);
  const [revealedYou, setRevealedYou] = useState(0);
  const [openerCallout, setOpenerCallout] = useState<{ seat: Seat } | null>(null);
  const [boardWidth, setBoardWidth] = useState(0);
  const [handOrder, setHandOrder] = useState<string[]>([]);
  const [dragMode, setDragMode] = useState<"play" | "reorder" | null>(null);
  const slotBoundsRef = useRef<Map<string, { x: number; w: number }>>(new Map());
  const lastRoundDealtRef = useRef<number | null>(null);
  const handAreaRef = useRef<View>(null);
  const boardScrollRef = useRef<ScrollView>(null);
  const lastBoardLenRef = useRef(0);
  const topPanelRef = useRef<View>(null);
  const leftPanelRef = useRef<View>(null);
  const rightPanelRef = useRef<View>(null);
  const [dealTargets, setDealTargets] = useState<Partial<Record<"top" | "left" | "right" | "bottom", { x: number; y: number }>>>({});
  const leftRef = useRef<View>(null);
  const rightRef = useRef<View>(null);
  const rootRef = useRef<View>(null);
  const boardRowRef = useRef<View>(null);

  // Shared values for the floating drag overlay (UI thread, no bridge crossing)
  const sharedDragX = useSharedValue(0);
  const sharedDragY = useSharedValue(0);
  const sharedDragVisible = useSharedValue(0);
  const rootOffX = useSharedValue(0);
  const rootOffY = useSharedValue(0);

  const onRootLayout = useCallback(() => {
    rootRef.current?.measure((_x, _y, _w, _h, px, py) => {
      rootOffX.value = px;
      rootOffY.value = py;
    });
  }, []);

  // Vertical tile at size=44: width=44, height=44*2+3=91
  const overlayStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: sharedDragX.value - rootOffX.value - 22,
    top: sharedDragY.value - rootOffY.value - 45,
    zIndex: 9999,
    elevation: 50,
    opacity: sharedDragVisible.value,
    transform: [{ scale: 1.18 }],
  }));

  const isYourTurn = publicState?.currentSeat === yourSeat;
  const leftEnd = publicState?.leftEnd ?? null;
  const rightEnd = publicState?.rightEnd ?? null;
  const boardEmpty = leftEnd === null && rightEnd === null;
  const active: readonly Seat[] = publicState?.activeSeats ?? [0, 1, 2, 3];
  // Map the 4 visual positions (bottom, right, top, left) to seat numbers.
  // If user is seated, rotate so their seat is bottom; if observer, default 0=bottom.
  const myBottom: number = yourSeat ?? 0;
  const seatAt = (offset: 0 | 1 | 2 | 3) => ((myBottom + offset) % 4) as Seat;
  const bottomSeat: Seat = seatAt(0);
  const rightSeat: Seat | undefined = seatAt(1);
  const topSeat: Seat | undefined = seatAt(2);
  const leftSeat: Seat | undefined = seatAt(3);
  // Seat occupancy lookup. During play, all active seats are occupied.
  // During waiting/observer, derive from waiting.seats.
  const seatOccupancy: Record<number, { occupied: boolean; displayName?: string; isYou?: boolean }> = {};
  if (waiting) {
    for (const s of waiting.seats) {
      seatOccupancy[s.seat] = { occupied: s.occupied, displayName: s.displayName, isYou: s.seat === waiting.yourSeat };
    }
  } else if (publicState) {
    for (const s of active) seatOccupancy[s] = { occupied: true, isYou: s === yourSeat };
  } else {
    for (const s of [0, 1, 2, 3]) seatOccupancy[s] = { occupied: false };
  }
  const positions: Record<number, "top" | "left" | "right" | "bottom"> = {
    [bottomSeat]: "bottom", [rightSeat]: "right", [topSeat]: "top", [leftSeat]: "left",
  };
  const isSeatOccupied = (s: Seat) => seatOccupancy[s]?.occupied === true;
  const handleClaimSeat = async (s: Seat) => {
    await sitAtSeat(s as 0 | 1 | 2 | 3);
  };

  const scores = publicState?.scores ?? { 0: 0, 1: 0, 2: 0, 3: 0 };
  const counts = publicState?.handCounts ?? { 0: 0, 1: 0, 2: 0, 3: 0 };

  const legalFor = (tile: Tile) => ({
    left: canPlayTile(tile, leftEnd as Pip | null, rightEnd as Pip | null, "left"),
    right: canPlayTile(tile, leftEnd as Pip | null, rightEnd as Pip | null, "right"),
  });

  const openerTileId = boardEmpty && yourHand.length > 0 ? findOpenerTile(yourHand).id : null;

  // Keep handOrder in sync with yourHand. Preserves the user's chosen order
  // for tiles still in hand; new tiles (after deal) get appended.
  useEffect(() => {
    const ids = yourHand.map((t) => t.id);
    setHandOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [yourHand]);

  const orderedHand = handOrder
    .map((id) => yourHand.find((t) => t.id === id))
    .filter((t): t is Tile => Boolean(t));

  const onReorder = useCallback((draggedTile: Tile, dropX: number) => {
    setHandOrder((prev) => {
      const fromIdx = prev.indexOf(draggedTile.id);
      if (fromIdx === -1 || prev.length === 0) return prev;
      // Derive uniform slot metrics from current bounds.
      let minX = Infinity;
      let slotW = 0;
      for (const id of prev) {
        const b = slotBoundsRef.current.get(id);
        if (!b) continue;
        if (b.x < minX) minX = b.x;
        if (b.w > slotW) slotW = b.w;
      }
      if (slotW <= 0 || !isFinite(minX)) return prev;

      // Swap only when the dragged tile has fully passed the neighbor —
      // i.e. dropX has crossed the neighbor's FAR edge (opposite to drag origin).
      let target = fromIdx;
      while (target > 0) {
        const neighborLeftEdge = minX + (target - 1) * slotW;
        if (dropX < neighborLeftEdge) target -= 1;
        else break;
      }
      while (target < prev.length - 1) {
        const neighborRightEdge = minX + (target + 2) * slotW;
        if (dropX > neighborRightEdge) target += 1;
        else break;
      }
      if (target === fromIdx) return prev;
      const next = [...prev];
      next.splice(fromIdx, 1);
      next.splice(target, 0, draggedTile.id);
      return next;
    });
  }, []);


  const dragging = draggingTile !== null;
  const dragLegal = draggingTile
    ? (boardEmpty
        ? (draggingTile.id === openerTileId ? { left: true, right: true } : { left: false, right: false })
        : legalFor(draggingTile))
    : null;

  const hasLegalMove = (boardEmpty && openerTileId !== null) || yourHand.some((t) => {
    const l = legalFor(t);
    return l.left || l.right;
  });

  // Detect a fresh deal: new round number + empty board + we have a hand.
  useEffect(() => {
    const round = publicState?.roundNo ?? null;
    const boardLen = publicState?.board.length ?? 0;
    if (
      round !== null &&
      boardLen === 0 &&
      yourHand.length > 0 &&
      lastRoundDealtRef.current !== round
    ) {
      lastRoundDealtRef.current = round;
      setRevealedYou(0);
      setDealing(true);
    }
  }, [publicState?.roundNo, publicState?.board.length, yourHand.length]);

  // Measure hand-area / opponent-panel positions when dealing starts so flying
  // tiles can land in the actual hand zones (not arbitrary felt offsets).
  useEffect(() => {
    if (!dealing) return;
    const t = setTimeout(() => {
      rootRef.current?.measure((_x, _y, rw, rh, rpx, rpy) => {
        const rcx = rpx + rw / 2;
        const rcy = rpy + rh / 2;
        const result: typeof dealTargets = {};
        const tasks: { ref: React.RefObject<View>; side: "top" | "left" | "right" | "bottom" }[] = [
          { ref: handAreaRef, side: "bottom" },
          { ref: topPanelRef, side: "top" },
          { ref: leftPanelRef, side: "left" },
          { ref: rightPanelRef, side: "right" },
        ];
        let pending = tasks.length;
        tasks.forEach(({ ref, side }) => {
          if (!ref.current) { if (--pending === 0) setDealTargets(result); return; }
          ref.current.measure((_x2, _y2, w, h, px, py) => {
            result[side] = { x: px + w / 2 - rcx, y: py + h / 2 - rcy };
            if (--pending === 0) setDealTargets(result);
          });
        });
      });
    }, 40);
    return () => clearTimeout(t);
  }, [dealing]);

// Voice announcements for blocked / domino / winner.
  useEffect(() => {
    if (announcement?.type === "blocked") speak("Trancado", { rate: 0.95 });
  }, [announcement]);
  useEffect(() => {
    if (!roundEndData) return;
    if (roundEndData.reason === "blocked") {
      speak("Trancado", { rate: 0.95 });
    } else if (roundEndData.winnerSeat !== null) {
      const name = LABELS[roundEndData.winnerSeat] ?? "";
      speak(`Domino, gana ${name}`, { rate: 1.0 });
    }
  }, [roundEndData?.reason, roundEndData?.winnerSeat]);

// After dealing finishes, if the board has an opener, briefly show who opened.
  useEffect(() => {
    if (dealing) return;
    const opener = publicState?.board.find((bt) => bt.end === "start");
    if (!opener) return;
    setOpenerCallout({ seat: opener.playedBy });
    const t = setTimeout(() => setOpenerCallout(null), 2200);
    return () => clearTimeout(t);
  }, [dealing, publicState?.roundNo]);

  // Auto-pass when it's your turn and no legal moves
  useEffect(() => {
    if (isYourTurn && !hasLegalMove && publicState?.phase === "playing") {
      setAutoPassing(true);
      const t = setTimeout(async () => {
        const s = await getSocket();
        s.emit("game:pass", {}, () => {});
        setAutoPassing(false);
      }, 1800);
      return () => { clearTimeout(t); setAutoPassing(false); };
    }
  }, [isYourTurn, hasLegalMove, publicState?.phase]);

  const measureZones = () => {
    boardRowRef.current?.measure((_x, _y, w, h, px, py) => {
      // Vertical chain: top half = "left" end, bottom half = "right" end.
      const halfH = h / 2;
      const padX = 40;
      setZones([
        { x: px - padX, y: py - 10, w: w + padX * 2, h: halfH + 10, end: "left" },
        { x: px - padX, y: py + halfH, w: w + padX * 2, h: halfH + 10, end: "right" },
      ]);
      setBoardWidth(w);
    });
  };

  useEffect(() => {
    const t = setTimeout(measureZones, 300);
    return () => clearTimeout(t);
  }, [publicState?.board.length]);

  const playTile = async (tile: Tile, end: "left" | "right") => {
    const s = await getSocket();
    s.emit("game:playTile", { tileId: tile.id, end }, (r: any) => {
      if (r?.ok) {
        useGameStore.getState().removeTile(tile.id);
      } else {
        setRejectTileId(tile.id);
        setTimeout(() => setRejectTileId(null), 800);
      }
    });
  };

  const pass = async () => {
    const s = await getSocket();
    s.emit("game:pass", {}, () => {});
  };

  // (WaitingRoom intentionally removed — table renders immediately with empty seats.)

  return (
    <View ref={rootRef} style={styles.root} onLayout={onRootLayout}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Pressable onPress={confirmLeaveRoom} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>← Salir</Text>
        </Pressable>
      </View>

      {/* TOP OPPONENT — outside the wooden frame so always visible */}
      <View ref={topPanelRef} collapsable={false}>
        {isSeatOccupied(topSeat) ? (
          <PlayerPanel
            seat={topSeat}
            isActive={publicState?.currentSeat === topSeat}
            score={scores[topSeat] ?? 0}
            handCount={counts[topSeat] ?? 0}
            position="top"
            isWinner={roundEndData?.winnerSeat === topSeat}
            hideTiles={dealing}
            spotlightIndex={openerCallout?.seat === topSeat ? 2 : null}
            displayName={seatName(topSeat)}
          />
        ) : (
          <OpenSeatPanel
            seat={topSeat}
            position="top"
            onClaim={() => handleClaimSeat(topSeat)}
          />
        )}
      </View>

      {/* MIDDLE: left player | wooden table | right player */}
      <View style={styles.midRow}>
        <View ref={leftPanelRef} collapsable={false}>
          {isSeatOccupied(leftSeat) ? (
            <PlayerPanel
              seat={leftSeat}
              isActive={publicState?.currentSeat === leftSeat}
              score={scores[leftSeat] ?? 0}
              handCount={counts[leftSeat] ?? 0}
              position="left"
              isWinner={roundEndData?.winnerSeat === leftSeat}
              hideTiles={dealing}
              spotlightIndex={openerCallout?.seat === leftSeat ? 2 : null}
              displayName={seatName(leftSeat)}
            />
          ) : (
            <OpenSeatPanel
              seat={leftSeat}
              position="left"
              onClaim={() => handleClaimSeat(leftSeat)}
            />
          )}
        </View>

        {/* WOODEN TABLE */}
        <View style={styles.tableFrame}>
          <View style={styles.tableFelt}>
            {roundEndData && (
              <RevealedHandsOnBoard
                data={roundEndData}
                positions={positions}
                yourSeat={yourSeat ?? 0}
                active={active}
              />
            )}
            <View ref={boardRowRef} collapsable={false} onLayout={measureZones} style={styles.boardRow}>
              {/* Old big-half overlay removed in favor of per-tile glow + ghost slots */}

              {dealing ? (
                <Text style={styles.emptyText}>Repartiendo…</Text>
              ) : publicState?.board.length ? (
                (() => {
                  const ordered = orderBoardForRender(publicState.board);
                  const tileSize = computeTileSize(ordered.length + 2, boardWidth);
                  return (
                    <View style={styles.boardColumn}>
                      {/* Ghost at TOP — drop here to play to the "left" end of the chain */}
                      {dragging && dragLegal?.left && draggingTile && (
                        <GhostSlot
                          tile={draggingTile}
                          size={tileSize}
                          chainDir="vertical"
                          flipped={leftEnd !== null && draggingTile.b !== leftEnd && draggingTile.a === leftEnd}
                        />
                      )}
                      {ordered.map((bt, i) => {
                        const pos = positions[bt.playedBy];
                        const fromDir: "top" | "left" | "right" | "bottom" =
                          bt.playedBy === yourSeat ? "bottom" : (pos ?? "top");
                        const isLeftEnd = i === 0;
                        const isRightEnd = i === ordered.length - 1;
                        const glow =
                          (isLeftEnd && !!(dragging && dragLegal?.left)) ||
                          (isRightEnd && !!(dragging && dragLegal?.right));
                        return (
                          <PopInTile
                            key={bt.tile.id}
                            bt={bt}
                            fromDir={fromDir}
                            glow={glow}
                            size={tileSize}
                            chainDir="vertical"
                          />
                        );
                      })}
                      {/* Ghost at BOTTOM — drop here to play to the "right" end of the chain */}
                      {dragging && dragLegal?.right && draggingTile && (
                        <GhostSlot
                          tile={draggingTile}
                          size={tileSize}
                          chainDir="vertical"
                          flipped={rightEnd !== null && draggingTile.a !== rightEnd && draggingTile.b === rightEnd}
                        />
                      )}
                    </View>
                  );
                })()
              ) : (
                dragging && draggingTile && (dragLegal?.left || dragLegal?.right)
                  ? <GhostSlot tile={draggingTile} />
                  : null
              )}
            </View>

          </View>
        </View>

        <View ref={rightPanelRef} collapsable={false}>
          {isSeatOccupied(rightSeat) ? (
            <PlayerPanel
              seat={rightSeat}
              isActive={publicState?.currentSeat === rightSeat}
              score={scores[rightSeat] ?? 0}
              handCount={counts[rightSeat] ?? 0}
              position="right"
              isWinner={roundEndData?.winnerSeat === rightSeat}
              hideTiles={dealing}
              spotlightIndex={openerCallout?.seat === rightSeat ? 2 : null}
              displayName={seatName(rightSeat)}
            />
          ) : (
            <OpenSeatPanel
              seat={rightSeat}
              position="right"
              onClaim={() => handleClaimSeat(rightSeat)}
            />
          )}
        </View>
      </View>


      {/* YOUR HAND or OPEN SEAT if not yet seated */}
      <View ref={handAreaRef} collapsable={false} style={[styles.handArea, isYourTurn && hasLegalMove && styles.handAreaActive]}>
        {yourSeat === null && !isSeatOccupied(bottomSeat) ? (
          <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
            <OpenSeatPanel
              seat={bottomSeat}
              position="bottom"
              onClaim={() => handleClaimSeat(bottomSeat)}
            />
          </View>
        ) : !publicState && yourSeat !== null ? (
          // Seated but match hasn't started yet — show a "you" placeholder.
          <View style={{ alignItems: "center", justifyContent: "center", flex: 1, gap: 4 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28, borderWidth: 2,
              borderColor: "#f2c14e", backgroundColor: "rgba(242,193,78,0.15)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ color: "#f2c14e", fontSize: 22, fontWeight: "800" }}>
                {(seatName(yourSeat) ?? "Tú").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: "#f2c14e", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              TÚ — SENTADO
            </Text>
          </View>
        ) : (
        <View style={styles.hand}>
          {(() => {
            const list = dealing ? orderedHand.slice(0, revealedYou) : orderedHand;
            const insertionIdx =
              dragMode === "reorder" && draggingTile
                ? handOrder.indexOf(draggingTile.id)
                : -1;
            return list.map((t) => {
              const legal = boardEmpty
                ? (t.id === openerTileId ? { left: true, right: true } : { left: false, right: false })
                : legalFor(t);
              const anyLegal = legal.left || legal.right;
              const isRejected = t.id === rejectTileId;
              const myIdx = handOrder.indexOf(t.id);
              let gapShift = 0;
              if (insertionIdx !== -1 && t.id !== draggingTile?.id) {
                if (myIdx === insertionIdx - 1) gapShift = -10;
                else if (myIdx === insertionIdx + 1) gapShift = 10;
              }
              const isOpener = t.id === openerTileId && isYourTurn && boardEmpty;
              return (
                <SlotMeasure
                  key={t.id}
                  tileId={t.id}
                  style={[styles.handSlot, isRejected && styles.handSlotRejected]}
                  gapShift={gapShift}
                  highlight={isOpener}
                  onMeasure={(id, x, w) => slotBoundsRef.current.set(id, { x, w })}
                >
                  <DraggableTile
                    tile={t}
                    size={32}
                    disabled={!isYourTurn || !anyLegal || !hasLegalMove || !!announcement}
                    dim={isYourTurn && hasLegalMove && !anyLegal}
                    legalEnds={legal}
                    zones={zones}
                    sharedDragX={sharedDragX}
                    sharedDragY={sharedDragY}
                    sharedDragVisible={sharedDragVisible}
                    onDragStart={(dragged) => setDraggingTile(dragged)}
                    onDragEnd={() => setDraggingTile(null)}
                    onDrop={(end) => playTile(t, end)}
                    onReorder={onReorder}
                    onReorderUpdate={onReorder}
                    onDragModeChange={setDragMode}
                  />
                </SlotMeasure>
              );
            });
          })()}
        </View>
        )}
      </View>

      {/* FLOATING DRAG OVERLAY — renders above everything, avoids ScrollView clip */}
      <Animated.View pointerEvents="none" style={overlayStyle}>
        {draggingTile && <DominoTile a={draggingTile.a} b={draggingTile.b} size={44} />}
      </Animated.View>


      {/* PENDING — mid-match join, waiting for next round */}
      {pending && !publicState && (
        <View pointerEvents="none" style={styles.pendingWrap}>
          <View style={styles.pendingPill}>
            <Text style={styles.pendingTitle}>ESPERANDO</Text>
            <Text style={styles.pendingSub}>La partida está en curso. Entrarás en la próxima ronda.</Text>
          </View>
        </View>
      )}

      {/* OPENER DRAW — random tile per seat, highest wins the first opener */}
      {openerDraw && (
        <View pointerEvents="none" style={openerDrawStyles.overlay}>
          <Text style={openerDrawStyles.title}>SACA LA FICHA MÁS ALTA</Text>
          <View style={openerDrawStyles.row}>
            {Object.entries(openerDraw.draws).map(([seatStr, t]) => {
              const seat = Number(seatStr) as Seat;
              const isWinner = seat === openerDraw.winnerSeat;
              const name = seatName(seat) ?? `J${seat + 1}`;
              return (
                <View key={seat} style={[openerDrawStyles.col, isWinner && openerDrawStyles.colWinner]}>
                  <Text style={openerDrawStyles.label} numberOfLines={1}>{name}</Text>
                  <DominoTile a={t.a as any} b={t.b as any} size={36} />
                  <Text style={openerDrawStyles.sum}>{t.a + t.b}</Text>
                  {isWinner && <Text style={openerDrawStyles.winnerTag}>¡ABRE!</Text>}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* PRE-MATCH COUNTDOWN — DEV: disabled for faster iteration */}
      {false && countdownSec !== null && (
        <View pointerEvents="none" style={styles.matchCountdownWrap}>
          <Text style={styles.matchCountdownLabel}>Inicia en</Text>
          <CountdownPopNumber key={countdownSec} n={countdownSec} />
        </View>
      )}

      {/* DEV: temporary reset-hand button (top-right) */}
      <Pressable
        onPress={async () => {
          const s = await getSocket();
          s.emit("game:devReset", {}, () => {});
        }}
        style={styles.devResetBtn}
      >
        <Text style={styles.devResetBtnText}>↻ Reset</Text>
      </Pressable>

      {/* PASS / TRANCADO ANNOUNCEMENT */}
{announcement?.type === "blocked" && (
        <View style={styles.announcementOverlay} pointerEvents="none">
          <AnimatedAnnouncement key="blocked">
            <Text style={styles.announcementMain}>{"JUEGO\nTRANCADO"}</Text>
          </AnimatedAnnouncement>
        </View>
      )}
      {announcement?.type === "pass" && (
        <PassAnnouncement
          key={`pass-${announcement.seat ?? "x"}`}
          seat={announcement.seat ?? 0}
          side={
            announcement.seat === yourSeat
              ? "bottom"
              : (positions[announcement.seat ?? -1] ?? "top")
          }
        />
      )}

      {/* ROUND END BANNER — in-place, not a modal */}
      {roundEndData && (
        <RoundEndBanner
          data={roundEndData}
          youWon={roundEndData.winnerSeat === yourSeat}
          onContinue={async () => {
            setRoundEndData(null);
            if (roundEndData.isMatchEnd) {
              const s = await getSocket();
              s.emit("lobby:leave", {}, () => {});
              useGameStore.getState().reset();
              router.replace("/");
            } else {
              const s = await getSocket();
              s.emit("game:nextRound", {}, () => {});
            }
          }}
        />
      )}
      {roundEndData?.winnerSeat === yourSeat && <CoinBurst />}

      {/* DEAL OVERLAY — round-robin deal one tile per seat per pass */}
      {dealing && Object.keys(dealTargets).length > 0 && (
        <DealingOverlay
          countsBySeat={{
            ...counts,
            [yourSeat ?? 0]: yourHand.length,
          }}
          seatOrder={[
            { seat: (yourSeat ?? 0) as Seat, side: "bottom" as const },
            ...(rightSeat !== undefined ? [{ seat: rightSeat, side: "right" as const }] : []),
            ...(topSeat !== undefined ? [{ seat: topSeat, side: "top" as const }] : []),
            ...(leftSeat !== undefined ? [{ seat: leftSeat, side: "left" as const }] : []),
          ]}
          targetsBySide={dealTargets}
          onYourTileTick={() => setRevealedYou((n) => n + 1)}
          onDone={() => { setDealing(false); setDealTargets({}); }}
        />
      )}

    </View>
  );
}


// ─── Hand slot wrapper that reports its absolute X bounds ────────────────────

function SlotMeasure({
  tileId, onMeasure, style, gapShift = 0, highlight = false, children,
}: {
  tileId: string;
  onMeasure: (id: string, x: number, w: number) => void;
  style?: any;
  gapShift?: number;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<View>(null);
  const shift = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    shift.value = withSpring(gapShift, { damping: 16, stiffness: 220, mass: 0.6 });
  }, [gapShift]);

  useEffect(() => {
    if (highlight) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [highlight]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shift.value }, { scale: 1 + pulse.value * 0.06 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value * 0.9 + 0.1,
    shadowOpacity: pulse.value * 0.9,
    shadowRadius: 6 + pulse.value * 10,
  }));

  return (
    <Animated.View
      ref={ref}
      layout={LinearTransition.duration(180)}
      style={[style, animStyle]}
      onLayout={() => {
        ref.current?.measureInWindow((x, _y, w) => onMeasure(tileId, x, w));
      }}
    >
      {highlight && (
        <Animated.View pointerEvents="none" style={[openerGlowStyles.ring, glowStyle]} />
      )}
      {children}
    </Animated.View>
  );
}

const openerGlowStyles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#f2c14e",
    shadowColor: "#f2c14e",
    shadowOffset: { width: 0, height: 0 },
    zIndex: -1,
  },
});

// ─── Round-end overlay ───────────────────────────────────────────────────────

function RoundEndBanner({
  data, youWon, onContinue,
}: {
  data: RoundEndData;
  youWon: boolean;
  onContinue: () => void;
}) {
  const title = data.reason === "blocked" ? "TRANCADO" : "DOMINÓ!";
  const winnerLabel = data.winnerSeat !== null ? LABELS[data.winnerSeat] : null;
  const subtitle = winnerLabel
    ? (youWon ? `¡Ganaste! +${data.pointsAwarded} pts` : `Ganó ${winnerLabel} · +${data.pointsAwarded} pts`)
    : "Empate — sin puntos";

  return (
    <View pointerEvents="box-none" style={rStyles.bannerWrap}>
      <View style={rStyles.banner}>
        <Text style={rStyles.bannerTitle}>{title}</Text>
        <Text style={rStyles.bannerSub}>{subtitle}</Text>
        <Pressable style={rStyles.btn} onPress={onContinue}>
          <Text style={rStyles.btnText}>
            {data.isMatchEnd ? "Volver al Inicio" : "Siguiente Ronda"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const rStyles = StyleSheet.create({
  bannerWrap: {
    position: "absolute", left: 0, right: 0, bottom: 70,
    alignItems: "center", zIndex: 5000,
  },
  banner: {
    backgroundColor: "rgba(26,46,26,0.96)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18,
    borderWidth: 2, borderColor: "#f2c14e", flexDirection: "row", alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 12, elevation: 20,
  },
  bannerTitle: { color: "#f2c14e", fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  bannerSub: { color: "#bfe5c8", fontSize: 13, fontWeight: "700" },
  btn: {
    backgroundColor: "#f2c14e", paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10,
  },
  btnText: { color: "#0b3d2e", fontSize: 13, fontWeight: "900" },
});

// ─────────────────────────────────────────────────────────────────────────────

const WOOD = "#7a4a1e";
const WOOD_DARK = "#4a2a0a";
const FELT = "#2a6b42";
const FELT_DARK = "#1e5234";

const openerDrawStyles = StyleSheet.create({
  overlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)", zIndex: 5000,
  },
  title: {
    color: "#f2c14e", fontWeight: "900", fontSize: 14, letterSpacing: 2, marginBottom: 16,
    textShadowColor: "#000", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  col: {
    alignItems: "center", gap: 4, padding: 8, borderRadius: 10,
    borderWidth: 2, borderColor: "transparent",
  },
  colWinner: {
    borderColor: "#f2c14e", backgroundColor: "rgba(242,193,78,0.18)",
    shadowColor: "#f2c14e", shadowOpacity: 0.8, shadowRadius: 10, elevation: 10,
  },
  label: { color: "#fff", fontSize: 11, fontWeight: "700", maxWidth: 70 },
  sum: { color: "#bfe5c8", fontSize: 12, fontWeight: "800" },
  winnerTag: { color: "#f2c14e", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1a0f05" },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#111", paddingHorizontal: 8, paddingVertical: 3,
  },
  backBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: "#222", borderWidth: 1, borderColor: "#444",
  },
  backText: { color: "#bfe5c8", fontWeight: "700", fontSize: 12 },
  topBarCenter: { alignItems: "center" },
  topBarRound: { color: "#f2c14e", fontWeight: "700", fontSize: 12 },
  potLabel: { color: "#888", fontSize: 9, fontWeight: "600" },

  // Opponents row — all opponents at top
  opponentsRow: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "flex-start",
    paddingHorizontal: 6, paddingVertical: 2, gap: 6,
  },

  // Top opponent — above the table
  topPlayer: {
    alignItems: "center", paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 10, marginHorizontal: 40, borderWidth: 2, borderColor: "transparent",
  },
  topPlayerInfo: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  activePanel: { borderColor: "#f2c14e", backgroundColor: "rgba(242,193,78,0.08)" },
  winnerPanel: { borderColor: "#4caf50", backgroundColor: "rgba(76,175,80,0.18)" },
  pipLive: { color: "#f2c14e", fontWeight: "900", fontSize: 16 },
  pipLiveSide: { color: "#f2c14e", fontWeight: "900", fontSize: 12 },

  midRow: {
    flex: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, marginVertical: 0, gap: 0,
  },

  sidePlayer: {
    width: 40, alignItems: "center", justifyContent: "center", gap: 3,
    borderRadius: 10, borderWidth: 2, borderColor: "transparent", padding: 2,
  },
  sideSpacer: { width: 40 },

  // Wooden table frame — fixed-ish size, centered, with uniform 12px gap to all seats.
  tableFrame: {
    flex: 1,
    alignSelf: "stretch",
    marginHorizontal: 12,
    marginTop: 0,
    marginBottom: 12,
    backgroundColor: WOOD_DARK, borderRadius: 16,
    padding: 7, borderWidth: 4, borderColor: "#2a1505",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  tableFelt: {
    flex: 1, backgroundColor: FELT, borderRadius: 10,
    borderWidth: 2, borderColor: FELT_DARK,
    alignItems: "center", justifyContent: "center", gap: 6, padding: 6,
  },

  boardRow: { flexDirection: "row", alignItems: "center", width: "100%", flex: 1, position: "relative" },
  dropHalf: {
    position: "absolute", top: 0, bottom: 0, width: "50%",
    borderRadius: 12, borderWidth: 2, borderStyle: "dashed",
  },
  dropHalfLeft: { left: 0 },
  dropHalfRight: { right: 0 },
  dropHalfValid: { backgroundColor: "rgba(76, 175, 80, 0.18)", borderColor: "#4caf50" },
  dropHalfInvalid: { backgroundColor: "rgba(220, 60, 60, 0.10)", borderColor: "rgba(220, 60, 60, 0.4)" },
  boardScroll: {
    flexGrow: 1, justifyContent: "center",
    alignItems: "center", paddingHorizontal: 4,
  },
  serpentineCol: {
    flexGrow: 1, justifyContent: "center", alignItems: "center", gap: 4,
  },
  boardColumn: {
    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
    flexGrow: 1,
  },
  serpentineRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  emptyText: { color: "#9fd0aa", fontStyle: "italic", fontSize: 12, textAlign: "center" },

  endBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f2c14e", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#c49a2a", flexShrink: 0,
  },
  endGlowValid: {
    borderColor: "#4caf50", borderWidth: 3,
    backgroundColor: "#4caf50",
    transform: [{ scale: 1.2 }],
    shadowColor: "#4caf50", shadowOpacity: 0.9, shadowRadius: 8, elevation: 10,
  },
  endGlowInvalid: { opacity: 0.35 },
  endText: { color: "#1a1a1a", fontWeight: "800", fontSize: 13 },

  turnInside: { color: "#c8f0d6", fontSize: 11, fontStyle: "italic", textAlign: "center" },
  autoPassBanner: {
    backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  autoPassText: { color: "#f2c14e", fontSize: 11, fontWeight: "700", textAlign: "center" },

  fdRow: { flexDirection: "row", gap: 2, flexWrap: "wrap", justifyContent: "center", maxWidth: 130 },
  fdCol: { gap: 2, alignItems: "center" },
  fdTileH: { width: 38, height: 20, backgroundColor: "#f5f0dc", borderRadius: 3, borderWidth: 1, borderColor: "#c8b89a" },
  fdTileV: { width: 20, height: 38, backgroundColor: "#f5f0dc", borderRadius: 3, borderWidth: 1, borderColor: "#c8b89a" },
  fdMore: { color: "#f2c14e", fontSize: 9, fontWeight: "700" },

  playerName: { color: "#fff", fontWeight: "700", fontSize: 12 },
  playerNameSide: { color: "#fff", fontWeight: "700", fontSize: 9, textAlign: "center" },

  coin: { flexDirection: "row", alignItems: "center", gap: 2 },
  coinIcon: { fontSize: 11 },
  coinText: { color: "#f2c14e", fontWeight: "700", fontSize: 11 },

  youBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#111", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, marginBottom: 2, marginTop: 2,
    maxWidth: 540, alignSelf: "center", width: "100%",
  },
  youName: { color: "#fff", fontWeight: "800", fontSize: 13 },
  tileCount: { color: "#bfe5c8", fontSize: 11, fontWeight: "700" },

  handArea: {
    backgroundColor: "transparent",
    maxWidth: 540, alignSelf: "center", width: "100%",
  },
  handAreaActive: {},
  hand: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 8, gap: 4, alignItems: "flex-end", flexGrow: 1, justifyContent: "center" },
  handSlot: { paddingHorizontal: 1 },
  handSlotRejected: {
    borderRadius: 6, borderWidth: 2, borderColor: "#e63946",
    shadowColor: "#e63946", shadowOpacity: 0.8, shadowRadius: 6, elevation: 6,
  },

  openerWrap: {
    position: "absolute", top: "45%", left: 0, right: 0,
    alignItems: "center", zIndex: 5500,
  },
  openerPill: {
    backgroundColor: "rgba(0,0,0,0.85)", borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 18,
    borderWidth: 2, borderColor: "#f2c14e",
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 10, elevation: 16,
  },
  openerArrow: { color: "#f2c14e", fontSize: 28, fontWeight: "900" },
  openerText: { color: "#f2c14e", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  tickBadgeWrap: {
    position: "absolute", top: 60, alignSelf: "center", left: 0, right: 0,
    alignItems: "center", zIndex: 4800,
  },
  tickBadge: {
    backgroundColor: "rgba(230,57,70,0.9)", borderRadius: 28, width: 52, height: 52,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
    shadowColor: "#e63946", shadowOpacity: 0.8, shadowRadius: 10, elevation: 12,
  },
  tickText: { color: "#fff", fontSize: 26, fontWeight: "900" },
  pendingWrap: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center", zIndex: 5200,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  pendingPill: {
    backgroundColor: "#1a2e1a", borderRadius: 14, paddingVertical: 16, paddingHorizontal: 22,
    borderWidth: 2, borderColor: "#f2c14e", maxWidth: 320, alignItems: "center", gap: 8,
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 12, elevation: 16,
  },
  pendingTitle: { color: "#f2c14e", fontSize: 22, fontWeight: "900", letterSpacing: 3 },
  pendingSub: { color: "#bfe5c8", fontSize: 13, textAlign: "center", lineHeight: 18 },
  matchCountdownWrap: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    alignItems: "center", justifyContent: "center", zIndex: 4900,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  devResetBtn: {
    position: "absolute", top: 40, right: 12, zIndex: 9999,
    backgroundColor: "#e63946", paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "#000",
  },
  devResetBtnText: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  matchCountdownLabel: {
    color: "#bfe5c8", fontSize: 16, fontWeight: "700", letterSpacing: 2,
    marginBottom: 8, textShadowColor: "#000", textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4,
  },
  matchCountdownNum: {
    color: "#f2c14e", fontSize: 120, fontWeight: "900",
    textShadowColor: "#000", textShadowOffset: { width: 2, height: 4 }, textShadowRadius: 10,
  },
  passWrap: {
    position: "absolute", zIndex: 4500,
  },
  passBubble: {
    backgroundColor: "rgba(20,20,20,0.92)", borderRadius: 14, paddingVertical: 4, paddingHorizontal: 12,
    borderWidth: 1, borderColor: "#e63946",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 4, elevation: 8,
  },
  passBubbleText: {
    color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 1,
  },
  announcementOverlay: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center", zIndex: 4000,
  },
  announcementMain: {
    color: "#e63946", fontSize: 56, fontWeight: "900",
    textAlign: "center", letterSpacing: 4,
    textShadowColor: "#000", textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 6,
  },
  announcementSub: {
    color: "#fff", fontSize: 18, fontWeight: "700",
    textAlign: "center", marginBottom: 4, opacity: 0.9,
  },

  bottomBar: {
    flexDirection: "row", gap: 6, paddingHorizontal: 8, paddingVertical: 4,
    alignItems: "center",
  },
  chatBtn: {
    backgroundColor: "#222", paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: "#444",
  },
  chatText: { color: "#ccc", fontWeight: "600", fontSize: 12 },
  disabled: { opacity: 0.3 },
});
