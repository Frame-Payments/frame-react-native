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
