import { View, Text, Pressable } from "react-native";
import type { TournamentTemplate } from "@pintintin/protocol";

const STATUS_MAP: Record<TournamentTemplate["status"], { label: string; dot: string; text: string }> = {
  registering: { label: "Inscripciones", dot: "bg-emerald-400", text: "text-emerald-300" },
  starting:    { label: "Comenzando",    dot: "bg-yellow-400",  text: "text-yellow-300" },
  running:     { label: "En curso",      dot: "bg-blue-400",    text: "text-blue-300" },
  ended:       { label: "Finalizado",    dot: "bg-neutral-500", text: "text-neutral-400" },
};

function formatStartsIn(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return "Ahora";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

type Props = {
  tournament: TournamentTemplate;
  onRegister?: (id: string) => void;
};

export function TournamentCard({ tournament, onRegister }: Props) {
  const status = STATUS_MAP[tournament.status];
  const canRegister = tournament.status === "registering";

  return (
    <View className="mx-5 mb-3 p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-lg shadow-black/50">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {tournament.name}
          </Text>

          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-yellow-400 font-semibold text-sm">
              {tournament.buyIn === 0 ? "GRATIS" : `$${tournament.buyIn}`}
            </Text>
            <Text className="text-neutral-600 text-sm">•</Text>
            <Text className="text-emerald-300 font-semibold text-sm">
              ${tournament.prizePool.toLocaleString()}
            </Text>
          </View>

          <View className="flex-row items-center gap-3 mt-2">
            <View className="flex-row items-center gap-1.5">
              <View className={`w-2 h-2 rounded-full ${status.dot}`} />
              <Text className={`text-[11px] font-semibold ${status.text}`}>{status.label}</Text>
            </View>
            <Text className="text-neutral-500 text-[11px]">
              {tournament.playersRegistered}/{tournament.maxPlayers}
            </Text>
            <Text className="text-neutral-500 text-[11px]">
              · empieza en {formatStartsIn(tournament.startsAt)}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => canRegister && onRegister?.(tournament.id)}
          disabled={!canRegister}
          className={`px-4 py-2.5 rounded-lg ${
            canRegister ? "bg-yellow-500 active:bg-yellow-600" : "bg-neutral-800"
          }`}
        >
          <Text
            className={`font-extrabold tracking-wider text-xs ${
              canRegister ? "text-neutral-900" : "text-neutral-500"
            }`}
          >
            {canRegister ? "INSCRIBIRSE" : "CERRADO"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
