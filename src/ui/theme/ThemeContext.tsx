import { createContext, useContext } from 'react';
import type { ResolvedFrameTheme } from './defaults';

export const ThemeContext = createContext<ResolvedFrameTheme | null>(null);

/**
 * Returns the resolved Frame theme from the nearest {@link FrameProvider}.
 * Throws if called outside of a `<FrameProvider>` tree.
 *
 * @returns The fully resolved {@link ResolvedFrameTheme} for the current color scheme.
 * @throws {Error} When no `<FrameProvider>` is found in the component tree.
 *
 * @example
 * ```tsx
 * function MyButton() {
 *   const theme = useFrameTheme();
 *   return (
 *     <Pressable style={{ backgroundColor: theme.colors.primaryButton }}>
 *       <Text style={{ color: theme.colors.primaryButtonText }}>Pay</Text>
 *     </Pressable>
 *   );
 * }
 * ```
 */
export function useFrameTheme(): ResolvedFrameTheme {
  const theme = useContext(ThemeContext);
  if (theme === null) {
    throw new Error(
      'useFrameTheme: no theme found in context. Wrap your app in <FrameProvider /> at the root.',
    );
  }
  return theme;
}
