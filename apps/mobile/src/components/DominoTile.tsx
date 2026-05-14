import { View, StyleSheet } from "react-native";
import type { Pip } from "@pintintin/game-core";

interface Props {
  a: Pip;
  b: Pip;
  size?: number;
  orientation?: "vertical" | "horizontal";
  selected?: boolean;
  faceDown?: boolean;
  flipped?: boolean; // render b|a instead of a|b
}

const PIP_POSITIONS: Record<Pip, ReadonlyArray<readonly [number, number]>> = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.2], [0.72, 0.2], [0.28, 0.5], [0.72, 0.5], [0.28, 0.8], [0.72, 0.8]],
};

function Half({ pip, side, isVertical }: { pip: Pip; side: number; isVertical: boolean }) {
  const pipSize = Math.max(4, side * 0.18);
  // Rotate pip positions 90° clockwise for horizontal tiles: (x,y) → (y, 1-x)
  const positions = PIP_POSITIONS[pip].map(([x, y]) =>
    isVertical ? ([x, y] as const) : ([y, 1 - x] as const)
  );
  return (
    <View style={{ width: side, height: side, position: "relative" }}>
      {positions.map(([x, y], i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            width: pipSize,
            height: pipSize,
            borderRadius: pipSize / 2,
            backgroundColor: "#1a1208",
            left: x * side - pipSize / 2,
            top: y * side - pipSize / 2,
          }}
        />
      ))}
    </View>
  );
}

export function DominoTile({
  a, b, size = 56,
  orientation = "vertical",
  selected, faceDown, flipped,
}: Props) {
  const isVertical = orientation === "vertical";
  const first: Pip = flipped ? b : a;
  const second: Pip = flipped ? a : b;

  const containerStyle = isVertical
    ? { width: size, height: size * 2 + 3, flexDirection: "column" as const }
    : { width: size * 2 + 3, height: size, flexDirection: "row" as const };

  if (faceDown) {
    return (
      <View style={[styles.tile, containerStyle, styles.faceDown, selected && styles.selected]} />
    );
  }

  return (
    <View style={[styles.tile, containerStyle, selected && styles.selected]}>
      <Half pip={first} side={size} isVertical={isVertical} />
      <View style={isVertical ? styles.divH : styles.divV} />
      <Half pip={second} side={size} isVertical={isVertical} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: "#faf6e8",
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#3a2410",
    shadowColor: "#000",
    shadowOffset: { width: 1, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 6,
    elevation: 8,
    // Subtle inner highlight on web for a dimensional feel
    ...((typeof document !== "undefined") && {
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 8px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)",
    } as any),
  },
  selected: {
    borderColor: "#f2c14e",
    borderWidth: 2.5,
    transform: [{ translateY: -10 }],
  },
  faceDown: {
    backgroundColor: "#7a3b3b",
    borderColor: "#3a1010",
  },
  divH: {
    height: 1.5,
    backgroundColor: "#3a2410",
    marginHorizontal: 4,
  },
  divV: {
    width: 1.5,
    backgroundColor: "#3a2410",
    marginVertical: 4,
  },
});
