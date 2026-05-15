import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { GameTable } from '../components/game/GameTable';
import { PlayerSeat, type PlayerSeatProps } from '../components/game/PlayerSeat';
import { Board, type SeatScreenPosition, type ChainEndInfo } from '../components/game/Board';
import { DraggableHand } from '../components/game/DraggableHand';
import { DragLayer } from '../components/game/DragLayer';
import { DropGhost, type GhostSpec } from '../components/game/DropGhost';
import { HamburgerMenu, type MenuOption } from '../components/ui/HamburgerMenu';
import { usePortraitLock } from '../hooks/usePortraitLock';
import { confirmLeaveRoom } from '../net/leaveRoom';
import { playTile } from '../net/playTile';
import { devReset } from '../net/devReset';
import { useGameStore } from '../store/game';
import { speak } from '../audio';
import {
  canPlayTile,
  isDouble,
  type Seat,
  type End,
  type Tile,
} from '@pintintin/game-core';
import type { DropZone } from '../components/DraggableTile';

type SeatPosition = 'south' | 'west' | 'north' | 'east';

const POSITION_ORDER: SeatPosition[] = ['south', 'west', 'north', 'east'];

const POSITION_TO_SCREEN: Record<SeatPosition, SeatScreenPosition> = {
  south: 'bottom',
  west: 'left',
  north: 'top',
  east: 'right',
};

function mapSeatsToPositions(yourSeat: Seat, playerCount: number): Record<Seat, SeatPosition> {
  const map = {} as Record<Seat, SeatPosition>;
  if (playerCount === 2) {
    // Heads-up: you (south) vs the other (north). No east/west.
    map[yourSeat] = 'south';
    const opponent = ((yourSeat + 1) % 2) as Seat;
    map[opponent] = 'north';
    return map;
  }
  // 4-player: you=south, then west/north/east clockwise around the table.
  for (let i = 0; i < playerCount; i++) {
    const seat = ((yourSeat + i) % playerCount) as Seat;
    map[seat] = POSITION_ORDER[i]!;
  }
  return map;
}

const placeholder = (name: string): PlayerSeatProps => ({
  name,
  money: 5000,
});

const HAND_TILE_SIZE = 30;
const GHOST_GAP = 6;

