import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DominoTile } from '../DominoTile';
import type { Tile, End } from '@pintintin/game-core';

export interface GhostSpec {
  end: End;
  x: number;          // top-left x of the ghost
  y: number;          // top-left y of the ghost
  orientation: 'horizontal' | 'vertical';
  flipped: boolean;   // render b|a so the matching pip faces the chain
}

interface Props {
  draggedTile: Tile | null;
  ghosts: GhostSpec[];
  tileSize: number;
}

function Ghost({ tile, spec, size }: { tile: Tile; spec: GhostSpec; size: number }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.ghost, { left: spec.x, top: spec.y }]}
    >
      <DominoTile
        a={tile.a}
        b={tile.b}
        size={size}
        orientation={spec.orientation}
        flipped={spec.flipped}
      />
    </View>
  );
}

export function DropGhost({ draggedTile, ghosts, tileSize }: Props) {
  if (!draggedTile || ghosts.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ghosts.map((g) => (
        <Ghost key={g.end} tile={draggedTile} spec={g} size={tileSize} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', opacity: 0.5 },
});
