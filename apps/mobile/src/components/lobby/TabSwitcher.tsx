import { View, Text, Pressable } from "react-native";

export type LobbyTab = "CASH" | "TORNEOS";

type Props = {
  active: LobbyTab;
  onChange: (tab: LobbyTab) => void;
};

const TABS: LobbyTab[] = ["CASH", "TORNEOS"];

export function TabSwitcher({ active, onChange }: Props) {
  return (
    <View className="flex-row mx-5 mt-4 p-1 rounded-xl bg-neutral-900 border border-neutral-800">
      {TABS.map((tab) => {
        const isActive = active === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            className={`flex-1 py-3 rounded-lg items-center ${
              isActive ? "bg-yellow-500" : "bg-transparent"
            }`}
          >
            <Text
              className={`font-bold tracking-wider text-sm ${
                isActive ? "text-neutral-900" : "text-neutral-400"
              }`}
            >
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
