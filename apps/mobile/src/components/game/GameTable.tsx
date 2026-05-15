import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Pure RN oval table — nested Views with very high borderRadius draw the rings.
// Replaces the previous Skia version to keep SDK 51 compatible.
export function GameTable({ children }: { children: React.ReactNode }) {
  // Oval shape: wider than tall (horizontal ellipse in landscape).
  const tableWidth = W * 0.88;
  const tableHeight = H * 0.72;
  // Rectangular table with rounded corners (was: oval).
  const RADIUS = 28;

  return (
    <View style={styles.container}>
      {/* Mesa (background) — el óvalo dibujado con Views anidadas, NO contiene children */}
      <View pointerEvents="none" style={styles.tableLayer}>
        <View
          style={[
            styles.outerShell,
            { width: tableWidth, height: tableHeight, borderRadius: RADIUS },
          ]}
        >
          <View style={[styles.goldRing, { borderRadius: RADIUS }]}>
            <View style={[styles.felt, { borderRadius: RADIUS }]}>
              <View style={[styles.innerRing, { borderRadius: RADIUS }]} />
            </View>
          </View>
        </View>
      </View>
      {/* Children flotan sobre TODA la pantalla, no dentro de la mesa */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  tableLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { ...StyleSheet.absoluteFillObject },
  outerShell: {
    backgroundColor: '#1a1a1a',
    padding: 6,
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  goldRing: {
    flex: 1, borderWidth: 1.5, borderColor: '#c9a961',
    padding: 22, backgroundColor: 'transparent',
  },
  felt: {
    flex: 1, backgroundColor: '#0d5a3a', padding: 20,
  },
  innerRing: {
    flex: 1, borderWidth: 1, borderColor: '#0a4a30',
  },
});
