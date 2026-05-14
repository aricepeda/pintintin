import { View, Text } from "react-native";

export type TableStatus = "open" | "playing" | "full";

const STATUS_MAP: Record<TableStatus, { label: string; dot: string; text: string }> = {
  open: { label: "Abierta", dot: "bg-emerald-400", text: "text-emerald-300" },
  playing: { label: "En juego", dot: "bg-yellow-400", text: "text-yellow-300" },
  full: { label: "Llena", dot: "bg-red-500", text: "text-red-400" },
};

export function StatusIndicator({ status }: { status: TableStatus }) {
  const s = STATUS_MAP[status];
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`w-2 h-2 rounded-full ${s.dot}`} />
      <Text className={`text-[11px] font-semibold ${s.text}`}>{s.label}</Text>
    </View>
  );
}
