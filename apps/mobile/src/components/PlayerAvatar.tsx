import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation,
  Easing, ReduceMotion,
} from "react-native-reanimated";

const COLORS = ["#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#f4a261"];

interface Props {
  name: string;
  emoji?: string;
  size?: number;
  isActive?: boolean;
}

export function PlayerAvatar({ name, emoji, size = 44, isActive }: Props) {
  const color = COLORS[name.charCodeAt(0) % COLORS.length]!;
  const initial = name.charAt(0).toUpperCase();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (isActive) {
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
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + glow.value * 0.5,
    transform: [{ scale: 1 + glow.value * 0.18 }],
    shadowColor: "#f2c14e",
    shadowOpacity: 0.7 + glow.value * 0.3,
    shadowRadius: 8 + glow.value * 18,
    elevation: 12,
  }));
  return (
    <View
      style={[
        styles.ring,
        isActive && styles.ringActive,
        { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 },
      ]}
    >
      {isActive && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.halo,
            {
              width: size + 14, height: size + 14, borderRadius: (size + 14) / 2,
              top: -7, left: -7,
            },
            haloStyle,
          ]}
        />
      )}
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        {emoji
          ? <Text style={{ fontSize: size * 0.6 }}>{emoji}</Text>
          : <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>}
      </View>
      {isActive && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  ringActive: { borderColor: "#f2c14e" },
  halo: {
    position: "absolute",
    backgroundColor: "transparent",
    borderWidth: 3,
    borderColor: "#f2c14e",
  },
  circle: { alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "800" },
  dot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4caf50",
    borderWidth: 1.5,
    borderColor: "#0b3d2e",
  },
});
