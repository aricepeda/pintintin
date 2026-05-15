import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { DominoTile } from '../DominoTile';
import { AnimatedBoardTile } from './AnimatedBoardTile';
import { isDouble, type BoardTile, type Seat } from '@pintintin/game-core';

export type SeatScreenPosition = 'top' | 'bottom' | 'left' | 'right';

interface BoardProps {
  tiles: readonly BoardTile[];
  tileSize?: number;
  getSeatPosition?: (seat: Seat) => SeatScreenPosition;
  onChainBoundsChange?: (top: number, bottom: number) => void;
  onTileSizeChange?: (size: number) => void;
}

const SIZE_MAX = 32;
const SIZE_MIN = 18;
const GAP = 1;
const MARGIN = 2;

type Dir = 'up' | 'down' | 'left' | 'right';
type Orientation = 'horizontal' | 'vertical';
interface Placement {
  bt: BoardTile;
  x: number;       // top-left x in container
  y: number;       // top-left y in container
  w: number;
  h: number;
  orientation: Orientation;
  flipped: boolean;
}

function dimsFor(o: Orientation, size: number) {
  return o === 'horizontal' ? { w: size * 2 + 3, h: size } : { w: size, h: size * 2 + 3 };
}

// True if (x, y, w, h) lies inside the rectangular bounds.
function rectInsideRect(
  x: number, y: number, w: number, h: number,
  minX: number, minY: number, maxX: number, maxY: number,
): boolean {
  return x >= minX && y >= minY && x + w <= maxX && y + h <= maxY;
}

interface OvalBounds { cx: number; cy: number; a: number; b: number; }

