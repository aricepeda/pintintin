import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring,
  Easing, ReduceMotion,
} from "react-native-reanimated";

const NEVER = ReduceMotion.Never;

type Variant = "popfade" | "ringIn" | "bigDrop";

export default function CountdownDemo() {
  const [variant, setVariant] = useState<Variant>("popfade");
  const [current, setCurrent] = useState<number | null>(null);

  const start = () => {
    setCurrent(10);
    let n = 10;
    const id = setInterval(() => {
      n -= 1;
      if (n < 0) { clearInterval(id); setCurrent(null); return; }
      setCurrent(n);
    }, 1000);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Demo · countdown</Text>
      <Text style={styles.sub}>Variante: <Text style={styles.hl}>{variant}</Text></Text>

      <View style={styles.stage}>
        {current !== null && <Number key={`${variant}-${current}`} n={current} variant={variant} />}
      </View>

      <View style={styles.row}>
        {(["popfade", "ringIn", "bigDrop"] as Variant[]).map((v) => (
          <Pressable key={v} onPress={() => setVariant(v)} style={[styles.chip, variant === v && styles.chipOn]}>
            <Text style={styles.chipText}>{v}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable onPress={start} style={styles.startBtn}>
        <Text style={styles.startText}>▶ Iniciar (10s)</Text>
      </Pressable>
    </View>
  );
}

function Number({ n, variant }: { n: number; variant: Variant }) {
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(0);
  const ringScale = useSharedValue(0.4);
  const ringOpacity = useSharedValue(0);
  const ty = useSharedValue(-80);

  useEffect(() => {
    if (variant === "popfade") {
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
    } else if (variant === "ringIn") {
      opacity.value = withSequence(
        withTiming(1, { duration: 100, reduceMotion: NEVER }),
        withTiming(1, { duration: 700, reduceMotion: NEVER }),
        withTiming(0, { duration: 200, reduceMotion: NEVER }),
      );
      scale.value = withSpring(1, { damping: 14, stiffness: 280, reduceMotion: NEVER });
      ringScale.value = 0.4;
      ringOpacity.value = 0.9;
      ringScale.value = withTiming(2.6, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
      ringOpacity.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    } else if (variant === "bigDrop") {
      opacity.value = withSequence(
        withTiming(1, { duration: 100, reduceMotion: NEVER }),
        withTiming(1, { duration: 600, reduceMotion: NEVER }),
        withTiming(0, { duration: 250, reduceMotion: NEVER }),
      );
      ty.value = withSpring(0, { damping: 9, stiffness: 220, reduceMotion: NEVER });
      scale.value = withSequence(
        withTiming(1.6, { duration: 160, reduceMotion: NEVER }),
        withSpring(1, { damping: 8, stiffness: 260, reduceMotion: NEVER }),
        withTiming(0.4, { duration: 250, reduceMotion: NEVER }),
      );
    }
  }, []);

  const textStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={demoStyles.center}>
      {variant === "ringIn" && <Animated.View style={[demoStyles.ring, ringStyle]} />}
      <Animated.Text style={[demoStyles.num, textStyle]}>{n}</Animated.Text>
    </View>
  );
}

const demoStyles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", width: 200, height: 200 },
  num: {
    color: "#f2c14e", fontSize: 110, fontWeight: "900",
    textShadowColor: "#000", textShadowOffset: { width: 2, height: 4 }, textShadowRadius: 10,
  },
  ring: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    borderWidth: 4, borderColor: "#f2c14e",
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b3d2e", padding: 20, gap: 16, alignItems: "center" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "#bfe5c8", fontSize: 13 },
  hl: { color: "#f2c14e", fontWeight: "800" },
  stage: {
    width: 240, height: 240, backgroundColor: "#114c3a",
    borderRadius: 20, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#2a6b42",
  },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#114c3a", borderWidth: 2, borderColor: "transparent",
  },
  chipOn: { borderColor: "#f2c14e", backgroundColor: "#155a44" },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  startBtn: {
    backgroundColor: "#f2c14e", paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 999,
  },
  startText: { color: "#0b3d2e", fontWeight: "900", fontSize: 14 },
});
