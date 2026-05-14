import React from 'react';
import { View, StyleSheet, Pressable, ScrollView } from 'react-native';
import { DominoTile } from '../DominoTile';
import type { Tile } from '@pintintin/game-core';
import { haptics } from '../../haptics';

interface PlayerHandProps {
  tiles: Tile[];
  selectedTileId?: string | null;
  onSelect?: (tile: Tile) => void;
  disabled?: boolean;
  tileSize?: number;
}

export function PlayerHand({
  tiles,
  selectedTileId,
  onSelect,
  disabled = false,
  tileSize = 52,
}: PlayerHandProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {tiles.map((tile) => {
        const selected = tile.id === selectedTileId;
        return (
          <Pressable
            key={tile.id}
            disabled={disabled}
            onPress={() => {
              haptics.light();
              onSelect?.(tile);
            }}
            style={styles.tileWrap}
          >
            <DominoTile a={tile.a} b={tile.b} size={tileSize} orientation="vertical" selected={selected} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 8,
  },
  tileWrap: {
    paddingVertical: 12,
  },
});
