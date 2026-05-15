import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "../src/components/game/Board";
import type { BoardTile, Pip } from "@pintintin/game-core";

const COUNTS = [1, 6, 12, 14, 18, 22, 28];
type Distribution = "left" | "balanced" | "right";
const DISTRIBUTIONS: { key: Distribution; label: string }[] = [
  { key: "left", label: "← Todo izquierda" },
  { key: "balanced", label: "Balanceado" },
  { key: "right", label: "Todo derecha →" },
];

function makeTiles(n: number, dist: Distribution): BoardTile[] {
  const out: BoardTile[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i % 7) as Pip;
    const b = ((i * 3) % 7) as Pip;
    let end: BoardTile["end"];
    if (i === 0) end = "start";
    else if (dist === "left") end = "left";
    else if (dist === "right") end = "right";
    else end = i % 2 === 0 ? "right" : "left";
    out.push({
      tile: { id: `t${i}`, a, b },
      playedBy: 0,
      end,
      flipped: false,
    });
  }
  return out;
}

export default function BoardStressRoute() {
  const [count, setCount] = useState(12);
  const [dist, setDist] = useState<Distribution>("balanced");
  const tiles = makeTiles(count, dist);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.boardArea}>
        <Board tiles={tiles} />
      </View>
      <View style={styles.controls}>
        <Text style={styles.label}>Fichas: {count}</Text>
        <View style={styles.row}>
          {COUNTS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setCount(n)}
              style={[styles.btn, count === n && styles.btnActive]}
            >
              <Text style={[styles.btnText, count === n && styles.btnTextActive]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Distribución</Text>
        <View style={styles.row}>
          {DISTRIBUTIONS.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => setDist(d.key)}
              style={[styles.btn, dist === d.key && styles.btnActive]}
            >
              <Text style={[styles.btnText, dist === d.key && styles.btnTextActive]}>
                {d.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0d5a3a" },
  boardArea: { flex: 1 },
  controls: {
    padding: 16,
    backgroundColor: "#0a0a0a",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    alignItems: "center",
    gap: 10,
  },
  label: { color: "#e8b85c", fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
  },
  btnActive: { backgroundColor: "#c9a961", borderColor: "#c9a961" },
  btnText: { color: "#f5f5f5", fontSize: 13, fontWeight: "600" },
  btnTextActive: { color: "#0a0a0a" },
});
