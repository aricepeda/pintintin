import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface TurnTimerProps {
  deadline: number;
  size?: number;
}

export function TurnTimer({ deadline, size = 28 }: TurnTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, deadline - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const urgent = remainingMs < 5000;

  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size / 2 },
        urgent && styles.urgent,
      ]}
    >
      <Text style={[styles.text, urgent && styles.textUrgent]}>{seconds}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: 'rgba(10,10,10,0.9)',
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgent: {
    borderColor: '#ef4444',
  },
  text: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '700',
  },
  textUrgent: {
    color: '#ef4444',
  },
});
