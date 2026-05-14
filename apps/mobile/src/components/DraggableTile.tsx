import { useCallback } from "react";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from "react-native-reanimated";
import type { Tile } from "@pintintin/game-core";
import { DominoTile } from "./DominoTile";

export interface DropZone {
  x: number;
  y: number;
  w: number;
  h: number;
  end: "left" | "right";
}

interface Props {
  tile: Tile;
  size?: number;
  disabled?: boolean;
  dim?: boolean;
  selected?: boolean;
  legalEnds: { left: boolean; right: boolean };
  zones: DropZone[];
  onDrop: (end: "left" | "right") => void;
  onTap?: () => void;
  onDragStart?: (tile: Tile) => void;
  onDragEnd?: () => void;
  sharedDragX: SharedValue<number>;
  sharedDragY: SharedValue<number>;
  sharedDragVisible: SharedValue<number>;
}

export function DraggableTile({
  tile, size = 48, disabled, dim, selected, legalEnds, zones,
  onDrop, onTap, onDragStart, onDragEnd,
  sharedDragX, sharedDragY, sharedDragVisible,
}: Props) {
  const dragging = useSharedValue(0);
  const liftAnim = useSharedValue(0);

  const tryDrop = useCallback(
    (absX: number, absY: number) => {
      for (const z of zones) {
        if (absX >= z.x && absX <= z.x + z.w && absY >= z.y && absY <= z.y + z.h) {
          if (z.end === "left" && legalEnds.left) { onDrop("left"); return; }
          if (z.end === "right" && legalEnds.right) { onDrop("right"); return; }
        }
      }
    },
    [zones, legalEnds, onDrop],
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetY([-12, 12])
    .failOffsetX([-20, 20])
    .onStart((e) => {
      dragging.value = 1;
      sharedDragX.value = e.absoluteX;
      sharedDragY.value = e.absoluteY;
      sharedDragVisible.value = 1;
      if (onDragStart) runOnJS(onDragStart)(tile);
    })
    .onUpdate((e) => {
      sharedDragX.value = e.absoluteX;
      sharedDragY.value = e.absoluteY;
    })
    .onEnd((e) => {
      sharedDragVisible.value = 0;
      dragging.value = 0;
      runOnJS(tryDrop)(e.absoluteX, e.absoluteY);
      if (onDragEnd) runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      sharedDragVisible.value = 0;
      dragging.value = 0;
    });

  const tap = Gesture.Tap()
    .maxDuration(300)
    .onEnd((_e, success) => {
      if (success && onTap) runOnJS(onTap)();
    });

  const composed = Gesture.Exclusive(pan, tap);

  // Lift animation when selected.
  liftAnim.value = withSpring(selected ? 1 : 0, { damping: 14, stiffness: 220 });

  const dragStyle = useAnimatedStyle(() => ({
    opacity: dragging.value ? 0 : 1,
    transform: [
      { scale: 1 + liftAnim.value * 0.12 },
      { translateY: -10 * liftAnim.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[dragStyle, selected && { zIndex: 10 }]}>
        <View
          style={{
            opacity: dim ? 0.2 : 1,
            borderRadius: 6,
            borderWidth: selected ? 2 : 0,
            borderColor: "#f2c14e",
          }}
        >
          <DominoTile a={tile.a} b={tile.b} size={size} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