// Lay out a half-chain starting from a given anchor point and direction.
// `initialMatch` is the pip value the FIRST tile of the segment must match
// (i.e. the opener's pip on the side this segment extends from).
function layoutHalf(
  segment: BoardTile[],
  anchor: { x: number; y: number },
  initialDir: Dir,
  initialMatch: number,
  size: number,
  oval: OvalBounds,
): Placement[] {
  const out: Placement[] = [];
  let dir = initialDir;
  let cursor = { ...anchor };
  let nextMatch = initialMatch;

  // Turn maps: bottom side rotates CCW, top side rotates CW (camera POV).
  const turnMap: Record<Dir, Dir> =
    initialDir === 'down' || initialDir === 'left'
      ? { down: 'left', left: 'up', up: 'right', right: 'down' }
      : { up: 'right', right: 'down', down: 'left', left: 'up' };

  // Build a placement. For aligned (non-corner) tiles: centered on cursor in
  // the placement direction. For corner tiles: perpendicular orientation,
  // OFFSET so the matching pip aligns with the cursor.
  const buildPlacement = (bt: BoardTile, d: Dir, corner: boolean): Placement | null => {
    const dbl = isDouble(bt.tile);
    const alignedNow: Orientation = (d === 'up' || d === 'down') ? 'vertical' : 'horizontal';
    const perp: Orientation = alignedNow === 'vertical' ? 'horizontal' : 'vertical';
    // Doubles always sit perpendicular to the chain axis. Corner tiles also.
    const orientation: Orientation = (dbl !== corner) ? perp : alignedNow;
    const { w, h } = dimsFor(orientation, size);

    let x = 0, y = 0;
    if (corner && !dbl) {
      // Non-double corner: align the matching PIP CENTER at the cursor so the
      // visual connection looks like real domino. Pip centers are at half/size+1.5
      // from the matching edge along the long axis.
      // For a horizontal tile (w = 2*size + 3): left pip center at x + size/2,
      // right pip center at x + 1.5*size + 3.
      // For a vertical tile: top pip center at y + size/2, bottom pip center at y + 1.5*size + 3.
      const newDir = turnMap[d];
      const halfSize = size / 2;
      const farPip = 1.5 * size + 3; // distance from tile origin to far pip center
      if (d === 'down') {
        y = cursor.y + GAP;
        // Horizontal tile below previous vertical tile.
        // newDir 'left' → matching pip on RIGHT → tile.x + farPip = cursor.x → tile.x = cursor.x - farPip
        // newDir 'right' → matching pip on LEFT → tile.x + halfSize = cursor.x → tile.x = cursor.x - halfSize
        x = newDir === 'left' ? cursor.x - farPip : cursor.x - halfSize;
      } else if (d === 'up') {
        y = cursor.y - h - GAP;
        x = newDir === 'left' ? cursor.x - farPip : cursor.x - halfSize;
      } else if (d === 'right') {
        x = cursor.x + GAP;
        // Vertical tile to the right of previous horizontal tile.
        y = newDir === 'up' ? cursor.y - farPip : cursor.y - halfSize;
      } else { // left
        x = cursor.x - w - GAP;
        y = newDir === 'up' ? cursor.y - farPip : cursor.y - halfSize;
      }
    } else {
      // Aligned (or double): centered on cursor in the placement axis.
      switch (d) {
        case 'down':  x = cursor.x - w / 2; y = cursor.y + GAP; break;
        case 'up':    x = cursor.x - w / 2; y = cursor.y - h - GAP; break;
        case 'right': x = cursor.x + GAP;   y = cursor.y - h / 2; break;
        case 'left':  x = cursor.x - w - GAP; y = cursor.y - h / 2; break;
      }
    }

    // Rectangular bounds: oval.a/b act as half-width/half-height from center.
    if (!rectInsideRect(
      x, y, w, h,
      oval.cx - oval.a, oval.cy - oval.b,
      oval.cx + oval.a, oval.cy + oval.b,
    )) return null;

    // Compute `flipped` so the matching pip touches the chain.
    // For ALIGNED non-double: matching pip is on side opposite to placement dir.
    //   d=down → matching at top (first); d=up → at bottom (second);
    //   d=right → at left (first); d=left → at right (second).
    // For CORNER non-double: matching pip is on the side that faces the OPPOSITE
    // of newDir (since chain exits via newDir).
    let flipped = false;
    if (!dbl) {
      const a = bt.tile.a, b = bt.tile.b;
      let matchOnFirst: boolean;
      if (corner) {
        const newDir = turnMap[d];
        // Horizontal corner: first=left, second=right.
        // Vertical corner: first=top, second=bottom.
        if (orientation === 'horizontal') {
          matchOnFirst = newDir === 'right'; // matching on LEFT (first) when continuing right
        } else {
          matchOnFirst = newDir === 'down'; // matching on TOP (first) when continuing down
        }
      } else {
        matchOnFirst = (d === 'down' || d === 'right');
      }
      if (matchOnFirst) {
        flipped = (a !== nextMatch) && (b === nextMatch);
      } else {
        flipped = (b !== nextMatch) && (a === nextMatch);
      }
    }
    return { bt, x, y, w, h, orientation, flipped };
  };

  // After an elbow we want at least one extra aligned tile in the new
  // direction so the wrapped column has visible spacing from the central one.
  const MIN_AFTER_CORNER = 1;
  let tilesInCurrentDir = 0;

  for (const bt of segment) {
    let p = buildPlacement(bt, dir, false);
    let isCorner = false;
    // If we just turned and still owe MIN tiles in this direction, prefer
    // placing aligned even if a corner would also work — keeps spacing nice.
    if (!p) {
      // Tried aligned, didn't fit. Only allow corner if we've placed enough
      // tiles in this direction already (otherwise the wrap stacks too tight).
      if (tilesInCurrentDir >= MIN_AFTER_CORNER) {
        p = buildPlacement(bt, dir, true);
        isCorner = !!p;
      }
    }
    if (!p) {
      // Last resort: try turning the direction altogether.
      const newDir = turnMap[dir];
      p = buildPlacement(bt, newDir, false);
      if (p) dir = newDir;
      else break;
    }
    out.push(p);

    // After a corner, change direction for subsequent tiles.
    const nextDir = isCorner ? turnMap[dir] : dir;

    // Update cursor to the FAR edge of the placed tile in the next direction.
    switch (nextDir) {
      case 'down':  cursor = { x: p.x + p.w / 2, y: p.y + p.h }; break;
      case 'up':    cursor = { x: p.x + p.w / 2, y: p.y }; break;
      case 'right': cursor = { x: p.x + p.w, y: p.y + p.h / 2 }; break;
      case 'left':  cursor = { x: p.x, y: p.y + p.h / 2 }; break;
    }

    // Update nextMatch — the pip exposed at the new chain end.
    // For aligned: exposed pip is on the side opposite to where matching pip touched.
    // For corners: the chain re-exits perpendicular, so the new exposed pip
    // is on the side facing the new direction.
    if (isCorner) {
      // Corner tile is perpendicular. The matching pip touched the side facing OLD dir.
      // The new exposed pip is on the side facing the NEW dir.
      // Side mapping for nextDir:
      //   nextDir=down/right → exposed pip is `second` (b/right or b/bottom).
      //   nextDir=up/left   → exposed pip is `first`.
      const exposedFirst = (nextDir === 'up' || nextDir === 'left');
      const a = bt.tile.a, b = bt.tile.b;
      const first = p.flipped ? b : a;
      const second = p.flipped ? a : b;
      nextMatch = exposedFirst ? first : second;
    } else {
      // Aligned tile: exposed pip is opposite to matching.
      const a = bt.tile.a, b = bt.tile.b;
      const first = p.flipped ? b : a;
      const second = p.flipped ? a : b;
      const matchedFirst = (dir === 'down' || dir === 'right');
      nextMatch = matchedFirst ? second : first;
    }

    if (isCorner) tilesInCurrentDir = 0;
    else tilesInCurrentDir += 1;

    dir = nextDir;
  }
  return out;
}

