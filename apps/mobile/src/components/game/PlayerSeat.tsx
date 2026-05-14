import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { TurnTimer } from './TurnTimer';

export type PlayerSeatLayout = 'top' | 'bottom' | 'left' | 'right';

export interface PlayerSeatProps {
  name: string;
  money: number;
  avatarUri?: string;
  isActive?: boolean;
  isCurrentUser?: boolean;
  turnDeadline?: number | null;
  handCount?: number | null;
  layout?: PlayerSeatLayout;
}

export function PlayerSeat({
  name,
  money,
  isActive = false,
  isCurrentUser = false,
  turnDeadline = null,
  handCount = null,
  layout = 'bottom',
}: PlayerSeatProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 200 });
    }
    return () => cancelAnimation(pulse);
  }, [isActive, pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.5,
  }));

  const showTiles = !isCurrentUser && typeof handCount === 'number' && handCount > 0;
  const tilesVertical = layout === 'left' || layout === 'right';
  const containerStyle =
    layout === 'left'
      ? styles.containerRow
      : layout === 'right'
        ? styles.containerRowReverse
        : layout === 'top'
          ? styles.containerColReverse
          : styles.containerCol;

  const tilesNode = showTiles ? (
    <View style={[styles.tiles, tilesVertical && styles.tilesVertical]} pointerEvents="none">
      {Array.from({ length: handCount! }).map((_, i) => (
        <View key={i} style={[styles.miniTile, tilesVertical && styles.miniTileVertical]} />
      ))}
    </View>
  ) : null;

  return (
    <View style={containerStyle}>
      <View style={styles.cardWrap}>
        {isActive && <Animated.View style={[styles.glow, glowStyle]} />}
        <View style={[styles.card, isCurrentUser && styles.cardCurrent]}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.money}>${money.toLocaleString()}</Text>
        </View>
        {isActive && turnDeadline != null && (
          <View style={styles.timerSlot}>
            <TurnTimer deadline={turnDeadline} />
          </View>
        )}
      </View>
      {tilesNode}
    </View>
  );
}

const styles = StyleSheet.create({
  containerCol: {
    alignItems: 'center',
    flexDirection: 'column',
    gap: 4,
  },
  containerColReverse: {
    alignItems: 'center',
    flexDirection: 'column-reverse',
    gap: 4,
  },
  containerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  containerRowReverse: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  cardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'center',
    maxWidth: 96,
  },
  tilesVertical: {
    flexDirection: 'column',
    maxWidth: 14,
    maxHeight: 120,
  },
  miniTile: {
    width: 9,
    height: 16,
    backgroundColor: '#7a3b3b',
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#3a1010',
  },
  miniTileVertical: {
    width: 16,
    height: 9,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  timerSlot: {
    position: 'absolute',
    bottom: -10,
    right: -10,
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderColor: '#1a1a1a',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    minWidth: 84,
    maxWidth: 96,
    alignItems: 'center',
  },
  cardCurrent: {
    borderColor: '#c9a961',
  },
  name: {
    color: '#f5f5f5',
    fontSize: 12,
    fontWeight: '600',
  },
  money: {
    color: '#e8b85c',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
});
