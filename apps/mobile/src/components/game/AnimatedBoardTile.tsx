import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated';
import { DominoTile } from '../DominoTile';
import type { Pip } from '@pintintin/game-core';

const NEVER = ReduceMotion.Never;
const REPOSITION_MS = 220;
// Entry animation timings (per spec).
const TRAVEL_MS = 380;          // 250–450ms window
const SNAP_UP_MS = 90;          // 80–120ms snap
const SNAP_DOWN_MS = 110;
const SPAWN_FADE_MS = 110;

interface Props {
  a: Pip;
  b: Pip;
  size: number;
  orientation: 'horizontal' | 'vertical';
  flipped?: boolean;
  x: number;
  y: number;
  // When provided, the tile flies in from (x+initialOffsetX, y+initialOffsetY)
  // toward (x, y), then performs a landing snap. Used for newly-played tiles.
  initialOffsetX?: number;
  initialOffsetY?: number;
}

export function AnimatedBoardTile({
  a, b, size, orientation, flipped,
  x, y, initialOffsetX = 0, initialOffsetY = 0,
}: Props) {
  const hasEntry = !!(initialOffsetX || initialOffsetY);

  // Position shared values (re-target on layout changes).
  const tx = useSharedValue(x + initialOffsetX);
  const ty = useSharedValue(y + initialOffsetY);

  // Tilt away from travel direction so it leans naturally as it flies in.
  const initialRot = useRef(
    hasEntry ? (initialOffsetX === 0 ? -8 : initialOffsetX > 0 ? -10 : 10) : 0,
  ).current;
  const opacity = useSharedValue(hasEntry ? 0 : 1);
  const scale = useSharedValue(hasEntry ? 0.85 : 1);
  const rot = useSharedValue(initialRot);
  const liftY = useSharedValue(0);

  useEffect(() => {
    if (!hasEntry) return;
    // SPAWN: fade in.
    opacity.value = withTiming(1, {
      duration: SPAWN_FADE_MS,
      easing: Easing.out(Easing.quad),
      reduceMotion: NEVER,
    });

    // MOVEMENT: ease-out cubic with a subtle vertical arc.
    rot.value = withTiming(0, {
      duration: TRAVEL_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: NEVER,
    });
    liftY.value = withSequence(
      withTiming(-12, {
        duration: TRAVEL_MS * 0.45,
        easing: Easing.out(Easing.cubic),
        reduceMotion: NEVER,
      }),
      withTiming(0, {
        duration: TRAVEL_MS * 0.55,
        easing: Easing.in(Easing.cubic),
        reduceMotion: NEVER,
      }),
    );

    // SCALE: 0.85 → 1.0 during travel; then landing snap 1.0 → 1.04 → 1.0.
    scale.value = withSequence(
      withTiming(1.0, {
        duration: TRAVEL_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: NEVER,
      }),
      withTiming(1.04, {
        duration: SNAP_UP_MS,
        easing: Easing.out(Easing.quad),
        reduceMotion: NEVER,
      }),
      withTiming(1.0, {
        duration: SNAP_DOWN_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: NEVER,
      }),
    );
  }, []);

  // Movement: animate from start offset (or previous slot) to target (x, y).
  useEffect(() => {
    const duration = hasEntry ? TRAVEL_MS : REPOSITION_MS;
    const easing = Easing.out(Easing.cubic);
    tx.value = withTiming(x, { duration, easing, reduceMotion: NEVER });
    ty.value = withTiming(y, { duration, easing, reduceMotion: NEVER });
  }, [x, y]);

  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: tx.value,
    top: ty.value,
    opacity: opacity.value,
    transform: [
      { translateY: liftY.value },
      { rotate: `${rot.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[style, hasEntry && styles.shadow]}>
      <DominoTile a={a} b={b} size={size} orientation={orientation} flipped={flipped} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 10,
  },
});
