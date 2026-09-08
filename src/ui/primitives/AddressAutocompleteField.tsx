import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { ValidatedTextField } from './ValidatedTextField';
import { useAddressAutocomplete } from './useAddressAutocomplete';
import type { AddressSuggestion } from '../../addressSearch';
import type { BillingAddress } from '../../types';

// An address line 1 field that offers suggestions as the user types. Ports
// iOS AddressAutocompleteField
// (`Sources/Frame/Views/Reusable/AddressAutocompleteField.swift`).
//
// The field is a plain ValidatedTextField, so typing an address by hand works
// exactly as it does without autocomplete.
//
// iOS draws the suggestion list in a SwiftUI `.overlay`, which escapes
// ancestor clipping unless an ancestor explicitly calls `.clipShape()`. RN
// gives an absolutely-positioned child no such guarantee: this field
// typically sits inside a rounded `overflow: 'hidden'` container AND a
// ScrollView, both of which clip a same-subtree absolute child to their own
// bounds — and a separate `Modal` isn't safe either, since presenting one can
// blur/dismiss the keyboard on the TextInput sitting outside it. So this
// component does NOT render its own dropdown. It reports the current
// suggestion list and the field's on-screen position to the caller via
// {@link AddressAutocompleteFieldProps.onOverlayChange}; the caller — which
// owns a render layer outside the ScrollView, e.g. CheckoutScreen's own root —
// draws the dropdown itself. See CheckoutScreen.tsx for the paired renderer.

export interface AddressAutocompleteFieldLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AddressAutocompleteOverlayState {
  suggestions: ReadonlyArray<AddressSuggestion>;
  layout: AddressAutocompleteFieldLayout | null;
  onSelect: (suggestion: AddressSuggestion) => void;
}

export interface AddressAutocompleteFieldProps {
  prompt: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string | null;
  onErrorChange?: (next: string | null) => void;
  /**
   * ISO 3166-1 alpha-2 code the suggestions are restricted to, so a form
   * locked to one country does not surface addresses from another.
   */
  countryCode: string | undefined;
  /** When true, the error label sits beside the field rather than below it. */
  inlineError?: boolean;
  borderless?: boolean;
  /** Called with the full address when the user picks a suggestion. */
  onSelect: (address: BillingAddress) => void;
  /**
   * Called whenever the overlay should show, update, or hide. `state` is
   * `null` when nothing should be drawn (unfocused, or no suggestions).
   */
  onOverlayChange: (state: AddressAutocompleteOverlayState | null) => void;
  testID?: string;
}

