import React from 'react';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { isDouble, type Tile } from '@pintintin/game-core';
import { DominoTile } from '../DominoTile';

interface DragLayerProps {
  tile: Tile | null;
  size: number;
  sharedDragX: SharedValue<number>;
  sharedDragY: SharedValue<number>;
  sharedDragVisible: SharedValue<number>;
}

export function DragLayer({ tile, size, sharedDragX, sharedDragY, sharedDragVisible }: DragLayerProps) {
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: sharedDragX.value - size / 2,
    top: sharedDragY.value - size,
    opacity: sharedDragVisible.value,
    zIndex: 9999,
    transform: [{ scale: 1.15 }],
  }));
  if (!tile) return null;
  return (
    <Animated.View pointerEvents="none" style={style}>
      <DominoTile a={tile.a} b={tile.b} size={size} orientation={isDouble(tile) ? 'horizontal' : 'vertical'} />
    </Animated.View>
  );
}
