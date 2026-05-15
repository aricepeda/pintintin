import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { DraggableTile, type DropZone } from '../DraggableTile';
import { canPlayTile, type Tile, type End, type Pip } from '@pintintin/game-core';

export interface DraggableHandProps {
  tiles: readonly Tile[];
  leftEnd: Pip | null;
  rightEnd: Pip | null;
  disabled?: boolean;
  zones: DropZone[];
  tileSize: number;
  onDrop: (tile: Tile, end: End) => void;
  sharedDragX: SharedValue<number>;
  sharedDragY: SharedValue<number>;
  sharedDragVisible: SharedValue<number>;
  onDragStart: (tile: Tile) => void;
  onDragEnd: () => void;
}

export function DraggableHand({
  tiles, leftEnd, rightEnd, disabled = false, zones, tileSize,
  onDrop, sharedDragX, sharedDragY, sharedDragVisible,
  onDragStart, onDragEnd,
}: DraggableHandProps) {
  return (
    <View style={styles.row}>
      {tiles.map((t) => {
        const canLeft = canPlayTile(t, leftEnd, rightEnd, 'left');
        const canRight = canPlayTile(t, leftEnd, rightEnd, 'right');
        const playable = canLeft || canRight;
        return (
          <View key={t.id} style={styles.slot}>
            <DraggableTile
              tile={t}
              size={tileSize}
              disabled={disabled || !playable}
              dim={!disabled && !playable}
              legalEnds={{ left: canLeft, right: canRight }}
              zones={zones}
              onDrop={(end) => onDrop(t, end)}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              sharedDragX={sharedDragX}
              sharedDragY={sharedDragY}
              sharedDragVisible={sharedDragVisible}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slot: { paddingHorizontal: 1 },
});
