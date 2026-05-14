import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import type { RoomWaitingPayload, SeatSummary } from "@pintintin/protocol";
import { confirmLeaveRoom } from "../net/leaveRoom";
import { sitAtSeat } from "../net/sitAtSeat";
import { useGameStore } from "../store/game";

type Props = {
  waiting: RoomWaitingPayload;
};

function useCountdownSeconds(deadline: number | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : null
  );
  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const r = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(r);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);
  return remaining;
}

function SeatCircle({
  seat,
  selfSeat,
  onClaim,
}: {
  seat: SeatSummary;
  selfSeat: number | null;
  onClaim: () => void;
}) {
  const isYou = selfSeat === seat.seat;
  if (seat.occupied) {
    return (
      <View
        className={`w-24 h-24 rounded-full items-center justify-center border-2 ${
          isYou ? "border-yellow-400 bg-yellow-500/20" : "border-emerald-500/60 bg-neutral-900"
        }`}
      >
        <View
          className={`w-16 h-16 rounded-full items-center justify-center ${
            isYou ? "bg-yellow-500/30" : "bg-emerald-500/20"
          }`}
        >
          <Text className={`font-extrabold text-2xl ${isYou ? "text-yellow-300" : "text-emerald-200"}`}>
            {(seat.displayName ?? "?").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="text-white text-xs font-semibold mt-1" numberOfLines={1}>
          {isYou ? "Tú" : seat.displayName ?? "Jugador"}
        </Text>
        {seat.connected === false && (
          <Text className="text-orange-400 text-[10px] font-bold">DESC.</Text>
        )}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onClaim}
      className="w-24 h-24 rounded-full items-center justify-center border-2 border-dashed border-neutral-600 bg-neutral-900/40 active:border-yellow-400 active:bg-yellow-500/10"
    >
      <Text className="text-neutral-500 text-3xl">+</Text>
      <Text className="text-neutral-400 text-[11px] font-bold tracking-wide mt-1">OPEN SEAT</Text>
    </Pressable>
  );
}

export function WaitingRoom({ waiting }: Props) {
  const matchCountdownDeadline = useGameStore((s) => s.matchCountdownDeadline);
  const remaining = useCountdownSeconds(matchCountdownDeadline);
  const countdownActive = remaining !== null && remaining > 0;
  const isObserver = waiting.yourSeat === null;
  const [claiming, setClaiming] = useState<number | null>(null);

  const handleClaim = async (seatNum: 0 | 1 | 2 | 3) => {
    if (claiming !== null) return;
    setClaiming(seatNum);
    const res = await sitAtSeat(seatNum);
    setClaiming(null);
    if (!res.ok) {
      console.warn("[sit] failed:", res.error);
    }
  };

  return (
    <View className="flex-1 bg-emerald-950 items-center justify-center px-6">
      <View className="absolute top-12 left-5 z-10">
        <Pressable onPress={confirmLeaveRoom} hitSlop={12}>
          <Text className="text-yellow-400 text-base font-bold">← Salir</Text>
        </Pressable>
      </View>

      <Text className="text-yellow-400 text-xs font-bold tracking-widest mb-1">
        {waiting.tableName.toUpperCase()}
      </Text>
      <Text className="text-emerald-300 font-semibold text-sm mb-6">
        ${waiting.stake} por mano
      </Text>

      {countdownActive ? (
        <View className="items-center justify-center my-12">
          <Text className="text-yellow-400 text-sm font-bold tracking-widest mb-3">
            LA PARTIDA EMPIEZA EN
          </Text>
          <View className="w-40 h-40 rounded-full bg-yellow-500 items-center justify-center shadow-2xl shadow-yellow-500/50">
            <Text className="text-emerald-950 text-8xl font-extrabold">
              {remaining}
            </Text>
          </View>
          <Text className="text-emerald-200 text-base font-semibold mt-6">
            Preparando las fichas...
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-row flex-wrap items-center justify-center gap-6 my-6 max-w-md">
            {waiting.seats.map((s) => (
              <SeatCircle
                key={s.seat}
                seat={s}
                selfSeat={waiting.yourSeat}
                onClaim={() => handleClaim(s.seat as 0 | 1 | 2 | 3)}
              />
            ))}
          </View>

          <View className="items-center gap-2 mt-4">
            {isObserver ? (
              <>
                <Text className="text-yellow-300 text-base font-bold">
                  Toca un asiento libre para sentarte
                </Text>
                {claiming !== null && (
                  <View className="flex-row items-center gap-2 mt-1">
                    <ActivityIndicator color="#f2c14e" size="small" />
                    <Text className="text-neutral-400 text-xs">Sentándose...</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-3">
                  <ActivityIndicator color="#f2c14e" />
                  <Text className="text-neutral-300 text-base">
                    Esperando jugadores ({waiting.seats.filter((s) => s.occupied).length}/{waiting.seats.length})
                  </Text>
                </View>
                <Text className="text-neutral-500 text-xs">
                  La partida inicia cuando haya 2 o más jugadores
                </Text>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );
}
