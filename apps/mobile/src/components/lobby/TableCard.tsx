import { View, Text } from "react-native";
import { StatusIndicator } from "./StatusIndicator";
import { EnterButton } from "./EnterButton";
import type { CashTableTemplate } from "@pintintin/protocol";

type Props = {
  table: CashTableTemplate;
  onEnter?: (id: string) => void;
};

export function TableCard({ table, onEnter }: Props) {
  return (
    <View className="mx-5 mb-3 p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-lg shadow-black/50">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-white font-bold text-base" numberOfLines={1}>
            {table.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-1">
            <Text className="text-yellow-400 font-semibold text-sm">
              ${table.smallBlind} / ${table.bigBlind}
            </Text>
            <Text className="text-neutral-600 text-sm">•</Text>
            <Text className="text-neutral-400 text-sm">
              {table.players}/{table.playerCount} jugadores
            </Text>
          </View>
          <View className="mt-2">
            <StatusIndicator status={table.status} />
          </View>
        </View>

        <EnterButton onPress={() => onEnter?.(table.id)} />
      </View>
    </View>
  );
}
