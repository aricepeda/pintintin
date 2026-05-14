import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { GameTable } from '../components/game/GameTable';
import { PlayerSeat, type PlayerSeatProps } from '../components/game/PlayerSeat';
import { Board } from '../components/game/Board';
import { PlayerHand } from '../components/game/PlayerHand';
import { HamburgerMenu, type MenuOption } from '../components/ui/HamburgerMenu';
import { useLandscapeLock } from '../hooks/useLandscapeLock';
import { confirmLeaveRoom } from '../net/leaveRoom';
import { useGameStore } from '../store/game';
import type { Seat } from '@pintintin/game-core';

type SeatPosition = 'south' | 'west' | 'north' | 'east';

const POSITION_ORDER: SeatPosition[] = ['south', 'west', 'north', 'east'];

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
  rating: 1200,
  money: 5000,
});

export function GameScreen() {
  useLandscapeLock();
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  const yourSeat = useGameStore((s) => s.yourSeat);
  const yourHand = useGameStore((s) => s.yourHand);
  const publicState = useGameStore((s) => s.publicState);
  const waiting = useGameStore((s) => s.waiting);
  const turnDeadline = useGameStore((s) => s.turnDeadline);

  const effectiveYourSeat: Seat = yourSeat ?? 0;
  const seatToPos = mapSeatsToPositions(effectiveYourSeat);
  const activeSeat = publicState?.currentSeat ?? null;

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

  const seatProps = (seat: Seat): PlayerSeatProps => {
    const isYou = seat === effectiveYourSeat;
    const isActive = activeSeat === seat;
    return {
      ...placeholder(seatName(seat)),
      isCurrentUser: isYou,
      isActive,
      turnDeadline: isActive ? turnDeadline : null,
    };
  };

  const board = publicState?.board ?? [];

  const menuOptions: MenuOption[] = [
    { key: 'sound', label: 'Sonido', icon: '🔊', onPress: () => {} },
    { key: 'chat', label: 'Chat', icon: '💬', onPress: () => {} },
    { key: 'settings', label: 'Ajustes', icon: '⚙️', onPress: () => {} },
    { key: 'leave', label: 'Salir', icon: '🚪', onPress: confirmLeaveRoom, destructive: true },
  ];

  return (
    <GameTable>
      <Board tiles={board} />

      <View style={styles.seatsLayer} pointerEvents="box-none">
        <View style={[styles.seat, styles.north]}>
          <PlayerSeat {...seatProps(positionToSeat('north'))} />
        </View>
        <View style={[styles.seat, styles.east]}>
          <PlayerSeat {...seatProps(positionToSeat('east'))} />
        </View>
        <View style={[styles.seat, styles.west]}>
          <PlayerSeat {...seatProps(positionToSeat('west'))} />
        </View>

        <View style={[styles.seat, styles.southInfo]}>
          <PlayerSeat {...seatProps(positionToSeat('south'))} />
        </View>

        <View style={styles.handLayer} pointerEvents="box-none">
          <PlayerHand
            tiles={yourHand}
            selectedTileId={selectedTileId}
            onSelect={(t) => setSelectedTileId((cur) => (cur === t.id ? null : t.id))}
            disabled={activeSeat !== effectiveYourSeat}
          />
        </View>

        <View style={styles.menuLayer} pointerEvents="box-none">
          <HamburgerMenu options={menuOptions} />
        </View>
      </View>
    </GameTable>
  );
}

const styles = StyleSheet.create({
  seatsLayer: { ...StyleSheet.absoluteFillObject },
  seat: { position: 'absolute' },
  // Avatares con su centro sobre el borde del óvalo (mesa = 88% × 72% pantalla).
  // marginTop/Bottom/Left/Right -40 centra el avatar (~80px) sobre el borde.
  north:     { top: '14%',    left: 0, right: 0, alignItems: 'center',      marginTop: -40 },
  southInfo: { bottom: '14%', left: 0, right: 0, alignItems: 'center',      marginBottom: -40 },
  east:      { right: '6%',   top: 0, bottom: 0, justifyContent: 'center',  marginRight: -40 },
  west:      { left: '6%',    top: 0, bottom: 0, justifyContent: 'center',  marginLeft: -40 },
  // Mano debajo del seat sur, alineada al fondo.
  handLayer: { position: 'absolute', left: 0, right: 0, bottom: 12, alignItems: 'center' },
  menuLayer: { position: 'absolute', top: 16, left: 16 },
});
