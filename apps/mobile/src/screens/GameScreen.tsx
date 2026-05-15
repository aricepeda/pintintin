import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { GameTable } from '../components/game/GameTable';
import { PlayerSeat, type PlayerSeatProps } from '../components/game/PlayerSeat';
import { Board, type SeatScreenPosition } from '../components/game/Board';
import { DraggableHand } from '../components/game/DraggableHand';
import { DragLayer } from '../components/game/DragLayer';
import { DropGhost, type GhostSpec } from '../components/game/DropGhost';
import { HamburgerMenu, type MenuOption } from '../components/ui/HamburgerMenu';
import { MatchCountdown } from '../components/game/MatchCountdown';
import { ShuffleAndDeal } from '../components/game/ShuffleAndDeal';
import { useLandscapeLock } from '../hooks/useLandscapeLock';
import { confirmLeaveRoom } from '../net/leaveRoom';
import { playTile } from '../net/playTile';
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
  useLandscapeLock();

  const yourSeat = useGameStore((s) => s.yourSeat);
  const yourHand = useGameStore((s) => s.yourHand);
  const publicState = useGameStore((s) => s.publicState);
  const waiting = useGameStore((s) => s.waiting);
  const turnDeadline = useGameStore((s) => s.turnDeadline);
  const matchCountdownDeadline = useGameStore((s) => s.matchCountdownDeadline);
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
      turnDeadline: null, // timer disabled
      handCount: dealing ? null : publicState?.handCounts?.[seat] ?? null,
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

  // Trigger shuffle+deal once per round, when the dealt hand arrives.
  // (The pre-match countdown is followed almost immediately by game:dealt.)
  const [dealing, setDealing] = useState(false);
  const [revealedYou, setRevealedYou] = useState(0);
  const lastRoundDealtRef = useRef<number | null>(null);
  useEffect(() => {
    const round = publicState?.roundNo ?? null;
    const boardLen = publicState?.board?.length ?? 0;
    if (round !== null && boardLen === 0 && yourHand.length > 0 && lastRoundDealtRef.current !== round) {
      lastRoundDealtRef.current = round;
      setRevealedYou(0);
      setDealing(true);
    }
  }, [publicState?.roundNo, publicState?.board?.length, yourHand.length]);

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
      // chainBounds.top/bottom are already window-absolute (Board uses measureInWindow).
      if (canLeft) {
        out.push({
          end: 'left',
          x,
          y: chainBounds.top - GHOST_GAP - ghostH,
          orientation,
          flipped: leftFlipped,
        });
      }
      if (canRight) {
        out.push({
          end: 'right',
          x,
          y: chainBounds.bottom + GHOST_GAP,
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

        <View style={styles.handLayer} pointerEvents="box-none">
          <DraggableHand
            tiles={dealing ? yourHand.slice(0, revealedYou) : yourHand}
            leftEnd={leftEnd}
            rightEnd={rightEnd}
            disabled={!isYourTurn || dealing}
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

      {dealing && (
        <ShuffleAndDeal
          countsBySide={{
            bottom: yourHand.length,
            top: publicState?.handCounts?.[positionToSeat('north')] ?? 0,
          }}
          dealOrder={['bottom', 'top']}
          yourSide="bottom"
          onYourTileTick={() => setRevealedYou((n) => n + 1)}
          onDone={() => setDealing(false)}
        />
      )}
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
});
