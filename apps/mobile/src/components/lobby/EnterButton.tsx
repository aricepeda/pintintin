import { Pressable, Text } from "react-native";

export function EnterButton({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="px-5 py-2.5 rounded-lg bg-emerald-500 active:bg-emerald-600 shadow-lg shadow-emerald-500/30"
    >
      <Text className="text-neutral-900 font-extrabold tracking-wider text-sm">
        ENTRAR
      </Text>
    </Pressable>
  );
}
