import { forwardRef, useMemo, useRef, type Ref } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// Date-of-birth entry: three side-by-side numeric inputs (MM / DD / YYYY) with
// auto-advance once each box is "full" (2 / 2 / 4 digits). The reducer stores
// month / day / year as raw strings; validation runs through
// validateDateOfBirth in Phase 3.

export interface DobInputFieldProps {
  month: string;
  day: string;
  year: string;
  onChange: (next: { month: string; day: string; year: string }) => void;
  error?: string;
  testID?: string;
}

function digitsOnly(s: string, max: number): string {
  return s.replace(/\D+/g, '').slice(0, max);
}

export function DobInputField({ month, day, year, onChange, error, testID }: DobInputFieldProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const monthRef = useRef<TextInput | null>(null);
  const dayRef = useRef<TextInput | null>(null);
  const yearRef = useRef<TextInput | null>(null);

  function focusNext(ref: { current: TextInput | null }) {
    requestAnimationFrame(() => ref.current?.focus());
  }

  function onMonth(raw: string) {
    const next = digitsOnly(raw, 2);
    onChange({ month: next, day, year });
    // Only auto-advance once the value parses as a valid 1–12 month so the
    // user isn't surprised by focus moving on an obvious typo (e.g. '24').
    if (next.length === 2) {
      const n = Number.parseInt(next, 10);
      if (n >= 1 && n <= 12) focusNext(dayRef);
    }
  }
  function onDay(raw: string) {
    const next = digitsOnly(raw, 2);
    onChange({ month, day: next, year });
    if (next.length === 2) {
      const n = Number.parseInt(next, 10);
      if (n >= 1 && n <= 31) focusNext(yearRef);
    }
  }
  function onYear(raw: string) {
    const next = digitsOnly(raw, 4);
    onChange({ month, day, year: next });
  }

  return (
    <View testID={testID}>
      <View style={styles.row}>
        <Cell
          ref={monthRef}
          placeholder="MM"
          value={month}
          onChangeText={onMonth}
          maxLength={2}
          flex={1}
          theme={theme}
          error={!!error}
          accessibilityLabel="Birth month"
          testID={testID ? `${testID}.month` : undefined}
        />
        <Cell
          ref={dayRef}
          placeholder="DD"
          value={day}
          onChangeText={onDay}
          maxLength={2}
          flex={1}
          theme={theme}
          error={!!error}
          accessibilityLabel="Birth day"
          testID={testID ? `${testID}.day` : undefined}
        />
        <Cell
          ref={yearRef}
          placeholder="YYYY"
          value={year}
          onChangeText={onYear}
          maxLength={4}
          flex={1.5}
          theme={theme}
          error={!!error}
          accessibilityLabel="Birth year"
          testID={testID ? `${testID}.year` : undefined}
        />
      </View>
      {error ? (
        <Text
          style={[
            styles.error,
            {
              color: theme.colors.error,
              fontSize: theme.fonts.bodySmall.size,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

interface CellProps {
  placeholder: string;
  value: string;
  onChangeText: (next: string) => void;
  maxLength: number;
  flex: number;
  theme: ReturnType<typeof useFrameTheme>;
  error: boolean;
  accessibilityLabel: string;
  testID?: string;
}

const Cell = forwardRef(function Cell(
  {
    placeholder,
    value,
    onChangeText,
    maxLength,
    flex,
    theme,
    error,
    accessibilityLabel,
    testID,
  }: CellProps,
  ref: Ref<TextInput>,
) {
  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.textSecondary}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={maxLength}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={{
        flex,
        height: 49,
        borderWidth: 1,
        borderColor: error ? theme.colors.error : theme.colors.surfaceStroke,
        borderRadius: theme.radii.medium,
        paddingHorizontal: 12,
        color: theme.colors.textPrimary,
        fontSize: theme.fonts.body.size,
        lineHeight: theme.fontLineHeights.body,
        textAlign: 'center',
      }}
    />
  );
});

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    error: {
      marginTop: 4,
    },
  });
}
