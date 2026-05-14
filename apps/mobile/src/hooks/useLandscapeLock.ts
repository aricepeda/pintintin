import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

export function useLandscapeLock() {
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT);
    };
  }, []);
}
