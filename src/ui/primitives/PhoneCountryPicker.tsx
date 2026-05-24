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
  alpha2ToFlag,
  getPhoneCountries,
  RESTRICTED_ALPHA2_CODES,
  type PhoneCountry,
} from '../../countries';

// Compact country selector for the phone-auth screen. Trigger is 110pt wide
// (per the plan); shows flag + dial code (e.g. "🇺🇸 +1"). Opens a full-screen
// searchable sheet with flag + name + alpha2 + dial code rows.

export interface PhoneCountryPickerProps {
  /** Currently selected alpha-2 (e.g. 'US'). */
  selectedAlpha2: string;
  onSelect: (country: PhoneCountry) => void;
  testID?: string;
}

const TRIGGER_WIDTH = 110;

export function PhoneCountryPicker({ selectedAlpha2, onSelect, testID }: PhoneCountryPickerProps) {
  const [open, setOpen] = useState(false);
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const countries = useMemo(() => {
    const blocked = new Set(RESTRICTED_ALPHA2_CODES);
    return getPhoneCountries().filter((c) => !blocked.has(c.alpha2Code));
  }, []);
  const selected = useMemo(
    () => countries.find((c) => c.alpha2Code === selectedAlpha2) ?? countries[0]!,
    [countries, selectedAlpha2],
  );

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Country ${selected.displayName}, dial code ${selected.callingCode}`}
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
          style={[
            styles.dialCode,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          {selected.callingCode}
        </Text>
      </Pressable>
      <PhoneCountrySheet
        visible={open}
        countries={countries}
        selectedAlpha2={selectedAlpha2}
        onClose={() => setOpen(false)}
        onSelect={(c) => {
          setOpen(false);
          onSelect(c);
        }}
      />
    </>
  );
}

interface SheetProps {
  visible: boolean;
  countries: ReadonlyArray<PhoneCountry>;
  selectedAlpha2: string;
  onClose: () => void;
  onSelect: (country: PhoneCountry) => void;
}

function PhoneCountrySheet({ visible, countries, selectedAlpha2, onClose, onSelect }: SheetProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return countries;
    return countries.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        c.alpha2Code.toLowerCase().includes(q) ||
        c.callingCode.includes(q),
    );
  }, [countries, query]);

  const renderItem: ListRenderItem<PhoneCountry> = ({ item }) => {
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
        <Text style={styles.rowFlag}>{item.flag}</Text>
        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[
              styles.rowName,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.body.size,
                lineHeight: theme.fontLineHeights.body,
              },
            ]}
          >
            {item.displayName}
          </Text>
          <Text
            style={[
              styles.rowSub,
              {
                color: theme.colors.textSecondary,
                fontSize: theme.fonts.bodySmall.size,
              },
            ]}
          >
            {item.alpha2Code} · {item.callingCode}
          </Text>
        </View>
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
            placeholder="Search by name, code, or dial"
            placeholderTextColor={theme.colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              styles.searchInput,
              {
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.body.size,
              },
            ]}
            accessibilityLabel="Search phone country"
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
      width: TRIGGER_WIDTH,
      height: 49,
      borderWidth: 1,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    flag: {
      fontSize: 20,
    },
    dialCode: {
      fontWeight: '500',
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
    rowText: {
      flex: 1,
    },
    rowName: {},
    rowSub: {
      marginTop: 2,
    },
    check: {
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
