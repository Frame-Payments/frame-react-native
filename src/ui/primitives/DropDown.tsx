import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';

// Generic single-select dropdown. Sheet-style on both platforms so the
// behavior + visuals are identical (avoids Android Material picker awkwardness).

export interface DropDownOption<T extends string> {
  value: T;
  label: string;
}

export interface DropDownProps<T extends string> {
  options: ReadonlyArray<DropDownOption<T>>;
  selected: T;
  onSelect: (value: T) => void;
  prompt?: string;
  testID?: string;
  error?: string;
}

export function DropDown<T extends string>({ options, selected, onSelect, prompt, testID, error }: DropDownProps<T>) {
  const [open, setOpen] = useState(false);
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedLabel = options.find((o) => o.value === selected)?.label ?? '';

  const renderItem: ListRenderItem<DropDownOption<T>> = ({ item }) => {
    const isSelected = item.value === selected;
    return (
      <Pressable
        onPress={() => {
          setOpen(false);
          onSelect(item.value);
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected }}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: theme.colors.surfaceStroke, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text
          style={[
            styles.rowLabel,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          {item.label}
        </Text>
        {isSelected ? <Text style={[styles.check, { color: theme.colors.textPrimary }]}>✓</Text> : null}
      </Pressable>
    );
  };

  return (
    <View>
      {prompt ? (
        <Text style={[styles.prompt, { color: theme.colors.textSecondary }]}>{prompt}</Text>
      ) : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={prompt ? `${prompt}: ${selectedLabel}` : selectedLabel}
        testID={testID}
        style={({ pressed }) => [
          styles.trigger,
          {
            borderColor: error ? theme.colors.error : theme.colors.surfaceStroke,
            borderRadius: theme.radii.medium,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
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
          {selectedLabel}
        </Text>
        <Text style={[styles.caret, { color: theme.colors.textSecondary }]}>▾</Text>
      </Pressable>
      {error ? (
        <Text
          style={[styles.error, { color: theme.colors.error, fontSize: theme.fonts.bodySmall.size }]}
        >
          {error}
        </Text>
      ) : null}
      <Modal
        visible={open}
        animationType="slide"
        transparent={false}
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.header}>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
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
              {prompt ?? 'Select'}
            </Text>
            <View style={{ width: 60 }} />
          </View>
          <FlatList
            data={options as DropDownOption<T>[]}
            keyExtractor={(item) => item.value}
            renderItem={renderItem}
          />
        </View>
      </Modal>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    prompt: {
      fontSize: 12,
      marginBottom: 4,
    },
    trigger: {
      borderWidth: 1,
      height: 49,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    triggerLabel: {
      flex: 1,
    },
    caret: {
      fontSize: 14,
      marginLeft: 8,
    },
    error: {
      marginTop: 4,
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
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
