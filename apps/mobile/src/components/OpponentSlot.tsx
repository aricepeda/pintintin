import { View, Text, StyleSheet } from "react-native";
import type { Seat } from "@pintintin/game-core";

interface Props {
  seat: Seat;
  label: string;
  handCount: number;
  score: number;
  isActive: boolean;
  position: "top" | "left" | "right";
}

export function OpponentSlot({ seat, label, handCount, score, isActive, position }: Props) {
  const isVertical = position === "left" || position === "right";
  const rotation = position === "left" ? "90deg" : position === "right" ? "-90deg" : "0deg";

  return (
    <View style={[styles.wrapper, isActive && styles.activeWrapper]}>
      <View style={[styles.inner, { transform: [{ rotate: rotation }] }]}>
        <Text style={styles.name}>{label}</Text>
        <View style={[styles.tiles, isVertical && styles.tilesVertical]}>
          {Array.from({ length: handCount }).map((_, i) => (
            <View key={i} style={styles.miniTile} />
          ))}
        </View>
        <Text style={styles.score}>{score} pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  activeWrapper: {
    borderColor: "#f2c14e",
    backgroundColor: "#0e4e3a",
  },
  inner: {
    alignItems: "center",
    gap: 4,
  },
  name: { color: "#bfe5c8", fontSize: 11, fontWeight: "700" },
  score: { color: "#f2c14e", fontSize: 11, fontWeight: "700" },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    justifyContent: "center",
    maxWidth: 80,
  },
  tilesVertical: { maxWidth: 30 },
  miniTile: {
    width: 8,
    height: 14,
    backgroundColor: "#7a3b3b",
    borderRadius: 1.5,
    borderWidth: 0.5,
    borderColor: "#3a1010",
  },
});
