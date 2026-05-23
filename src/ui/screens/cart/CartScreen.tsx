import { useMemo } from 'react';
import { FlatList, Image, StyleSheet, Text, View, type ListRenderItem } from 'react-native';
import type { FrameCartItem } from '../../../types';
import { convertCentsToCurrencyString } from '../../../currency';
import { useFrameTheme } from '../../theme/ThemeContext';
import { BottomSheet } from '../../primitives/BottomSheet';
import { Button } from '../../primitives/Button';
import { useCartViewModel } from './useCartViewModel';

// Cart screen mounted by Frame.presentCart. Lists the items, sums subtotal +
// shipping = total, and exposes a Checkout button that the caller wires up to
// transition into the Checkout flow.

export interface CartScreenProps {
  items: ReadonlyArray<FrameCartItem>;
  shippingAmountInCents: number;
  currency?: string;
  title?: string;
  isCheckingOut?: boolean;
  onCheckout: () => void;
  onClose: () => void;
}

const ROW_MIN_HEIGHT = 65;
const ITEM_IMAGE_SIZE = 40;

export function CartScreen({
  items,
  shippingAmountInCents,
  currency = 'USD',
  title = 'Frame Payments',
  isCheckingOut = false,
  onCheckout,
  onClose,
}: CartScreenProps) {
  const theme = useFrameTheme();
  const vm = useCartViewModel(items, shippingAmountInCents);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderItem: ListRenderItem<FrameCartItem> = ({ item }) => (
    <View style={[styles.itemRow, { borderBottomColor: theme.colors.surfaceStroke }]}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
      ) : (
        <View style={[styles.itemImage, { backgroundColor: theme.colors.surfaceStroke }]} />
      )}
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          color: theme.colors.textPrimary,
          fontSize: theme.fonts.body.size,
          fontWeight: theme.fontWeights.body,
          lineHeight: theme.fontLineHeights.body,
        }}
      >
        {item.title}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.fonts.body.size,
          fontWeight: theme.fontWeights.label,
          lineHeight: theme.fontLineHeights.body,
        }}
      >
        {convertCentsToCurrencyString(item.amountInCents, currency)}
      </Text>
    </View>
  );

  return (
    <BottomSheet title={title} onClose={onClose}>
      <FlatList
        data={items as FrameCartItem[]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: theme.fonts.body.size,
              }}
            >
              Your cart is empty.
            </Text>
          </View>
        }
      />
      <View style={[styles.summary, { borderTopColor: theme.colors.surfaceStroke }]}>
        <SummaryRow label="Subtotal" value={convertCentsToCurrencyString(vm.totals.subtotalCents, currency)} />
        <SummaryRow label="Shipping" value={convertCentsToCurrencyString(vm.totals.shippingCents, currency)} />
        <SummaryRow
          label="Total"
          value={convertCentsToCurrencyString(vm.totals.totalCents, currency)}
          emphasized
        />
        <Button
          text={`Checkout · ${convertCentsToCurrencyString(vm.totals.totalCents, currency)}`}
          variant="primary"
          enabled={vm.isCheckoutEnabled && !isCheckingOut}
          isLoading={isCheckingOut}
          onPress={onCheckout}
          style={styles.checkoutButton}
        />
      </View>
    </BottomSheet>
  );
}

function SummaryRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  const theme = useFrameTheme();
  return (
    <View style={styles.summaryRow}>
      <Text
        style={{
          color: emphasized ? theme.colors.textPrimary : theme.colors.textSecondary,
          fontSize: theme.fonts.body.size,
          fontWeight: emphasized ? theme.fontWeights.label : theme.fontWeights.body,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.fonts.body.size,
          fontWeight: emphasized ? theme.fontWeights.label : theme.fontWeights.body,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
});

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    listContent: {
      paddingHorizontal: 16,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ROW_MIN_HEIGHT,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 12,
    },
    itemImage: {
      width: ITEM_IMAGE_SIZE,
      height: ITEM_IMAGE_SIZE,
      borderRadius: 6,
    },
    summary: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    checkoutButton: {
      marginTop: 12,
    },
    empty: {
      paddingVertical: 24,
      alignItems: 'center',
    },
  });
}
