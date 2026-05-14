import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
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

export interface PlayerSeatProps {
  name: string;
  rating: number;
  money: number;
  avatarUri?: string;
  isActive?: boolean;
  isCurrentUser?: boolean;
  turnDeadline?: number | null;
}

const AVATAR_SIZE = 64;

export function PlayerSeat({
  name,
  rating,
  money,
  avatarUri,
  isActive = false,
  isCurrentUser = false,
  turnDeadline = null,
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
    opacity: 0.4 + pulse.value * 0.55,
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.avatarWrap}>
        {isActive && <Animated.View style={[styles.glow, glowStyle]} />}
        <View style={[styles.avatarRing, isCurrentUser && styles.avatarRingCurrent]}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" transition={150} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        {isActive && turnDeadline != null && (
          <View style={styles.timerSlot}>
            <TurnTimer deadline={turnDeadline} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.star}>★</Text>
          <Text style={styles.rating}>{rating}</Text>
        </View>
        <Text style={styles.money}>${money.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const GLOW_SIZE = AVATAR_SIZE + 28;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  avatarRingCurrent: {
    borderColor: '#c9a961',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSlot: {
    position: 'absolute',
    bottom: -6,
    right: -6,
  },
  avatarInitial: {
    color: '#e8b85c',
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    marginTop: 6,
    backgroundColor: '#0a0a0a',
    borderColor: '#1a1a1a',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 110,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 70,
  },
  star: {
    color: '#c9a961',
    fontSize: 12,
  },
  rating: {
    color: '#c9a961',
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
