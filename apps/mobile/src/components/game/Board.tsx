import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { DominoTile } from '../DominoTile';
import { isDouble, type BoardTile } from '@pintintin/game-core';

interface BoardProps {
  tiles: readonly BoardTile[];
  tileSize?: number;
}

function orderForRender(board: readonly BoardTile[]): BoardTile[] {
  const left: BoardTile[] = [];
  const right: BoardTile[] = [];
  let opener: BoardTile | null = null;
  for (const bt of board) {
    if (bt.end === 'start') opener = bt;
    else if (bt.end === 'left') left.unshift(bt);
    else right.push(bt);
  }
  return opener ? [...left, opener, ...right] : [...left, ...right];
}

export function Board({ tiles, tileSize = 36 }: BoardProps) {
  const ordered = orderForRender(tiles);

  return (
    <View style={styles.container} pointerEvents="none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chain}
      >
        {ordered.map((bt, i) => {
          const dbl = isDouble(bt.tile);
          return (
            <View key={bt.tile.id + i} style={styles.tileWrap}>
              <DominoTile
                a={bt.tile.a}
                b={bt.tile.b}
                size={tileSize}
                orientation={dbl ? 'vertical' : 'horizontal'}
                flipped={bt.flipped}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 24,
  },
  tileWrap: {
    marginHorizontal: 1,
  },
});
