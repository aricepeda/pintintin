import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import {
  Canvas,
  Oval,
  Path,
  Skia,
  LinearGradient,
  vec,
  Shadow,
} from '@shopify/react-native-skia';

const { width: W, height: H } = Dimensions.get('window');

export function GameTable({ children }: { children: React.ReactNode }) {
  const tableWidth = W * 0.78;
  const tableHeight = H * 0.78;
  const cx = W / 2;
  const cy = H / 2;

  const borderThickness = 28;

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Oval
          x={cx - tableWidth / 2}
          y={cy - tableHeight / 2}
          width={tableWidth}
          height={tableHeight}
          color="#1a1a1a"
        >
          <Shadow dx={0} dy={8} blur={20} color="rgba(0,0,0,0.6)" />
        </Oval>

        <Oval
          x={cx - tableWidth / 2 + 6}
          y={cy - tableHeight / 2 + 6}
          width={tableWidth - 12}
          height={tableHeight - 12}
          color="#c9a961"
          style="stroke"
          strokeWidth={1.5}
        />

        <Oval
          x={cx - tableWidth / 2 + borderThickness}
          y={cy - tableHeight / 2 + borderThickness}
          width={tableWidth - borderThickness * 2}
          height={tableHeight - borderThickness * 2}
        >
          <LinearGradient
            start={vec(cx, cy - tableHeight / 2)}
            end={vec(cx, cy + tableHeight / 2)}
            colors={['#0f6d44', '#0a4d2e', '#0f6d44']}
          />
        </Oval>

        <Oval
          x={cx - tableWidth / 2 + borderThickness + 20}
          y={cy - tableHeight / 2 + borderThickness + 20}
          width={tableWidth - (borderThickness + 20) * 2}
          height={tableHeight - (borderThickness + 20) * 2}
          color="#0a4a30"
          style="stroke"
          strokeWidth={1}
        />
      </Canvas>

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { flex: 1, zIndex: 1 },
});
