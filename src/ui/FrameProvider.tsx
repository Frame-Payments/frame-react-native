import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import type { FrameTheme } from '../types';
import { resolveTheme, type ColorScheme } from './theme/defaults';
import { ThemeContext } from './theme/ThemeContext';
import { FramePresentationHost } from '../presenter';

function readScheme(): ColorScheme {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export interface FrameProviderProps {
  /**
   * Optional theme override merged on top of the scheme defaults. Mirrors
   * iOS `.frameTheme(_:)` and Android `FrameTheme(theme = …)` — the consumer
   * owns the value, the Provider re-renders normally when it changes.
   */
  theme?: FrameTheme;
  children: ReactNode;
}

/**
 * Root context provider for the Frame React Native SDK. Mount this once at
 * the top of your component tree (wrapping your entire app or the subtree that
 * uses Frame UI) to supply the resolved theme and the modal presentation host
 * to all Frame components.
 *
 * Listens to `Appearance` changes and automatically switches between light and
 * dark scheme defaults when the device color scheme changes.
 *
 * @param props - {@link FrameProviderProps}
 *
 * @example
 * ```tsx
 * import { FrameProvider } from 'framepayments-react-native';
 *
 * export default function App() {
 *   return (
 *     <FrameProvider theme={{ colors: { primaryButton: '#1A2B3C' } }}>
 *       <YourApp />
 *     </FrameProvider>
 *   );
 * }
 * ```
 */
export function FrameProvider({ theme, children }: FrameProviderProps) {
  const [scheme, setScheme] = useState<ColorScheme>(readScheme);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => sub.remove();
  }, []);

  const resolved = useMemo(() => resolveTheme(scheme, theme), [scheme, theme]);

  return (
    <ThemeContext.Provider value={resolved}>
      {children}
      <FramePresentationHost />
    </ThemeContext.Provider>
  );
}
