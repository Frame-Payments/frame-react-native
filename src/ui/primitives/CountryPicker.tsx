import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import {
  DEFAULT_COUNTRY,
  alpha2ToFlag,
  getAvailableCountries,
  type AvailableCountry,
} from '../../countries';

// Searchable bottom-sheet country picker. Used by the onboarding billing
// address flow. The list is filtered by RESTRICTED_ALPHA2_CODES from Phase 3
// so sanctioned countries never appear.

export interface CountryPickerProps {
  /** Currently selected alpha-2 code. */
  selectedAlpha2: string;
  /** Triggered with the newly chosen country. */
  onSelect: (country: AvailableCountry) => void;
  testID?: string;
}

export function CountryPicker({ selectedAlpha2, onSelect, testID }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const countries = useMemo(() => getAvailableCountries(), []);
  const selected = useMemo(
    () => countries.find((c) => c.alpha2Code === selectedAlpha2) ?? DEFAULT_COUNTRY,
    [countries, selectedAlpha2],
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Country: ${selected.displayName}`}
        testID={testID}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: theme.colors.surfaceStroke,
            borderRadius: theme.radii.medium,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Text style={styles.flag}>{alpha2ToFlag(selected.alpha2Code)}</Text>
        <Text
          numberOfLines={1}
          style={[
            styles.triggerLabel,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          {selected.displayName}
        </Text>
        <Text style={[styles.caret, { color: theme.colors.textSecondary }]}>▾</Text>
      </Pressable>
      <CountryPickerSheet
        visible={open}
        countries={countries}
        selectedAlpha2={selectedAlpha2}
        onClose={() => setOpen(false)}
        onSelect={(country) => {
          setOpen(false);
          onSelect(country);
        }}
      />
    </>
  );
}

interface CountryPickerSheetProps {
  visible: boolean;
  countries: ReadonlyArray<AvailableCountry>;
  selectedAlpha2: string;
  onClose: () => void;
  onSelect: (country: AvailableCountry) => void;
}

function CountryPickerSheet({ visible, countries, selectedAlpha2, onClose, onSelect }: CountryPickerSheetProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return countries;
    return countries.filter(
      (c) => c.displayName.toLowerCase().includes(q) || c.alpha2Code.toLowerCase().includes(q),
    );
  }, [countries, query]);

  const renderItem: ListRenderItem<AvailableCountry> = ({ item }) => {
    const isSelected = item.alpha2Code === selectedAlpha2;
    return (
      <Pressable
        onPress={() => onSelect(item)}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: theme.colors.surfaceStroke, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={styles.rowFlag}>{alpha2ToFlag(item.alpha2Code)}</Text>
        <Text
          numberOfLines={1}
          style={[
            styles.rowLabel,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          {item.displayName}
        </Text>
        {isSelected ? <Text style={[styles.check, { color: theme.colors.textPrimary }]}>✓</Text> : null}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={[styles.cancel, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.headline.size,
                fontWeight: theme.fontWeights.headline,
                lineHeight: theme.fontLineHeights.headline,
              },
            ]}
          >
            Select country
          </Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.searchRow, { borderBottomColor: theme.colors.surfaceStroke }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={theme.colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              styles.searchInput,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.body.size,
                lineHeight: theme.fontLineHeights.body,
              },
            ]}
            accessibilityLabel="Search countries"
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.alpha2Code}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      </View>
    </Modal>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    trigger: {
      borderWidth: 1,
      paddingHorizontal: 12,
      height: 49,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    flag: {
      fontSize: 20,
    },
    triggerLabel: {
      flex: 1,
    },
    caret: {
      fontSize: 14,
      marginLeft: 4,
    },
    sheet: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    cancel: {
      fontSize: 16,
      width: 60,
    },
    title: {
      flex: 1,
      textAlign: 'center',
    },
    searchRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    searchInput: {
      paddingVertical: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    rowFlag: {
      fontSize: 22,
    },
    rowLabel: {
      flex: 1,
    },
    check: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
