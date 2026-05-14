import { Modal, View, Text, Pressable } from "react-native";
import { FilterOption } from "./FilterSheet";

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: FilterOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
  onClose: () => void;
  allLabel?: string;
};

export function MultiFilterSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
  allLabel = "Todos",
}: Props<T>) {
  const toggle = (v: T) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  const isAll = value.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/70 justify-end">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-neutral-900 rounded-t-3xl border-t border-neutral-800 pb-8 pt-3 px-2"
        >
          <View className="w-12 h-1.5 bg-neutral-700 rounded-full self-center mb-4" />

          <View className="flex-row items-center justify-between px-4 mb-3">
            <Text className="text-white text-lg font-bold">{title}</Text>
            <Pressable onPress={onClose}>
              <Text className="text-yellow-400 font-bold text-sm">Listo</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => onChange([])}
            className={`flex-row items-center justify-between px-4 py-3.5 mx-2 rounded-xl ${
              isAll ? "bg-yellow-500/10" : "active:bg-neutral-800"
            }`}
          >
            <Text
              className={`text-base ${
                isAll ? "text-yellow-400 font-bold" : "text-white"
              }`}
            >
              {allLabel}
            </Text>
            {isAll && <Text className="text-yellow-400 text-lg">✓</Text>}
          </Pressable>

          {options.map((opt) => {
            const selected = value.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                onPress={() => toggle(opt.value)}
                className="flex-row items-center justify-between px-4 py-3.5 mx-2 rounded-xl active:bg-neutral-800"
              >
                <Text
                  className={`text-base ${
                    selected ? "text-yellow-400 font-bold" : "text-white"
                  }`}
                >
                  {opt.label}
                </Text>
                <View
                  className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
                    selected
                      ? "bg-yellow-500 border-yellow-500"
                      : "border-neutral-600"
                  }`}
                >
                  {selected && (
                    <Text className="text-neutral-900 font-extrabold text-xs">✓</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
