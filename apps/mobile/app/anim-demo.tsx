import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence,
  withDelay, withRepeat, Easing, ReduceMotion, cancelAnimation,
} from "react-native-reanimated";
import { DominoTile } from "../src/components/DominoTile";

type Mode = "slam" | "slide" | "bounce" | "ripple" | "magnet" | "push";

const NEVER = ReduceMotion.Never;

export default function AnimDemo() {
  const [mode, setMode] = useState<Mode>("slam");
  const [trigger, setTrigger] = useState(0);

  const play = (m: Mode) => { setMode(m); setTrigger((t) => t + 1); };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Demo · animaciones de ficha</Text>
      <Text style={styles.sub}>Modo: <Text style={styles.mode}>{mode}</Text></Text>

      <View style={styles.felt}>
        <View style={styles.endBadge}><Text style={styles.endText}>5</Text></View>
        <View style={styles.boardRow}>
          {/* Static neighbor tiles */}
          <NeighborTile trigger={trigger} mode={mode} side="left" />
          <View style={{ width: 6 }} />
          {/* Animated subject */}
          <DemoTile key={trigger} mode={mode} />
          <View style={{ width: 6 }} />
          <NeighborTile trigger={trigger} mode={mode} side="right" />
        </View>
        <View style={styles.endBadge}><Text style={styles.endText}>3</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.btnRow} horizontal showsHorizontalScrollIndicator={false}>
        {(["slam", "slide", "bounce", "ripple", "magnet", "push"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => play(m)} style={[styles.btn, mode === m && styles.btnActive]}>
            <Text style={styles.btnText}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => play(mode)} style={[styles.btn, styles.replay]}>
        <Text style={styles.btnText}>▶ Replay</Text>
      </Pressable>
    </View>
  );
}

function DemoTile({ mode }: { mode: Mode }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(0);
  const shadowR = useSharedValue(4);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);

  useEffect(() => {
    // reset
    tx.value = 0; ty.value = 0; scale.value = 1; rot.value = 0;
    opacity.value = 0; shadowR.value = 4;
    ringScale.value = 0; ringOpacity.value = 0;

    switch (mode) {
      case "slam": {
        ty.value = -260; scale.value = 1.6; opacity.value = 1;
        ty.value = withTiming(0, { duration: 260, easing: Easing.in(Easing.cubic), reduceMotion: NEVER });
        scale.value = withSequence(
          withTiming(1.6, { duration: 0, reduceMotion: NEVER }),
          withDelay(220, withSpring(1, { damping: 8, stiffness: 360, reduceMotion: NEVER })),
        );
        shadowR.value = withSequence(
          withDelay(240, withTiming(24, { duration: 90, reduceMotion: NEVER })),
          withTiming(4, { duration: 280, reduceMotion: NEVER }),
        );
        break;
      }
      case "slide": {
        tx.value = -180; opacity.value = 1;
        tx.value = withSpring(0, { damping: 14, stiffness: 220, reduceMotion: NEVER });
        break;
      }
      case "bounce": {
        ty.value = -240; opacity.value = 1;
        ty.value = withSequence(
          withTiming(0, { duration: 300, easing: Easing.in(Easing.quad), reduceMotion: NEVER }),
          withTiming(-50, { duration: 180, easing: Easing.out(Easing.quad), reduceMotion: NEVER }),
          withTiming(0, { duration: 180, easing: Easing.in(Easing.quad), reduceMotion: NEVER }),
          withTiming(-18, { duration: 110, easing: Easing.out(Easing.quad), reduceMotion: NEVER }),
          withTiming(0, { duration: 110, easing: Easing.in(Easing.quad), reduceMotion: NEVER }),
        );
        break;
      }
      case "ripple": {
        opacity.value = withTiming(1, { duration: 140, reduceMotion: NEVER });
        scale.value = withSequence(
          withTiming(1.18, { duration: 160, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }),
          withSpring(1, { damping: 10, stiffness: 280, reduceMotion: NEVER }),
        );
        ringScale.value = 0.6; ringOpacity.value = 0.9;
        ringScale.value = withTiming(2.4, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
        ringOpacity.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
        break;
      }
      case "magnet": {
        tx.value = -90; opacity.value = 1; rot.value = -12;
        tx.value = withSequence(
          withTiming(20, { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }),
          withSpring(0, { damping: 9, stiffness: 280, reduceMotion: NEVER }),
        );
        rot.value = withSpring(0, { damping: 10, stiffness: 240, reduceMotion: NEVER });
        scale.value = withSequence(
          withDelay(260, withTiming(1.18, { duration: 90, reduceMotion: NEVER })),
          withSpring(1, { damping: 9, stiffness: 280, reduceMotion: NEVER }),
        );
        break;
      }
      case "push": {
        opacity.value = withTiming(1, { duration: 90, reduceMotion: NEVER });
        scale.value = withSequence(
          withTiming(1.18, { duration: 120, reduceMotion: NEVER }),
          withSpring(1, { damping: 10, stiffness: 280, reduceMotion: NEVER }),
        );
        break;
      }
    }
  }, [mode]);

  const tileStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value }, { translateY: ty.value },
      { scale: scale.value }, { rotate: `${rot.value}deg` },
    ],
    shadowRadius: shadowR.value,
    shadowOpacity: 0.6,
    shadowColor: "#000",
    elevation: shadowR.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 91, height: 60 }}>
      <Animated.View pointerEvents="none" style={[demoStyles.ring, ringStyle]} />
      <Animated.View style={tileStyle}>
        <DominoTile a={6} b={3} size={28} orientation="horizontal" />
      </Animated.View>
    </View>
  );
}

function NeighborTile({ mode, side, trigger }: { mode: Mode; side: "left" | "right"; trigger: number }) {
  const tx = useSharedValue(0);
  useEffect(() => {
    if (mode === "push") {
      const dir = side === "left" ? -1 : 1;
      tx.value = withSequence(
        withTiming(dir * 5, { duration: 120, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }),
        withSpring(0, { damping: 9, stiffness: 280, reduceMotion: NEVER }),
      );
    } else {
      tx.value = 0;
    }
  }, [trigger]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  return (
    <Animated.View style={style}>
      <DominoTile a={side === "left" ? 4 : 2} b={side === "left" ? 5 : 3} size={28} orientation="horizontal" />
    </Animated.View>
  );
}

const demoStyles = StyleSheet.create({
  ring: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    borderWidth: 3, borderColor: "#f2c14e",
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b3d2e", padding: 20, gap: 14 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  sub: { color: "#bfe5c8", fontSize: 14 },
  mode: { color: "#f2c14e", fontWeight: "800" },
  felt: {
    backgroundColor: "#2a6b42", borderRadius: 12, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    minHeight: 240, borderWidth: 2, borderColor: "#1e5234", gap: 10,
  },
  boardRow: { flexDirection: "row", alignItems: "center" },
  endBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#f2c14e",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#c49a2a",
  },
  endText: { color: "#1a1a1a", fontWeight: "800", fontSize: 15 },
  btnRow: { gap: 8, paddingVertical: 6 },
  btn: {
    backgroundColor: "#114c3a", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 2, borderColor: "transparent",
    alignSelf: "flex-start",
  },
  btnActive: { borderColor: "#f2c14e", backgroundColor: "#155a44" },
  btnText: { color: "#fff", fontWeight: "700" },
  replay: { alignSelf: "center", marginTop: 4 },
});
