import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { GameTable } from "../src/components/game/GameTable";
import { PlayerSeat } from "../src/components/game/PlayerSeat";

type Layout = "A" | "B" | "C";

const PLAYERS = [
  { name: "Andrew", rating: 1200, money: 5000 },   // south = you
  { name: "Lola",   rating: 1150, money: 4200 },   // west
  { name: "Pepe",   rating: 1340, money: 6100 },   // north
  { name: "Carmen", rating: 1080, money: 3800 },   // east
];

export default function SeatsDemo() {
  const [layout, setLayout] = useState<Layout>("A");

  return (
    <View style={{ flex: 1 }}>
      <GameTable>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {layout === "A" && <LayoutA />}
          {layout === "B" && <LayoutB />}
          {layout === "C" && <LayoutC />}
        </View>
      </GameTable>

      <View style={styles.toolbar} pointerEvents="auto">
        {(["A", "B", "C"] as Layout[]).map((l) => (
          <Pressable
            key={l}
            onPress={() => setLayout(l)}
            style={[styles.chip, layout === l && styles.chipActive]}
          >
            <Text style={styles.chipText}>Opción {l}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.legend} pointerEvents="none">
        <Text style={styles.legendText}>
          {layout === "A" && "A — Avatares AFUERA del óvalo, entre la mesa y el borde"}
          {layout === "B" && "B — Avatares SOBRE el borde del óvalo (mitad-mitad)"}
          {layout === "C" && "C — Estilo Pintintín (top + bottom prominentes, sides chicos)"}
        </Text>
      </View>
    </View>
  );
}

// ───────────────────────────── A: at oval edge ─────────────────────────────
function LayoutA() {
  return (
    <>
      <View style={[stylesA.seat, stylesA.north]}><PlayerSeat {...PLAYERS[2]!} /></View>
      <View style={[stylesA.seat, stylesA.east]}><PlayerSeat {...PLAYERS[3]!} /></View>
      <View style={[stylesA.seat, stylesA.south]}><PlayerSeat {...PLAYERS[0]!} isCurrentUser /></View>
      <View style={[stylesA.seat, stylesA.west]}><PlayerSeat {...PLAYERS[1]!} isActive /></View>
    </>
  );
}
const stylesA = StyleSheet.create({
  seat: { position: "absolute" },
  // Avatares con el centro sobre el borde del óvalo, en las 4 direcciones cardinales.
  // Óvalo = 88% W × 72% H, centrado → bordes a:
  //   top    = 14% de pantalla
  //   bottom = 14% de pantalla
  //   left   = 6%  de pantalla
  //   right  = 6%  de pantalla
  // marginTop/marginLeft -40 centra el avatar (~80px) sobre el borde.
  north: { top: "14%", left: 0, right: 0, alignItems: "center", marginTop: -40 },
  south: { bottom: "14%", left: 0, right: 0, alignItems: "center", marginBottom: -40 },
  east:  { right: "6%", top: 0, bottom: 0, justifyContent: "center", marginRight: -40 },
  west:  { left: "6%", top: 0, bottom: 0, justifyContent: "center", marginLeft: -40 },
});

// ───────────────────────── B: at screen edges (outside) ─────────────────────────
function LayoutB() {
  return (
    <>
      <View style={[stylesB.seat, stylesB.north]}><PlayerSeat {...PLAYERS[2]!} /></View>
      <View style={[stylesB.seat, stylesB.east]}><PlayerSeat {...PLAYERS[3]!} /></View>
      <View style={[stylesB.seat, stylesB.south]}><PlayerSeat {...PLAYERS[0]!} isCurrentUser /></View>
      <View style={[stylesB.seat, stylesB.west]}><PlayerSeat {...PLAYERS[1]!} isActive /></View>
    </>
  );
}
const stylesB = StyleSheet.create({
  seat: { position: "absolute" },
  // SOBRE el borde del óvalo — el avatar queda mitad afuera, mitad sobre la mesa.
  // El óvalo va de top 11% a bottom 11%. Coloco el avatar (~80px alto) centrado
  // en esa coordenada usando negative margin.
  north: { top: "11%", left: 0, right: 0, alignItems: "center", marginTop: -40 },
  south: { bottom: "11%", left: 0, right: 0, alignItems: "center", marginBottom: -40 },
  east:  { right: "11%", top: 0, bottom: 0, justifyContent: "center", marginRight: -40 },
  west:  { left: "11%", top: 0, bottom: 0, justifyContent: "center", marginLeft: -40 },
});

// ─────────────────── C: Pintintín-mockup style ───────────────────
// North y south destacados (avatares grandes con coin badge), east/west más pequeños.
function LayoutC() {
  return (
    <>
      <View style={[stylesC.seat, stylesC.north]}>
        <PlayerSeat {...PLAYERS[2]!} />
      </View>
      <View style={[stylesC.seat, stylesC.east]}>
        <PlayerSeat {...PLAYERS[3]!} />
      </View>
      <View style={[stylesC.seat, stylesC.south]}>
        <PlayerSeat {...PLAYERS[0]!} isCurrentUser />
      </View>
      <View style={[stylesC.seat, stylesC.west]}>
        <PlayerSeat {...PLAYERS[1]!} isActive />
      </View>
    </>
  );
}
const stylesC = StyleSheet.create({
  seat: { position: "absolute" },
  // Top: justo encima del óvalo, centrado
  north: { top: "6%", left: 0, right: 0, alignItems: "center" },
  // Bottom: bajo el óvalo, alineado a la derecha (como el mockup con "Andrew")
  south: { bottom: "6%", right: "8%", alignItems: "flex-end" },
  // Sides: más cerca de la mesa, escalados (transform: scale 0.85)
  east:  { right: "8%", top: 0, bottom: 0, justifyContent: "center", transform: [{ scale: 0.85 }] },
  west:  { left: "8%",  top: 0, bottom: 0, justifyContent: "center", transform: [{ scale: 0.85 }] },
});

// ────────────────────────────── toolbar ──────────────────────────────
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
  chipActive: { borderColor: "#f2c14e", backgroundColor: "#155a44" },
  chipText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  legend: {
    position: "absolute", bottom: 12, left: 0, right: 0,
    alignItems: "center",
  },
  legendText: {
    backgroundColor: "rgba(0,0,0,0.7)", color: "#bfe5c8",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    fontSize: 12, fontWeight: "700",
  },
});
