import { View, Text, StyleSheet, ScrollView } from "react-native";
import { DominoTile } from "../src/components/DominoTile";

// Demo: three styles of placing a double in a vertical chain.
// Each panel renders three tiles: top vertical (5|2), middle double (2|2),
// bottom vertical (2|3). Positions are computed absolutely so the geometry
// is identical to what Board.tsx would produce — only the offset of the
// double (and the next-tile anchor) varies.

const SIZE = 36;
const GAP = 2;
const TILE_W_V = SIZE;
const TILE_H_V = SIZE * 2 + 3;
const TILE_W_H = SIZE * 2 + 3;
const TILE_H_H = SIZE;

type Style = "acostada" | "parada-aligned" | "parada-center";

function Panel({ style, title, subtitle }: { style: Style; title: string; subtitle: string }) {
  // Anchor: top-vertical tile centered at (cx, 0..TILE_H_V).
  const PANEL_W = 220;
  const cx = PANEL_W / 2;
  let topY = 10;
  const top = { x: cx - TILE_W_V / 2, y: topY };

  // Cursor after top tile = (cx, topY + TILE_H_V) — bottom-center of top tile.
  const cursorAfterTopX = cx;
  const cursorAfterTopY = topY + TILE_H_V;

  // Double placement + next-tile anchor depending on style.
  let dbl: { x: number; y: number; w: number; h: number; orientation: "horizontal" | "vertical" };
  let nextAnchorX: number;
  let nextAnchorY: number;

  if (style === "acostada") {
    // In-line with chain: double behaves like a regular vertical tile.
    dbl = {
      x: cx - TILE_W_V / 2,
      y: cursorAfterTopY + GAP,
      w: TILE_W_V,
      h: TILE_H_V,
      orientation: "vertical",
    };
    nextAnchorX = cx;
    nextAnchorY = dbl.y + dbl.h;
  } else if (style === "parada-aligned") {
    // Perpendicular, but offset so LEFT half-center aligns with chain axis.
    // Left half center is at x + SIZE/2. We want x + SIZE/2 = cx, so x = cx - SIZE/2.
    dbl = {
      x: cx - SIZE / 2,
      y: cursorAfterTopY + GAP,
      w: TILE_W_H,
      h: TILE_H_H,
      orientation: "horizontal",
    };
    // Chain continues from BOTTOM of LEFT half (still on cx).
    nextAnchorX = cx;
    nextAnchorY = dbl.y + dbl.h;
  } else {
    // parada-center (current behavior): perpendicular, centered on chain axis.
    dbl = {
      x: cx - TILE_W_H / 2,
      y: cursorAfterTopY + GAP,
      w: TILE_W_H,
      h: TILE_H_H,
      orientation: "horizontal",
    };
    nextAnchorX = cx;
    nextAnchorY = dbl.y + dbl.h;
  }

  const bottom = {
    x: nextAnchorX - TILE_W_V / 2,
    y: nextAnchorY + GAP,
  };

  const PANEL_H = bottom.y + TILE_H_V + 14;

  return (
    <View style={[styles.panel, { width: PANEL_W, height: PANEL_H }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <View style={styles.canvas}>
        {/* Chain axis guide */}
        <View style={[styles.axis, { left: cx - 0.5, top: top.y, height: bottom.y + TILE_H_V - top.y }]} />
        <View style={{ position: "absolute", left: top.x, top: top.y }}>
          <DominoTile a={5} b={2} size={SIZE} orientation="vertical" />
        </View>
        <View style={{ position: "absolute", left: dbl.x, top: dbl.y }}>
          <DominoTile a={2} b={2} size={SIZE} orientation={dbl.orientation} />
        </View>
        <View style={{ position: "absolute", left: bottom.x, top: bottom.y }}>
          <DominoTile a={2} b={3} size={SIZE} orientation="vertical" />
        </View>
      </View>
    </View>
  );
}

export default function DoublesDemo() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Opciones para colocar el doble</Text>
      <Text style={styles.headerSub}>
        Cadena de 3 fichas: 5|2 → 2|2 (doble) → 2|3. La línea amarilla es el eje del chain.
      </Text>
      <View style={styles.grid}>
        <Panel
          style="acostada"
          title="Opción 1: Acostada"
          subtitle="Doble en línea con el chain (como una ficha normal)."
        />
        <Panel
          style="parada-aligned"
          title="Opción 2: Parada (pip alineado)"
          subtitle="Doble perpendicular, mitad izq sobre el eje."
        />
        <Panel
          style="parada-center"
          title="Opción 3: Parada centrada (actual)"
          subtitle="Doble perpendicular, centrado en el eje."
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0a" },
  content: { padding: 16, alignItems: "center", gap: 16 },
  header: { color: "#f5f5f5", fontSize: 18, fontWeight: "800" },
  headerSub: { color: "#bfbfbf", fontSize: 12, textAlign: "center", maxWidth: 340 },
  grid: { gap: 12, alignItems: "center" },
  panel: {
    backgroundColor: "#0d5a3a",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#c9a961",
    padding: 8,
    alignItems: "center",
  },
  titleRow: { alignItems: "center", marginBottom: 4 },
  title: { color: "#ffd966", fontSize: 13, fontWeight: "800" },
  subtitle: { color: "#e8e8e8", fontSize: 10, textAlign: "center", marginTop: 2 },
  canvas: { flex: 1, alignSelf: "stretch", position: "relative" },
  axis: {
    position: "absolute",
    width: 1,
    backgroundColor: "rgba(255, 217, 102, 0.35)",
  },
});
