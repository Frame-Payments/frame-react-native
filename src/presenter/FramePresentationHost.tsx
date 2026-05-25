import { useEffect, useState } from 'react';
import { Modal, Platform } from 'react-native';
import {
  subscribe,
  setHostMounted,
  requestActiveCancel,
  type ActivePresentation,
} from './presenter';
import { ToastHost } from '../ui/primitives/Toast';

// Subscribes to the presenter singleton and renders whichever screen is
// currently active inside an RN <Modal>. Mounted exactly once by FrameProvider.

export function FramePresentationHost() {
  const [active, setActive] = useState<ActivePresentation | null>(null);

  useEffect(() => {
    setHostMounted(true);
    const unsubscribe = subscribe(setActive);
    return () => {
      unsubscribe();
      setHostMounted(false);
    };
  }, []);

  return (
    <Modal
      visible={active !== null}
      animationType="slide"
      transparent={false}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      // Fires on Android hardware back. On iOS pageSheet, swipe-down also
      // surfaces here in RN 0.81+. Either path: settle the in-flight promise
      // with USER_CANCELED so JS state stays in sync with what the user sees.
      onRequestClose={() => {
        requestActiveCancel();
      }}
    >
      {active?.element ?? null}
      {/* Toasts must render INSIDE the modal — on iOS pageSheet the modal is a
          separate native window, so a ToastHost mounted outside it would be
          invisible while onboarding/checkout is up. */}
      <ToastHost />
    </Modal>
  );
}
