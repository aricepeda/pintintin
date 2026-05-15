import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

export function usePortraitLock() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
    };
  }, []);
}
