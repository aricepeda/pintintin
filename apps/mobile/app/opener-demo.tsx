import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence,
  withDelay, withRepeat, Easing, ReduceMotion, cancelAnimation,
} from "react-native-reanimated";
import { DominoTile } from "../src/components/DominoTile";

const NEVER = ReduceMotion.Never;

type Side = "top" | "left" | "right" | "bottom";
type Mode = "pulse" | "spotlight" | "arrow" | "roulette" | "beam" | "mockfall" | "halo";

const LABEL: Record<Side, string> = { top: "Bot 1", left: "Bot 3", right: "Bot 2", bottom: "Tú" };

export default function OpenerDemo() {
  const [side, setSide] = useState<Side>("top");
  const [mode, setMode] = useState<Mode>("pulse");
  const [trigger, setTrigger] = useState(0);

  const fire = (m: Mode) => { setMode(m); setTrigger((t) => t + 1); };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Demo · indicador de salida</Text>
      <Text style={styles.sub}>
        Salida: <Text style={styles.hl}>{LABEL[side]}</Text> · Modo: <Text style={styles.hl}>{mode}</Text>
      </Text>

      <View style={styles.seatRow}>
        {(["bottom", "right", "top", "left"] as Side[]).map((s) => (
          <Pressable key={s} onPress={() => setSide(s)} style={[styles.chip, side === s && styles.chipOn]}>
            <Text style={styles.chipText}>{LABEL[s]}</Text>
          </Pressable>
        ))}
      </View>

      {/* MOCK TABLE */}
      <View style={styles.tableWrap}>
        {/* Top */}
        <View style={styles.topRow}>
          <PanelMock side="top" active={side === "top" && (mode === "pulse" || mode === "halo")} trigger={trigger} mode={mode} forSide={side} />
        </View>

        {/* Middle row: left | felt | right */}
        <View style={styles.midRow}>
          <PanelMock side="left" active={side === "left" && (mode === "pulse" || mode === "halo")} trigger={trigger} mode={mode} forSide={side} />
          <View style={styles.felt}>
            <CenterEffects key={trigger} mode={mode} side={side} />
          </View>
          <PanelMock side="right" active={side === "right" && (mode === "pulse" || mode === "halo")} trigger={trigger} mode={mode} forSide={side} />
        </View>

        {/* Bottom */}
        <View style={styles.bottomRow}>
          <PanelMock side="bottom" active={side === "bottom" && (mode === "pulse" || mode === "halo")} trigger={trigger} mode={mode} forSide={side} />
        </View>
      </View>

      <ScrollView horizontal contentContainerStyle={styles.btnRow} showsHorizontalScrollIndicator={false}>
        {(["pulse", "spotlight", "arrow", "roulette", "beam", "mockfall", "halo"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => fire(m)} style={[styles.btn, mode === m && styles.btnOn]}>
            <Text style={styles.btnText}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable onPress={() => fire(mode)} style={[styles.btn, styles.replay]}>
        <Text style={styles.btnText}>▶ Replay</Text>
      </Pressable>
    </View>
  );
}

// ───── Mock player panel ─────
function PanelMock({ side, active, trigger, mode, forSide }: {
  side: Side; active: boolean; trigger: number; mode: Mode; forSide: Side;
}) {
  const isTarget = side === forSide;
  const pulse = useSharedValue(0);
  const haloScale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(pulse); pulse.value = 0;
    cancelAnimation(haloScale); haloScale.value = 1;
    if (!isTarget) return;
    if (mode === "pulse") {
      pulse.value = withRepeat(
        withTiming(1, { duration: 380, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
        6, true,
      );
    }
    if (mode === "halo") {
      haloScale.value = withSequence(
        withTiming(1.3, { duration: 200, easing: Easing.out(Easing.back(2)), reduceMotion: NEVER }),
        withRepeat(
          withTiming(1.15, { duration: 350, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
          4, true,
        ),
      );
    }
  }, [trigger, mode, isTarget]);

  const pulseStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + pulse.value * 0.6,
    shadowRadius: 6 + pulse.value * 18,
    transform: [{ scale: 1 + pulse.value * 0.04 }],
    borderColor: pulse.value > 0.4 ? "#f2c14e" : "transparent",
    backgroundColor: pulse.value > 0.4 ? "rgba(242,193,78,0.15)" : "transparent",
  }));
  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
  }));

  const showSpotlight = isTarget && mode === "spotlight";

  return (
    <Animated.View style={[styles.panel, { shadowColor: "#f2c14e" }, pulseStyle]}>
      <Animated.Text style={[styles.avatar, haloStyle]}>
        {side === "bottom" ? "👤" : "🤖"}
      </Animated.Text>
      <Text style={styles.name}>{LABEL[side]}</Text>
      <View style={[styles.faceDown, side === "bottom" && { flexDirection: "row" }]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <SpotlightTile key={i} highlight={showSpotlight && i === 2} side={side} />
        ))}
      </View>
    </Animated.View>
  );
}