function layoutChain(ordered: BoardTile[], size: number, width: number, height: number): Placement[] {
  if (!width || !height || ordered.length === 0) return [];
  const openerIdx = ordered.findIndex((bt) => bt.end === 'start');
  if (openerIdx < 0) return [];
  const opener = ordered[openerIdx]!;
  const dbl = isDouble(opener.tile);
  const openerOrientation: Orientation = dbl ? 'horizontal' : 'vertical';
  const { w: ow, h: oh } = dimsFor(openerOrientation, size);
  const cx = width / 2;
  const cy = height / 2;
  const openerPlacement: Placement = {
    bt: opener,
    x: cx - ow / 2,
    y: cy - oh / 2,
    w: ow, h: oh,
    orientation: openerOrientation,
    flipped: opener.flipped,
  };
  // Oval bounds matching the felt (GameTable: 88% × 72% of screen, centered).
  // Shrink by MARGIN so tiles never touch the inner ring.
  const oval: OvalBounds = {
    cx, cy,
    a: (width * 0.88) / 2 - MARGIN,
    b: (height * 0.72) / 2 - MARGIN,
  };

  // The opener's exposed pip on each side. For a vertical opener, top=a, bottom=b
  // (no flipped, since opener is the first). For a double, both are equal.
  const openerTop = opener.tile.a;
  const openerBottom = opener.tile.b;

  const bottomSeg = ordered.slice(openerIdx + 1);
  const bottomPlacements = layoutHalf(
    bottomSeg,
    { x: cx, y: openerPlacement.y + openerPlacement.h },
    'down', openerBottom, size, oval,
  );

  const topSeg = ordered.slice(0, openerIdx).reverse();
  const topPlacements = layoutHalf(
    topSeg,
    { x: cx, y: openerPlacement.y },
    'up', openerTop, size, oval,
  );

  // Assemble in render order (top newest → ... → opener → ... → bottom newest).
  const all: Placement[] = [...topPlacements.reverse(), openerPlacement, ...bottomPlacements];

  // Centering pass — shift everything so the chain's bounding box centers
  // around (cx, cy). Keeps the board visually balanced as one side grows.
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x + p.w));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y + p.h));
  const dx = cx - (minX + maxX) / 2;
  const dy = cy - (minY + maxY) / 2;
  return all.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
}

function computeTileSize(count: number, height: number): number {
  if (!height || count <= 6) return SIZE_MAX;
  const s = (height / count - 2) / 1.6;
  return Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.floor(s)));
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

export function Board({
  tiles, onChainBoundsChange, onTileSizeChange, getSeatPosition,
}: BoardProps) {
  const ordered = orderForRender(tiles);
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const tileSize = computeTileSize(ordered.length, container.h);
  const placements = layoutChain(ordered, tileSize, container.w, container.h);

  // Track which tile.ids we've already rendered so we know which ones are NEW
  // and need an entrance animation (vs existing tiles that just slide smoothly).
  const seenIdsRef = useRef<Set<string>>(new Set());
  const newIds = new Set<string>();
  for (const p of placements) {
    if (!seenIdsRef.current.has(p.bt.tile.id)) newIds.add(p.bt.tile.id);
  }
  // Update the seen set for next render.
  useEffect(() => {
    seenIdsRef.current = new Set(placements.map((p) => p.bt.tile.id));
  });

  // Compute the entry offset for a new tile based on the playing seat's screen position.
  const entryOffset = (seat: Seat): { dx: number; dy: number } => {
    const pos = getSeatPosition?.(seat);
    const D = 240;
    if (pos === 'top') return { dx: 0, dy: -D };
    if (pos === 'bottom') return { dx: 0, dy: D };
    if (pos === 'left') return { dx: -D, dy: 0 };
    if (pos === 'right') return { dx: D, dy: 0 };
    return { dx: 0, dy: -60 }; // fallback
  };

  useEffect(() => { onTileSizeChange?.(tileSize); }, [tileSize]);

  const containerRef = useRef<View>(null);
  const reportChainBounds = () => {
    if (placements.length === 0) return;
    const minY = Math.min(...placements.map((p) => p.y));
    const maxY = Math.max(...placements.map((p) => p.y + p.h));
    containerRef.current?.measureInWindow((_x, y) => {
      onChainBoundsChange?.(y + minY, y + maxY);
    });
  };
  useEffect(() => {
    const t = setTimeout(reportChainBounds, 16);
    return () => clearTimeout(t);
  }, [placements.length, container.w, container.h, tileSize]);

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainer({ w: width, h: height });
  };

  return (
    <View ref={containerRef} style={styles.container} pointerEvents="none" onLayout={onContainerLayout}>
      {placements.map((p) => {
        const isNew = newIds.has(p.bt.tile.id);
        const offset = isNew ? entryOffset(p.bt.playedBy) : { dx: 0, dy: 0 };
        return (
          <AnimatedBoardTile
            key={p.bt.tile.id}
            a={p.bt.tile.a}
            b={p.bt.tile.b}
            size={tileSize}
            orientation={p.orientation}
            flipped={p.flipped}
            x={p.x}
            y={p.y}
            initialOffsetX={offset.dx}
            initialOffsetY={offset.dy}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  tileAbs: { position: 'absolute' },
});
