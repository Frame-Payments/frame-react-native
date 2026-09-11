import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import { ValidatedTextField } from './ValidatedTextField';
import { useAddressAutocomplete } from './useAddressAutocomplete';
import type { AddressSuggestion } from '../../addressSearch';
import type { BillingAddress } from '../../types';

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
  countryCode: string | undefined;
  inlineError?: boolean;
  borderless?: boolean;
  onSelect: (address: BillingAddress) => void;
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

  const [isFocused, setIsFocused] = useState(false);
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
    measureField();
  }

  function handleBlur() {
    setFocused(false);
    clear();
  }

  async function handlePick(suggestion: AddressSuggestion) {
    const address = await select(suggestion);
    if (!address) return;
    setFocused(false);
    onSelect(address);
  }

  const showList = isFocused && suggestions.length > 0 && layout !== null;

  useEffect(() => {
    onOverlayChange(
      showList ? { suggestions, layout, onSelect: (s) => void handlePick(s) } : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showList, suggestions, layout]);

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

export function AddressAutocompleteOverlay({ state }: { state: AddressAutocompleteOverlayState }) {
  const theme = useFrameTheme();
  const { suggestions, layout, onSelect } = state;
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
