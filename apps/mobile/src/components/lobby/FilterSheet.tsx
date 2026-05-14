import { Modal, View, Text, Pressable } from "react-native";

export type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: FilterOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

export function FilterSheet<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: Props<T>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/70 justify-end"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-neutral-900 rounded-t-3xl border-t border-neutral-800 pb-8 pt-3 px-2"
        >
          <View className="w-12 h-1.5 bg-neutral-700 rounded-full self-center mb-4" />
          <Text className="text-white text-lg font-bold px-4 mb-3">{title}</Text>

          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                className={`flex-row items-center justify-between px-4 py-3.5 mx-2 rounded-xl ${
                  selected ? "bg-yellow-500/10" : "active:bg-neutral-800"
                }`}
              >
                <Text
                  className={`text-base ${
                    selected ? "text-yellow-400 font-bold" : "text-white"
                  }`}
                >
                  {opt.label}
                </Text>
                {selected && (
                  <Text className="text-yellow-400 text-lg">✓</Text>
                )}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
