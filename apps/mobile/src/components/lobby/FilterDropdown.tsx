import { View, Text, Pressable } from "react-native";

type Props = {
  label: string;
  value: string;
  onPress?: () => void;
};

export function FilterDropdown({ label, value, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 active:border-yellow-500/50"
    >
      <Text className="text-neutral-500 text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </Text>
      <View className="flex-row items-center justify-between mt-0.5">
        <Text className="text-white text-sm font-semibold" numberOfLines={1}>
          {value}
        </Text>
        <Text className="text-neutral-500 text-xs ml-2">▾</Text>
      </View>
    </Pressable>
  );
}
