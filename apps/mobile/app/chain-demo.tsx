import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Dimensions } from "react-native";
import { GameTable } from "../src/components/game/GameTable";
import { DominoTile } from "../src/components/DominoTile";
import { isDouble, type BoardTile, type Tile, type Pip } from "@pintintin/game-core";

const { width: W, height: H } = Dimensions.get("window");

// Mock 14 tiles for a heads-up max chain.
function buildMock(count: number): BoardTile[] {
  const arr: BoardTile[] = [];
  let prevPip: Pip = 6;
  for (let i = 0; i < count; i++) {
    const a: Pip = prevPip;
    const b: Pip = ((prevPip + i + 1) % 7) as Pip;
    const tile: Tile = { id: `m${i}`, a, b };
    arr.push({
      tile,
      playedBy: 0 as any,
      end: i === 0 ? "start" : i % 2 === 1 ? "right" : "left",
      flipped: false,
    });
    prevPip = b;
  }
  return arr;
}

type Mode = "shrink" | "multicol" | "snake" | "window";

export default function ChainDemo() {
  const [mode, setMode] = useState<Mode>("shrink");
  const [count, setCount] = useState(14);
  const tiles = buildMock(count);

  return (
    <View style={{ flex: 1 }}>
      <GameTable>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {mode === "shrink" && <Shrink tiles={tiles} />}
          {mode === "multicol" && <Multicol tiles={tiles} />}
          {mode === "snake" && <Snake tiles={tiles} />}
          {mode === "window" && <Window tiles={tiles} max={7} />}
        </View>
      </GameTable>

      <View style={styles.toolbar} pointerEvents="auto">
        {(["shrink", "multicol", "snake", "window"] as Mode[]).map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.chip, mode === m && styles.chipOn]}>
            <Text style={styles.chipText}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.counter} pointerEvents="auto">
        <Pressable onPress={() => setCount((c) => Math.max(1, c - 1))} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>−</Text>
        </Pressable>
        <Text style={styles.countText}>{count} fichas</Text>
        <Pressable onPress={() => setCount((c) => Math.min(24, c + 1))} style={styles.smallBtn}>
          <Text style={styles.smallBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ───────── Mode 1: Shrink (single column, dynamic size) ─────────
function Shrink({ tiles }: { tiles: BoardTile[] }) {
  const SIZE_MAX = 36, SIZE_MIN = 14;
  const availH = H * 0.72 - 40;
  const perTile = (s: number) => s * 1.6 + 2;
  let size = SIZE_MAX;
  while (size > SIZE_MIN && perTile(size) * tiles.length > availH) size -= 1;
  return (
    <View style={modes.center}>
      <View style={modes.col}>
        {tiles.map((bt, i) => (
          <View key={i} style={{ marginVertical: 1 }}>
            <DominoTile a={bt.tile.a} b={bt.tile.b} size={size} orientation={isDouble(bt.tile) ? "horizontal" : "vertical"} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ───────── Mode 2: Multi-column wrap (no elbow tile) ─────────
function Multicol({ tiles }: { tiles: BoardTile[] }) {
  const size = 24;
  const perCol = 5;
  const cols: BoardTile[][] = [];
  for (let i = 0; i < tiles.length; i += perCol) cols.push(tiles.slice(i, i + perCol));
  return (
    <View style={modes.center}>
      <View style={modes.row}>
        {cols.map((col, ci) => (
          <View key={ci} style={modes.col}>
            {col.map((bt, i) => (
              <View key={i} style={{ marginVertical: 1 }}>
                <DominoTile a={bt.tile.a} b={bt.tile.b} size={size} orientation={isDouble(bt.tile) ? "horizontal" : "vertical"} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ───────── Mode 3: Snake/zig-zag (alternating column direction) ─────────
function Snake({ tiles }: { tiles: BoardTile[] }) {
  const size = 24;
  const perCol = 5;
  const cols: BoardTile[][] = [];
  for (let i = 0; i < tiles.length; i += perCol) {
    const chunk = tiles.slice(i, i + perCol);
    cols.push(cols.length % 2 === 1 ? chunk.reverse() : chunk);
  }
  return (
    <View style={modes.center}>
      <View style={modes.row}>
        {cols.map((col, ci) => (
          <View key={ci} style={modes.col}>
            {col.map((bt, i) => (
              <View key={i} style={{ marginVertical: 1 }}>
                <DominoTile a={bt.tile.a} b={bt.tile.b} size={size} orientation={isDouble(bt.tile) ? "horizontal" : "vertical"} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ───────── Mode 4: Window (last N tiles + counter for hidden) ─────────
function Window({ tiles, max }: { tiles: BoardTile[]; max: number }) {
  const visible = tiles.slice(-max);
  const hidden = tiles.length - visible.length;
  return (
    <View style={modes.center}>
      <View style={modes.col}>
        {hidden > 0 && (
          <View style={modes.ellipsis}>
            <Text style={modes.ellipsisText}>… +{hidden}</Text>
          </View>
        )}
        {visible.map((bt, i) => (
          <View key={i} style={{ marginVertical: 1 }}>
            <DominoTile a={bt.tile.a} b={bt.tile.b} size={28} orientation={isDouble(bt.tile) ? "horizontal" : "vertical"} />
          </View>
        ))}
      </View>
    </View>
  );
}

const modes = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  col: { flexDirection: "column", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  ellipsis: { paddingVertical: 4 },
  ellipsisText: { color: "#bfe5c8", fontSize: 14, fontWeight: "700" },
});

const styles = StyleSheet.create({
  toolbar: {
    position: "absolute", top: 12, alignSelf: "center",
    flexDirection: "row", gap: 8, backgroundColor: "rgba(0,0,0,0.7)",
    padding: 8, borderRadius: 12,
  },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333",
  },
  chipOn: { borderColor: "#f2c14e", backgroundColor: "#155a44" },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  counter: {
    position: "absolute", bottom: 16, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12,
  },
  smallBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: "#155a44",
    alignItems: "center", justifyContent: "center",
  },
  smallBtnText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  countText: { color: "#f2c14e", fontWeight: "800", fontSize: 14 },
});
