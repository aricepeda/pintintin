import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
  Easing, ReduceMotion,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const NEVER = ReduceMotion.Never;

const SHUFFLE_MS = 1800;
const DEAL_STEP_MS = 180;

type Side = 'top' | 'bottom';

interface Props {
  // Number of tiles to deal per side. e.g. heads-up: { bottom: 7, top: 7 }
  countsBySide: Record<Side, number>;
  // Order in which to deal (round-robin). e.g. ['bottom', 'top'].
  dealOrder: Side[];
  // Called once per "your" tick so the parent can reveal the next hand tile.
  onYourTileTick: () => void;
  // Side that represents the local player (so we know which ticks fire onYourTileTick).
  yourSide: Side;
  onDone: () => void;
}

export function ShuffleAndDeal({
  countsBySide, dealOrder, onYourTileTick, yourSide, onDone,
}: Props) {
  const [phase, setPhase] = useState<'shuffle' | 'deal'>('shuffle');

  // Build deal schedule (round-robin)
  const pieces: { side: Side; idx: number; order: number }[] = [];
  const placed: Record<Side, number> = { top: 0, bottom: 0 };
  const maxRounds = Math.max(...dealOrder.map((s) => countsBySide[s] ?? 0));
  let order = 0;
  for (let r = 0; r < maxRounds; r++) {
    for (const side of dealOrder) {
      if ((countsBySide[side] ?? 0) > r) {
        pieces.push({ side, idx: placed[side], order: order++ });
        placed[side] += 1;
      }
    }
  }
  const totalDealMs = pieces.length * DEAL_STEP_MS + 500;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('deal'), SHUFFLE_MS);
    const timers: ReturnType<typeof setTimeout>[] = [];
    pieces.forEach((p) => {
      if (p.side === yourSide) {
        timers.push(setTimeout(onYourTileTick, SHUFFLE_MS + p.order * DEAL_STEP_MS));
      }
    });
    timers.push(setTimeout(onDone, SHUFFLE_MS + totalDealMs));
    return () => { clearTimeout(t1); timers.forEach(clearTimeout); };
  }, []);

  return (
    <View pointerEvents="none" style={styles.layer}>
      {phase === 'shuffle' && <ShufflePile />}
      {phase === 'deal' && pieces.map((p) => (
        <DealingTile
          key={`${p.side}-${p.idx}`}
          side={p.side}
          delay={p.order * DEAL_STEP_MS}
        />
      ))}
    </View>
  );
}

function ShufflePile() {
  const items = Array.from({ length: 28 });
  return (
    <View style={styles.center}>
      {items.map((_, i) => <ShufflePiece key={i} index={i} />)}
    </View>
  );
}

function ShufflePiece({ index }: { index: number }) {
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
    const startT = setTimeout(() => wiggle(), (index % 10) * 15);
    const id = setInterval(wiggle, 180);
    return () => { clearTimeout(startT); clearInterval(id); };
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot.value}deg` },
    ],
  }));
  return <Animated.View style={[styles.flier, { left: -16, top: -9 }, style]} />;
}

function DealingTile({ side, delay }: { side: Side; delay: number }) {
  // Targets relative to screen center (the shuffle pile is at W/2, H/2).
  const target = side === 'top'
    ? { x: 0, y: -H * 0.36 }
    : { x: 0, y: H * 0.32 };
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 80, reduceMotion: NEVER });
      scale.value = withSpring(1, { damping: 12, stiffness: 240, reduceMotion: NEVER });
      tx.value = withTiming(target.x, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
      ty.value = withTiming(target.y, { duration: 320, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    }, delay);
    return () => clearTimeout(t);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value }, { translateY: ty.value }, { scale: scale.value },
    ],
  }));
  return <Animated.View style={[styles.flier, styles.center, style]} />;
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 6000,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  flier: {
    position: 'absolute', width: 32, height: 18, backgroundColor: '#f5f0dc',
    borderRadius: 3, borderWidth: 1, borderColor: '#c8b89a',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 4, elevation: 6,
  },
});