function SpotlightTile({ highlight, side }: { highlight: boolean; side: Side }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (!highlight) { cancelAnimation(glow); glow.value = 0; return; }
    glow.value = withRepeat(
      withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease), reduceMotion: NEVER }),
      -1, true,
    );
    return () => cancelAnimation(glow);
  }, [highlight]);
  const isVerticalTile = side === "top";
  const w = isVerticalTile ? 16 : 26;
  const h = isVerticalTile ? 26 : 16;
  const style = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + glow.value * 0.7,
    shadowRadius: 4 + glow.value * 14,
    transform: [{ scale: 1 + glow.value * 0.18 }],
    borderColor: highlight ? `rgba(242,193,78,${0.5 + glow.value * 0.5})` : "#7a3b3b",
    borderWidth: highlight ? 2 : 1,
    backgroundColor: highlight ? "#f2c14e" : "#7a3b3b",
  }));
  return (
    <Animated.View
      style={[
        { width: w, height: h, margin: 1, borderRadius: 3, shadowColor: "#f2c14e" },
        style,
      ]}
    />
  );
}

// ───── Center-board effects (arrow / roulette / beam / mockfall) ─────
function CenterEffects({ mode, side }: { mode: Mode; side: Side }) {
  if (mode === "arrow") return <ArrowFx side={side} />;
  if (mode === "roulette") return <RouletteFx targetSide={side} />;
  if (mode === "beam") return <BeamFx side={side} />;
  if (mode === "mockfall") return <MockFallFx side={side} />;
  return null;
}

function dirOffset(side: Side) {
  switch (side) {
    case "top":    return { x: 0, y: -130 };
    case "bottom": return { x: 0, y: 130 };
    case "left":   return { x: -150, y: 0 };
    case "right":  return { x: 150, y: 0 };
  }
}

function ArrowFx({ side }: { side: Side }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rot = (() => { switch (side) {
    case "top": return -90; case "bottom": return 90;
    case "left": return 180; case "right": return 0;
  }})();

  useEffect(() => {
    const tgt = dirOffset(side);
    opacity.value = withSequence(
      withTiming(1, { duration: 100, reduceMotion: NEVER }),
      withDelay(700, withTiming(0, { duration: 250, reduceMotion: NEVER })),
    );
    tx.value = withTiming(tgt.x, { duration: 800, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    ty.value = withTiming(tgt.y, { duration: 800, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot}deg` }],
  }));
  return <Animated.Text style={[fxStyles.arrow, style]}>›</Animated.Text>;
}

function RouletteFx({ targetSide }: { targetSide: Side }) {
  const ang = useSharedValue(0);
  const opacity = useSharedValue(1);
  const final = (() => { switch (targetSide) {
    case "top": return -90; case "bottom": return 90;
    case "left": return 180; case "right": return 0;
  }})();
  useEffect(() => {
    ang.value = withSequence(
      withTiming(720 + final, { duration: 1200, easing: Easing.out(Easing.cubic), reduceMotion: NEVER }),
    );
    opacity.value = withDelay(1500, withTiming(0, { duration: 300, reduceMotion: NEVER }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${ang.value}deg` }],
  }));
  return <Animated.View style={[fxStyles.roulette, style]}><Text style={fxStyles.roulettePtr}>›</Text></Animated.View>;
}

