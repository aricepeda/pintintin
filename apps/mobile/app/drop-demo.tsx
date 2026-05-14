import { useEffect } from "react";
import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence,
  Easing, ReduceMotion, cancelAnimation,
} from "react-native-reanimated";
import { DominoTile } from "../src/components/DominoTile";

const NEVER = ReduceMotion.Never;

type Mode = "badgeGlow" | "tileGlow" | "pipBlink" | "ghostSlot" | "connector" | "all";

export default function DropDemo() {
  const [mode, setMode] = useState<Mode>("badgeGlow");
  const [trigger, setTrigger] = useState(0);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Demo · indicador de drop legal</Text>
      <Text style={styles.sub}>Modo: <Text style={styles.hl}>{mode}</Text></Text>

      <View style={styles.felt}>
        {/* LEFT END (legal) */}
        <View style={styles.boardRow}>
          <BadgeEnd active={mode === "badgeGlow" || mode === "all"} value={3} />
          {/* Connector line */}
          {(mode === "connector" || mode === "all") && <ConnectorLine />}
          <View style={styles.boardTilesRow}>
            <BoardTileGlow active={mode === "tileGlow" || mode === "all"} a={3} b={5} highlightSide="left" pipBlink={mode === "pipBlink" || mode === "all"} blinkPip="left" />
            <View style={{ width: 4 }} />
            <DominoTile a={5} b={2} size={32} orientation="horizontal" />
            <View style={{ width: 4 }} />
            <BoardTileGlow active={false} a={2} b={6} highlightSide={null} pipBlink={false} />
          </View>
          {/* Ghost slot on the right (illegal here) — illustrate ghostSlot only on left */}
          <View style={styles.endBadge}><Text style={styles.endText}>6</Text></View>
        </View>
        {(mode === "ghostSlot" || mode === "all") && (
          <View style={styles.ghostSlotWrap}>
            <GhostSlot a={3} b={3} />
          </View>
        )}
      </View>

      {/* "Dragged" tile shown floating below for context */}
      <View style={styles.draggedRow}>
        <Text style={styles.draggedLabel}>Arrastrando:</Text>
        <DominoTile a={3} b={3} size={32} orientation="vertical" />
      </View>

      <ScrollView horizontal contentContainerStyle={styles.btnRow} showsHorizontalScrollIndicator={false}>
        {(["badgeGlow", "tileGlow", "pipBlink", "ghostSlot", "connector", "all"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => { setMode(m); setTrigger((t) => t + 1); }} style={[styles.btn, mode === m && styles.btnOn]}>
            <Text style={styles.btnText}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => setTrigger((t) => t + 1)} style={[styles.btn, styles.replay]}>
        <Text style={styles.btnText}>▶ Replay</Text>
      </Pressable>

      <Text key={trigger} style={{ height: 0 }} />
    </View>
  );
}

function BadgeEnd({ active, value }: { active: boolean; value: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!active) { cancelAnimation(pulse); pulse.value = 0; return; }
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(pulse);
  }, [active]);
  const style = useAnimatedStyle(() => {
    if (!active) return {};
    return {
      shadowOpacity: 0.4 + pulse.value * 0.6,
      shadowRadius: 6 + pulse.value * 18,
      transform: [{ scale: 1 + pulse.value * 0.25 }],
      backgroundColor: `rgba(76,175,80,${0.85 + pulse.value * 0.15})`,
      borderColor: "#a8f5b0",
    };
  });
  return (
    <Animated.View style={[styles.endBadge, active && { shadowColor: "#4caf50" }, style]}>
      <Text style={styles.endText}>{value}</Text>
    </Animated.View>
  );
}

function BoardTileGlow({ active, a, b, highlightSide, pipBlink, blinkPip }: {
  active: boolean; a: 0|1|2|3|4|5|6; b: 0|1|2|3|4|5|6;
  highlightSide: "left" | "right" | null; pipBlink: boolean; blinkPip?: "left" | "right";
}) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!active && !pipBlink) { cancelAnimation(glow); glow.value = 0; return; }
    glow.value = withRepeat(
      withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(glow);
  }, [active, pipBlink]);

  const style = useAnimatedStyle(() => {
    if (!active) return {};
    return {
      shadowOpacity: 0.4 + glow.value * 0.6,
      shadowRadius: 4 + glow.value * 14,
    };
  });

  const pipOverlayStyle = useAnimatedStyle(() => {
    if (!pipBlink) return { opacity: 0 };
    return { opacity: 0.3 + glow.value * 0.65 };
  });

  return (
    <Animated.View style={[active && { shadowColor: "#4caf50" }, style]}>
      <DominoTile a={a} b={b} size={32} orientation="horizontal" />
      {pipBlink && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pipBlinker,
            blinkPip === "left" ? { left: 0 } : { right: 0 },
            pipOverlayStyle,
          ]}
        />
      )}
    </Animated.View>
  );
}

function GhostSlot({ a, b }: { a: 0|1|2|3|4|5|6; b: 0|1|2|3|4|5|6 }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(opacity);
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: 0.25 + opacity.value * 0.45 }));
  return (
    <Animated.View style={style}>
      <DominoTile a={a} b={b} size={32} orientation="horizontal" />
    </Animated.View>
  );
}

function ConnectorLine() {
  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(grow);
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + grow.value * 0.6,
    width: 12 + grow.value * 6,
    backgroundColor: "#4caf50",
  }));
  return <Animated.View style={[styles.connector, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b3d2e", padding: 18, gap: 14 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  sub: { color: "#bfe5c8", fontSize: 13 },
  hl: { color: "#f2c14e", fontWeight: "800" },
  felt: {
    backgroundColor: "#2a6b42", borderRadius: 12, padding: 18,
    borderWidth: 2, borderColor: "#1e5234", minHeight: 200,
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  boardRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  boardTilesRow: { flexDirection: "row", alignItems: "center" },
  endBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#f2c14e",
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#c49a2a",
  },
  endText: { color: "#1a1a1a", fontWeight: "800", fontSize: 15 },
  pipBlinker: {
    position: "absolute", top: 0, bottom: 0, width: "50%",
    backgroundColor: "#4caf50", borderRadius: 5,
  },
  ghostSlotWrap: {
    position: "absolute", left: 70, top: "50%", marginTop: -16,
  },
  connector: { height: 4, borderRadius: 2 },
  draggedRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  draggedLabel: { color: "#bfe5c8", fontSize: 13, fontWeight: "700" },
  btnRow: { gap: 8, paddingVertical: 8 },
  btn: {
    backgroundColor: "#114c3a", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 2, borderColor: "transparent",
  },
  btnOn: { borderColor: "#f2c14e", backgroundColor: "#155a44" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  replay: { alignSelf: "center" },
});
