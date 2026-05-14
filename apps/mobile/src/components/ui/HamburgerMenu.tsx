import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { haptics } from '../../haptics';

export interface MenuOption {
  key: string;
  label: string;
  icon?: string;
  onPress: () => void;
  destructive?: boolean;
}

interface HamburgerMenuProps {
  options: MenuOption[];
}

export function HamburgerMenu({ options }: HamburgerMenuProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        style={styles.button}
        hitSlop={12}
      >
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.panel} onStartShouldSetResponder={() => true}>
            {options.map((opt) => (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                onPress={() => {
                  haptics.light();
                  close();
                  opt.onPress();
                }}
              >
                {opt.icon && <Text style={styles.icon}>{opt.icon}</Text>}
                <Text style={[styles.label, opt.destructive && styles.destructive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderWidth: 1,
    borderColor: '#c9a961',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 18,
    height: 2,
    backgroundColor: '#e8b85c',
    borderRadius: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute',
    top: 70,
    left: 16,
    minWidth: 220,
    backgroundColor: '#0a0a0a',
    borderColor: '#c9a961',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  optionPressed: {
    backgroundColor: '#1a1a1a',
  },
  icon: {
    fontSize: 18,
    width: 22,
    textAlign: 'center',
  },
  label: {
    color: '#f5f5f5',
    fontSize: 15,
    fontWeight: '500',
  },
  destructive: {
    color: '#ef4444',
  },
});
