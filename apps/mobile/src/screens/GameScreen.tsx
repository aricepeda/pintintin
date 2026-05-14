import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { GameTable } from '../components/game/GameTable';
import { PlayerSeat, type PlayerSeatProps } from '../components/game/PlayerSeat';
import { Board, type SeatScreenPosition } from '../components/game/Board';
import { DraggableHand } from '../components/game/DraggableHand';
import { DragLayer } from '../components/game/DragLayer';
import { DropGhost, type GhostSpec } from '../components/game/DropGhost';
import { HamburgerMenu, type MenuOption } from '../components/ui/HamburgerMenu';
import { MatchCountdown } from '../components/game/MatchCountdown';
import { useLandscapeLock } from '../hooks/useLandscapeLock';
import { confirmLeaveRoom } from '../net/leaveRoom';
import { playTile, passTurn } from '../net/playTile';
import { useGameStore } from '../store/game';
import {
  canPlayTile,
  handHasAnyLegalMove,
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

function mapSeatsToPositions(yourSeat: Seat): Record<Seat, SeatPosition> {
  const map = {} as Record<Seat, SeatPosition>;
  for (let i = 0; i < 4; i++) {
    const seat = ((yourSeat + i) % 4) as Seat;
    map[seat] = POSITION_ORDER[i]!;
  }
  return map;
}

const placeholder = (name: string): PlayerSeatProps => ({
  name,
  money: 5000,
});

const HAND_TILE_SIZE = 44;
const GHOST_GAP = 6;

export function GameScreen() {
  useLandscapeLock();

  const yourSeat = useGameStore((s) => s.yourSeat);
  const yourHand = useGameStore((s) => s.yourHand);
  const publicState = useGameStore((s) => s.publicState);
  const waiting = useGameStore((s) => s.waiting);
  const turnDeadline = useGameStore((s) => s.turnDeadline);
  const matchCountdownDeadline = useGameStore((s) => s.matchCountdownDeadline);

  const effectiveYourSeat: Seat = yourSeat ?? 0;
  const seatToPos = mapSeatsToPositions(effectiveYourSeat);
  const activeSeat = publicState?.currentSeat ?? null;
  const playerCount =
    publicState?.activeSeats?.length ?? waiting?.playerCount ?? 4;
  const isHeadsUp = playerCount === 2;

  const positionToSeat = (pos: SeatPosition): Seat => {
    const offset = POSITION_ORDER.indexOf(pos);
    return ((effectiveYourSeat + offset) % 4) as Seat;
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
    east: 'left',
    west: 'right',
  } as const;

  const seatProps = (seat: Seat): PlayerSeatProps => {
    const isYou = seat === effectiveYourSeat;
    const isActive = activeSeat === seat;
    const pos = seatToPos[seat];
    return {
      ...placeholder(seatName(seat)),
      isCurrentUser: isYou,
      isActive,
      turnDeadline: isActive ? turnDeadline : null,
      handCount: publicState?.handCounts?.[seat] ?? null,
      layout: POSITION_TO_LAYOUT[pos],
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

  const noLegalMoves =
    isYourTurn && yourHand.length > 0 && !handHasAnyLegalMove(yourHand, leftEnd, rightEnd);

  const sharedDragX = useSharedValue(0);
  const sharedDragY = useSharedValue(0);
  const sharedDragVisible = useSharedValue(0);
  const [draggedTile, setDraggedTile] = useState<Tile | null>(null);

  const [boardRect, setBoardRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const onBoardLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setBoardRect({ x, y, w: width, h: height });
  };

  // Chain bounds (top/bottom y, relative to the Board container).
  const [chainBounds, setChainBounds] = useState<{ top: number; bottom: number } | null>(null);
  const [boardTileSize, setBoardTileSize] = useState(28);
  const handleChainBounds = useCallback(
    (top: number, bottom: number) => setChainBounds({ top, bottom }),
    [],
  );
  const handleTileSize = useCallback((s: number) => setBoardTileSize(s), []);

  const zones: DropZone[] = boardRect.w
    ? [
        { x: boardRect.x, y: boardRect.y, w: boardRect.w, h: boardRect.h / 2, end: 'left' },
        { x: boardRect.x, y: boardRect.y + boardRect.h / 2, w: boardRect.w, h: boardRect.h / 2, end: 'right' },
      ]
    : [];

  // Compute ghost positions adjacent to the chain endpoints.
  const ghosts: GhostSpec[] = (() => {
    if (!draggedTile || !boardRect.w) return [];
    const dbl = isDouble(draggedTile);
    const orientation: 'horizontal' | 'vertical' = dbl ? 'horizontal' : 'vertical';
    const ghostH = dbl ? boardTileSize : boardTileSize * 2;
    const ghostW = dbl ? boardTileSize * 2 : boardTileSize;
    const xCenter = boardRect.x + boardRect.w / 2;
    const x = xCenter - ghostW / 2;
    const out: GhostSpec[] = [];
    const canLeft = canPlayTile(draggedTile, leftEnd, rightEnd, 'left');
    const canRight = canPlayTile(draggedTile, leftEnd, rightEnd, 'right');
    // Ghost facing: matching pip must touch the chain.
    // Left end (tile sits above chain): bottom pip = leftEnd → flip if tile.a matches.
    // Right end (tile sits below chain): top pip = rightEnd → flip if tile.b matches.
    const leftFlipped = !dbl && leftEnd !== null && draggedTile.a === leftEnd;
    const rightFlipped = !dbl && rightEnd !== null && draggedTile.b === rightEnd;
    // When board is empty, both ends are valid; show a single ghost at center.
    if (board.length === 0) {
      if (canLeft || canRight) {
        out.push({
          end: 'right',
          x,
          y: boardRect.y + boardRect.h / 2 - ghostH / 2,
          orientation,
          flipped: false,
        });
      }
      return out;
    }
    if (chainBounds) {
      if (canLeft) {
        out.push({
          end: 'left',
          x,
          y: boardRect.y + chainBounds.top - GHOST_GAP - ghostH,
          orientation,
          flipped: leftFlipped,
        });
      }
      if (canRight) {
        out.push({
          end: 'right',
          x,
          y: boardRect.y + chainBounds.bottom + GHOST_GAP,
          orientation,
          flipped: rightFlipped,
        });
      }
    }
    return out;
  })();

  const handleDrop = async (tile: Tile, end: End) => {
    const resp = await playTile(tile.id, end);
    if (!resp.ok) console.warn('[playTile] failed', resp.error);
  };

  const doPass = async () => {
    const resp = await passTurn();
    if (!resp.ok) console.warn('[passTurn] failed', resp.error);
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
          onChainBoundsChange={handleChainBounds}
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

        {noLegalMoves && (
          <View style={styles.passLayer} pointerEvents="box-none">
            <Pressable style={[styles.playBtn, styles.passBtn]} onPress={doPass}>
              <Text style={styles.playBtnText}>Pasar</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.handLayer} pointerEvents="box-none">
          <DraggableHand
            tiles={yourHand}
            leftEnd={leftEnd}
            rightEnd={rightEnd}
            disabled={!isYourTurn}
            zones={zones}
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
      </View>

      <DragLayer
        tile={draggedTile}
        size={HAND_TILE_SIZE}
        sharedDragX={sharedDragX}
        sharedDragY={sharedDragY}
        sharedDragVisible={sharedDragVisible}
      />

      <MatchCountdown deadline={matchCountdownDeadline} />
    </GameTable>
  );
}

const styles = StyleSheet.create({
  seatsLayer: { ...StyleSheet.absoluteFillObject },
  seat: { position: 'absolute' },
  north:     { top: '6%',  left: 0, right: 0, alignItems: 'center' },
  southInfo: { bottom: 8,  left: 0, right: 0, alignItems: 'center' },
  east:      { right: '3%', top: 0, bottom: 0, justifyContent: 'center' },
  west:      { left: '3%',  top: 0, bottom: 0, justifyContent: 'center' },
  handLayer: { position: 'absolute', left: 0, right: 0, bottom: 64, alignItems: 'center' },
  menuLayer: { position: 'absolute', top: 16, left: 16 },
  passLayer: {
    position: 'absolute',
    left: 0, right: 0, bottom: 200,
    alignItems: 'center',
  },
  playBtn: {
    backgroundColor: '#c9a961',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  passBtn: { backgroundColor: '#b54b4b' },
  playBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 14 },
});