export function AddressAutocompleteField({
  prompt,
  value,
  onChangeText,
  error,
  onErrorChange,
  countryCode,
  inlineError = false,
  borderless = false,
  onSelect,
  onOverlayChange,
  testID,
}: AddressAutocompleteFieldProps) {
  const { suggestions, queryChanged, select, clear } = useAddressAutocomplete();
  const fieldRef = useRef<View>(null);
  const [layout, setLayout] = useState<AddressAutocompleteFieldLayout | null>(null);

  // Tracks focus locally rather than relying on `value` changes, matching
  // iOS's `@FocusState`: a selection writes the field too, and only reacting
  // while focused is what stops that write from being treated as the user
  // typing and restarting the search against the address just picked.
  const [isFocused, setIsFocused] = useState(false);
  // Read inside handlers that can fire faster than a state update commits — a
  // ref mirrors the latest value so `handleChangeText` always sees the true
  // current focus state rather than one render behind.
  const isFocusedRef = useRef(false);

  function setFocused(next: boolean) {
    isFocusedRef.current = next;
    setIsFocused(next);
  }

  function handleChangeText(next: string) {
    onChangeText(next);
    if (isFocusedRef.current) queryChanged(next, countryCode);
  }

  function measureField() {
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setLayout({ x, y, width, height });
    });
  }

  function handleFocus() {
    setFocused(true);
    // Measured on focus, not on every layout pass: the field's position can
    // shift as sibling fields above it show/hide errors, and what matters is
    // where it is at the moment the list is about to appear.
    measureField();
  }

  function handleBlur() {
    setFocused(false);
    clear();
  }

  async function handlePick(suggestion: AddressSuggestion) {
    const address = await select(suggestion);
    if (!address) return;
    // Drop focus before filling. The field's own onChangeText treats a write
    // while focused as the user typing, which would restart the search
    // against the address that was just picked.
    setFocused(false);
    onSelect(address);
  }

  const showList = isFocused && suggestions.length > 0 && layout !== null;

  // Reports the overlay state up on every change that should affect what's
  // drawn — an effect, not an inline call during render, since notifying the
  // parent is a side effect and parents commonly use it to setState.
  useEffect(() => {
    onOverlayChange(
      showList ? { suggestions, layout, onSelect: (s) => void handlePick(s) } : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showList, suggestions, layout]);

  // Hide the overlay on unmount so a field that disappears mid-search (e.g.
  // the form re-renders behind it) doesn't leave a stale dropdown floating.
  useEffect(() => {
    return () => onOverlayChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View ref={fieldRef} collapsable={false}>
      <ValidatedTextField
        prompt={prompt}
        value={value}
        onChangeText={handleChangeText}
        error={error}
        onErrorChange={onErrorChange}
        textContentType="streetAddressLine1"
        autoComplete="address-line1"
        autoCapitalize="words"
        inlineError={inlineError}
        borderless={borderless}
        onFocus={handleFocus}
        onBlur={handleBlur}
        testID={testID}
      />
    </View>
  );
}

/**
 * Draws the suggestion list an {@link AddressAutocompleteField} last reported
 * via `onOverlayChange`, at the position it reported. Render this as a
 * sibling of whatever contains the ScrollView the field lives in — see this
 * file's header comment for why the overlay can't be drawn by the field
 * itself. Used by CheckoutScreen.tsx and CustomerInformationScreen.tsx.
 */
export function AddressAutocompleteOverlay({ state }: { state: AddressAutocompleteOverlayState }) {
  const theme = useFrameTheme();
  const { suggestions, layout, onSelect } = state;
  // Computed inside the component (not at module scope) so Platform.select
  // only runs once this actually renders — every screen that imports this
  // file transitively pulls it in, and a module-scope StyleSheet.create here
  // would call Platform.select on load even in tests that stub `react-native`
  // with a minimal Platform mock.
  const styles = useMemo(() => createOverlayStyles(), []);
  if (!layout) return null;
  return (
    <View
      style={[styles.wrapper, { top: layout.y + layout.height, left: layout.x, width: layout.width }]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.list,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.surfaceStroke,
            borderRadius: theme.radii.medium,
          },
        ]}
      >
        {suggestions.map((suggestion, index) => (
          <View key={suggestion.id}>
            <Pressable
              onPress={() => onSelect(suggestion)}
              style={styles.row}
              accessibilityRole="button"
              accessibilityLabel={suggestion.title}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.body.size,
                  lineHeight: theme.fontLineHeights.body,
                }}
              >
                {suggestion.title}
              </Text>
              {suggestion.subtitle ? (
                <Text
                  numberOfLines={1}
                  style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.fonts.caption.size,
                    lineHeight: theme.fontLineHeights.caption,
                    marginTop: 2,
                  }}
                >
                  {suggestion.subtitle}
                </Text>
              ) : null}
            </Pressable>
            {index < suggestions.length - 1 ? (
              <View style={[styles.divider, { backgroundColor: theme.colors.surfaceStroke }]} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function createOverlayStyles() {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      zIndex: 10,
      elevation: 10,
    },
    list: {
      borderWidth: 1,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
        },
        android: {
          elevation: 4,
        },
      }),
    },
    row: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
    },
  });
}
