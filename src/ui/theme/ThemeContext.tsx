import { createContext, useContext } from 'react';
import type { ResolvedFrameTheme } from './defaults';

export const ThemeContext = createContext<ResolvedFrameTheme | null>(null);

export function useFrameTheme(): ResolvedFrameTheme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(
      'useFrameTheme: no theme found in context. Wrap your app in <FrameProvider /> at the root.',
    );
  }
  return theme;
}