export function GameScreen() {
  usePortraitLock();

  const yourSeat = useGameStore((s) => s.yourSeat);
  const yourHand = useGameStore((s) => s.yourHand);
  const publicState = useGameStore((s) => s.publicState);
  const waiting = useGameStore((s) => s.waiting);
  const announcement = useGameStore((s) => s.announcement);

  useEffect(() => {
    if (announcement?.type === 'pass') {
      speak('Pass');
    }
  }, [announcement]);

  const effectiveYourSeat: Seat = yourSeat ?? 0;
  const seatToPos = mapSeatsToPositions(effectiveYourSeat, publicState?.activeSeats?.length ?? waiting?.playerCount ?? 4);
  const activeSeat = publicState?.currentSeat ?? null;
  const playerCount =
    publicState?.activeSeats?.length ?? waiting?.playerCount ?? 4;
  const isHeadsUp = playerCount === 2;

  const positionToSeat = (pos: SeatPosition): Seat => {
    if (playerCount === 2) {
      // Heads-up: only south (you) and north (opponent).
      if (pos === 'south') return effectiveYourSeat;
      if (pos === 'north') return ((effectiveYourSeat + 1) % 2) as Seat;
      return effectiveYourSeat; // east/west have no seat in heads-up
    }
    const offset = POSITION_ORDER.indexOf(pos);
    return ((effectiveYourSeat + offset) % playerCount) as Seat;
  };

  const POSITION_LABEL: Record<SeatPosition, string> = {
    south: 'Tú',
    west: 'Oeste',
    north: 'Norte',
    east: 'Este',
  };

  const seatName = (seat: Seat): string => {
    const w = waiting?.seats?.find((s) => s.seat === seat);
    if (w?.occupied && w.displayName) return w.displayName;
    return POSITION_LABEL[seatToPos[seat]];
  };

  const POSITION_TO_LAYOUT = {
    south: 'bottom',
    north: 'bottom',
    east: 'right',
    west: 'left',
  } as const;

  const seatProps = (seat: Seat): PlayerSeatProps => {
    const isYou = seat === effectiveYourSeat;
    const isActive = activeSeat === seat;
    const pos = seatToPos[seat];
    return {
      ...placeholder(seatName(seat)),
      isCurrentUser: isYou,
      isActive,
      turnDeadline: null, // timer disabled
      handCount: publicState?.handCounts?.[seat] ?? null,
      layout: POSITION_TO_LAYOUT[pos],
      showPass: announcement?.type === 'pass' && announcement.seat === seat,
    };
  };

  const getSeatPosition = useCallback(
    (seat: Seat): SeatScreenPosition => POSITION_TO_SCREEN[seatToPos[seat]],
    [seatToPos],
  );

  const board = publicState?.board ?? [];
  const leftEnd = publicState?.leftEnd ?? null;
  const rightEnd = publicState?.rightEnd ?? null;
  const isYourTurn = activeSeat === effectiveYourSeat;


  const sharedDragX = useSharedValue(0);
  const sharedDragY = useSharedValue(0);
  const sharedDragVisible = useSharedValue(0);
  const [draggedTile, setDraggedTile] = useState<Tile | null>(null);

  const [boardRect, setBoardRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const onBoardLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setBoardRect({ x, y, w: width, h: height });
  };

  // Chain ends — cursor position + direction for each end (window-absolute).
  const [chainEnds, setChainEnds] = useState<{ left: ChainEndInfo | null; right: ChainEndInfo | null }>({ left: null, right: null });
  const [boardTileSize, setBoardTileSize] = useState(28);
  const handleChainEnds = useCallback(
    (left: ChainEndInfo | null, right: ChainEndInfo | null) => setChainEnds({ left, right }),
    [],
  );
  const handleTileSize = useCallback((s: number) => setBoardTileSize(s), []);

  // Build a ghost adjacent to a chain end, respecting the chain's direction
  // at that end (so after a corner the ghost extends sideways, not down).
  const ghostFor = (
    end: End,
    info: ChainEndInfo,
    tile: Tile,
    matchPip: number | null,
  ): GhostSpec => {
    const dbl = isDouble(tile);
    const dir = info.direction;
    const chainIsVertical = dir === 'up' || dir === 'down';
    const orientation: 'horizontal' | 'vertical' = dbl
      ? (chainIsVertical ? 'horizontal' : 'vertical')
      : (chainIsVertical ? 'vertical' : 'horizontal');
    const w = orientation === 'horizontal' ? boardTileSize * 2 + 3 : boardTileSize;
    const h = orientation === 'horizontal' ? boardTileSize : boardTileSize * 2 + 3;
    let x = 0, y = 0;
    if (dir === 'down')  { x = info.cursorX - w / 2; y = info.cursorY + GHOST_GAP; }
    else if (dir === 'up')    { x = info.cursorX - w / 2; y = info.cursorY - GHOST_GAP - h; }
    else if (dir === 'right') { x = info.cursorX + GHOST_GAP; y = info.cursorY - h / 2; }
    else                      { x = info.cursorX - GHOST_GAP - w; y = info.cursorY - h / 2; }
    // Flip so the matching pip touches the chain (i.e. the side facing `dir`-opposite).
    // For dir 'down'/'right' the matching pip is on the "first" side of the tile;
    // for 'up'/'left' it's on the "second" side.
    let flipped = false;
    if (!dbl && matchPip !== null) {
      const matchOnFirst = dir === 'down' || dir === 'right';
      if (matchOnFirst) flipped = tile.b === matchPip && tile.a !== matchPip;
      else              flipped = tile.a === matchPip && tile.b !== matchPip;
    }
    return { end, x, y, orientation, flipped };
  };

  // Compute ghost positions adjacent to the chain endpoints.
  const ghosts: GhostSpec[] = (() => {
    if (!draggedTile || !boardRect.w) return [];
    const out: GhostSpec[] = [];
    const canLeft = canPlayTile(draggedTile, leftEnd, rightEnd, 'left');
    const canRight = canPlayTile(draggedTile, leftEnd, rightEnd, 'right');
    // When board is empty, both ends are valid; show a single ghost at center.
    if (board.length === 0) {
      if (canLeft || canRight) {
        const dbl = isDouble(draggedTile);
        const orientation: 'horizontal' | 'vertical' = dbl ? 'horizontal' : 'vertical';
        const ghostW = orientation === 'horizontal' ? boardTileSize * 2 + 3 : boardTileSize;
        const ghostH = orientation === 'horizontal' ? boardTileSize : boardTileSize * 2 + 3;
        out.push({
          end: 'right',
          x: boardRect.x + boardRect.w / 2 - ghostW / 2,
          y: boardRect.y + boardRect.h / 2 - ghostH / 2,
          orientation,
          flipped: false,
        });
      }
      return out;
    }
    if (canLeft && chainEnds.left)  out.push(ghostFor('left',  chainEnds.left,  draggedTile, leftEnd));
    if (canRight && chainEnds.right) out.push(ghostFor('right', chainEnds.right, draggedTile, rightEnd));
    return out;
  })();

  // Drop zones = ghost rects (+ small padding). Drop only succeeds when the
  // finger lifts ON TOP of a ghost; anywhere else returns the tile to the hand.
  const HIT_PADDING = 12;
  const zones: DropZone[] = ghosts.map((g) => {
    const w = (g.orientation === 'horizontal' ? boardTileSize * 2 + 3 : boardTileSize) + HIT_PADDING * 2;
    const h = (g.orientation === 'horizontal' ? boardTileSize : boardTileSize * 2 + 3) + HIT_PADDING * 2;
    return { x: g.x - HIT_PADDING, y: g.y - HIT_PADDING, w, h, end: g.end };
  });

  // Auto-snap area: when only ONE ghost is showing (single legal end, or
  // opener), a drop anywhere inside the playable board area snaps to that end.
  // Excludes the bottom 25% (where the hand sits), so dropping on the hand
  // still returns the tile.
  const autoSnapArea = boardRect.w
    ? { x: boardRect.x, y: boardRect.y, w: boardRect.w, h: boardRect.h * 0.75 }
    : null;

  const handleDrop = async (tile: Tile, end: End) => {
    const resp = await playTile(tile.id, end);
    if (!resp.ok) console.warn('[playTile] failed', resp.error);
  };

  const menuOptions: MenuOption[] = [
    { key: 'sound', label: 'Sonido', icon: '🔊', onPress: () => {} },
    { key: 'chat', label: 'Chat', icon: '💬', onPress: () => {} },
    { key: 'settings', label: 'Ajustes', icon: '⚙️', onPress: () => {} },
    { key: 'leave', label: 'Salir', icon: '🚪', onPress: confirmLeaveRoom, destructive: true },
  ];

  return (
    <GameTable>
      <View style={StyleSheet.absoluteFill} onLayout={onBoardLayout} pointerEvents="box-none">
        <Board
          tiles={board}
          getSeatPosition={getSeatPosition}
          onChainEndsChange={handleChainEnds}
          onTileSizeChange={handleTileSize}
        />
      </View>

      <DropGhost draggedTile={draggedTile} ghosts={ghosts} tileSize={boardTileSize} />

      <View style={styles.seatsLayer} pointerEvents="box-none">
        <View style={[styles.seat, styles.north]}>
          <PlayerSeat {...seatProps(positionToSeat('north'))} />
        </View>
        {!isHeadsUp && (
          <>
            <View style={[styles.seat, styles.east]}>
              <PlayerSeat {...seatProps(positionToSeat('east'))} />
            </View>
            <View style={[styles.seat, styles.west]}>
              <PlayerSeat {...seatProps(positionToSeat('west'))} />
            </View>
          </>
        )}

        <View style={[styles.seat, styles.southInfo]}>
          <PlayerSeat {...seatProps(positionToSeat('south'))} />
        </View>

        <View style={styles.handLayer} pointerEvents="box-none">
          <DraggableHand
            tiles={yourHand}
            leftEnd={leftEnd}
            rightEnd={rightEnd}
            disabled={!isYourTurn}
            zones={zones}
            autoSnapArea={autoSnapArea}
            tileSize={HAND_TILE_SIZE}
            onDrop={handleDrop}
            sharedDragX={sharedDragX}
            sharedDragY={sharedDragY}
            sharedDragVisible={sharedDragVisible}
            onDragStart={setDraggedTile}
            onDragEnd={() => setDraggedTile(null)}
          />
        </View>

        <View style={styles.menuLayer} pointerEvents="box-none">
          <HamburgerMenu options={menuOptions} />
        </View>

        <View style={styles.devResetLayer} pointerEvents="box-none">
          <Pressable
            onPress={() => { devReset(); }}
            style={({ pressed }) => [styles.devResetBtn, pressed && styles.devResetBtnPressed]}
          >
            <Text style={styles.devResetText}>Nueva mano</Text>
          </Pressable>
        </View>
      </View>

      <DragLayer
        tile={draggedTile}
        size={HAND_TILE_SIZE}
        sharedDragX={sharedDragX}
        sharedDragY={sharedDragY}
        sharedDragVisible={sharedDragVisible}
      />
    </GameTable>
  );
}

const styles = StyleSheet.create({
  seatsLayer: { ...StyleSheet.absoluteFillObject },
  seat: { position: 'absolute' },
  // Avatares con su centro sobre el borde del óvalo (mesa = 88% × 72% pantalla).
  north:     { top: '14%',    left: 0, right: 0, alignItems: 'center',     marginTop: -40 },
  southInfo: { bottom: '14%', left: 0, right: 0, alignItems: 'center',     marginBottom: -40 },
  east:      { right: '6%',   top: 0, bottom: 0, justifyContent: 'center', marginRight: -40 },
  west:      { left: '6%',    top: 0, bottom: 0, justifyContent: 'center', marginLeft: -40 },
  // Hand sits ABOVE the south player box. Bottom 14% (oval edge) + ~80px (avatar) + gap.
  handLayer: { position: 'absolute', left: 0, right: 0, bottom: '16%', alignItems: 'center' },
  menuLayer: { position: 'absolute', top: 16, left: 16 },
  devResetLayer: { position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' },
  devResetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#7a2d2d',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c9a961',
  },
  devResetBtnPressed: { opacity: 0.6 },
  devResetText: { color: '#ffd966', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
});
