import { View, Text, Image, Pressable } from "react-native";

type Props = {
  avatarUri?: string;
  username: string;
  level: number;
  balance: number;
};

export function LobbyHeader({ avatarUri, username, level, balance }: Props) {
  return (
    <View className="flex-row items-center justify-between px-5 py-4 bg-neutral-900 border-b border-neutral-800">
      <View className="flex-row items-center gap-3">
        <View className="w-12 h-12 rounded-full bg-neutral-800 border-2 border-yellow-500 overflow-hidden items-center justify-center">
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} className="w-full h-full" />
          ) : (
            <Text className="text-yellow-500 font-bold text-lg">
              {username.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View>
          <Text className="text-white font-semibold text-base">{username}</Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <View className="px-1.5 py-0.5 rounded bg-yellow-500/20">
              <Text className="text-yellow-400 text-[10px] font-bold tracking-wide">
                LVL {level}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable className="flex-row items-center gap-2 px-4 py-2 rounded-full bg-neutral-800 border border-neutral-700">
        <View className="w-2 h-2 rounded-full bg-emerald-400" />
        <Text className="text-emerald-300 font-bold text-sm">
          ${balance.toLocaleString()}
        </Text>
      </Pressable>
    </View>
  );
}