function BeamFx({ side }: { side: Side }) {
  const grow = useSharedValue(0);
  const opacity = useSharedValue(1);
  const horizontal = side === "left" || side === "right";
  const len = horizontal ? 150 : 130;
  useEffect(() => {
    grow.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    opacity.value = withDelay(700, withTiming(0, { duration: 400, reduceMotion: NEVER }));
  }, []);
  const style = useAnimatedStyle(() => {
    const s = grow.value;
    let tx = 0, ty = 0;
    if (side === "right") tx = (len * s) / 2;
    if (side === "left") tx = -(len * s) / 2;
    if (side === "top") ty = -(len * s) / 2;
    if (side === "bottom") ty = (len * s) / 2;
    return {
      opacity: opacity.value,
      width: horizontal ? len * s : 4,
      height: horizontal ? 4 : len * s,
      transform: [{ translateX: tx }, { translateY: ty }],
    };
  });
  return <Animated.View style={[fxStyles.beam, style]} />;
}

function MockFallFx({ side }: { side: Side }) {
  const tgt = dirOffset(side);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.6);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 100, reduceMotion: NEVER });
    scale.value = withSpring(1, { damping: 12, stiffness: 220, reduceMotion: NEVER });
    tx.value = withTiming(tgt.x, { duration: 600, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    ty.value = withTiming(tgt.y, { duration: 600, easing: Easing.out(Easing.cubic), reduceMotion: NEVER });
    opacity.value = withDelay(900, withTiming(0, { duration: 300, reduceMotion: NEVER }));
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value }, { translateY: ty.value }, { scale: scale.value },
    ],
  }));
  return (
    <Animated.View style={[{ position: "absolute" }, style]}>
      <DominoTile a={6} b={6} size={20} orientation="vertical" />
    </Animated.View>
  );
}

const fxStyles = StyleSheet.create({
  arrow: {
    position: "absolute", color: "#f2c14e", fontSize: 60, fontWeight: "900",
    textShadowColor: "#000", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 6,
  },
  roulette: {
    position: "absolute", width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: "#f2c14e", alignItems: "flex-end", justifyContent: "center",
    paddingRight: 6,
  },
  roulettePtr: { color: "#f2c14e", fontSize: 30, fontWeight: "900" },
  beam: {
    position: "absolute", backgroundColor: "#f2c14e",
    shadowColor: "#f2c14e", shadowOpacity: 0.9, shadowRadius: 8, elevation: 6,
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b3d2e", padding: 14, gap: 10 },
  title: { color: "#fff", fontSize: 20, fontWeight: "800" },
  sub: { color: "#bfe5c8", fontSize: 13 },
  hl: { color: "#f2c14e", fontWeight: "800" },
  seatRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#114c3a", borderWidth: 1, borderColor: "transparent" },
  chipOn: { borderColor: "#f2c14e" },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  tableWrap: { flex: 1, justifyContent: "space-between" },
  topRow: { alignItems: "center" },
  bottomRow: { alignItems: "center" },
  midRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  felt: {
    flex: 1, height: 200, backgroundColor: "#2a6b42", borderRadius: 12,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#1e5234",
    overflow: "hidden",
  },

  panel: {
    backgroundColor: "transparent", borderRadius: 10, padding: 6, borderWidth: 2,
    alignItems: "center", gap: 2, minWidth: 70,
  },
  avatar: { fontSize: 28 },
  name: { color: "#fff", fontWeight: "700", fontSize: 11 },
  faceDown: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 150 },

  btnRow: { gap: 8, paddingVertical: 8 },
  btn: {
    backgroundColor: "#114c3a", paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 2, borderColor: "transparent",
  },
  btnOn: { borderColor: "#f2c14e", backgroundColor: "#155a44" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  replay: { alignSelf: "center" },
});
