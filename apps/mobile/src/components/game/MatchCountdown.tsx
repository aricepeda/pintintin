import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  deadline: number | null;
}

// Pre-match countdown overlay. Re-renders the seconds left every 250ms.
export function MatchCountdown({ deadline }: Props) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) setSecondsLeft(null);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  if (secondsLeft === null) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Text style={styles.label}>Inicia en</Text>
      <Text style={styles.num} key={secondsLeft}>{secondsLeft}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 4900,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  label: {
    color: '#bfe5c8', fontSize: 16, fontWeight: '700', letterSpacing: 2,
    marginBottom: 8,
    textShadowColor: '#000', textShadowOffset: { width: 1, height: 2 }, textShadowRadius: 4,
  },
  num: {
    color: '#f2c14e', fontSize: 120, fontWeight: '900',
    textShadowColor: '#000', textShadowOffset: { width: 2, height: 4 }, textShadowRadius: 10,
  },
});
