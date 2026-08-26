import { useEffect } from 'react';
import { BootScreen } from './features/boot/BootScreen';
import { ErrorScreen } from './features/error/ErrorScreen';
import { MapSelectionScreen } from './features/map-selection/MapSelectionScreen';
import { PatrolScreen } from './features/patrol-3d/PatrolScreen';
import { ResultScreen } from './features/result/ResultScreen';
import { useAppStore } from './app/store/useAppStore';

export default function App() {
  const currentScreen = useAppStore((state) => state.currentScreen);
  const bootStatus = useAppStore((state) => state.bootStatus);
  const bootApp = useAppStore((state) => state.bootApp);

  useEffect(() => {
    if (bootStatus === 'idle') {
      void bootApp();
    }
  }, [bootApp, bootStatus]);

  if (currentScreen === 'loading') {
    return <BootScreen />;
  }

  if (currentScreen === 'map') {
    return <MapSelectionScreen />;
  }

  if (currentScreen === 'patrol') {
    return <PatrolScreen />;
  }

  if (currentScreen === 'result') {
    return <ResultScreen />;
  }

  return <ErrorScreen />;
}
