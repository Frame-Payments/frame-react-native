import { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FrameCartItem } from '../../../types';
import { convertCentsToCurrencyString } from '../../../currency';
import { useFrameTheme } from '../../theme/ThemeContext';
import { BottomSheet } from '../../primitives/BottomSheet';
import { Button } from '../../primitives/Button';
import { useCartViewModel } from './useCartViewModel';

// Mirror of iOS FrameCartView. The default title "Frame Payments" + subtitle
// "Cart" live INSIDE the sheet body (left-aligned, full width) rather than in
// the BottomSheet header; the BottomSheet contributes only the swipe-down
// pageSheet chrome.

export interface CartScreenProps {
  items: ReadonlyArray<FrameCartItem>;
  shippingAmountInCents: number;
  currency?: string;
  title?: string;
  subtitle?: string;
  checkoutButtonTitle?: string;
  isCheckingOut?: boolean;
  onCheckout: () => void;
  onClose: () => void;
}

const ITEM_ROW_HEIGHT = 65;
const ITEM_IMAGE_SIZE = 40;

export function CartScreen({
  items,
  shippingAmountInCents,
  currency = 'USD',
  title = 'Frame Payments',
  subtitle = 'Cart',
  checkoutButtonTitle = 'Checkout',
  isCheckingOut = false,
  onCheckout,
  onClose,
}: CartScreenProps) {
  const theme = useFrameTheme();
  const vm = useCartViewModel(items, shippingAmountInCents);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet title="" showCloseButton onClose={onClose}>
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.title.size,
            fontWeight: theme.fontWeights.title,
            lineHeight: theme.fontLineHeights.title,
          },
        ]}
      >
        {title}
      </Text>
      <View style={[styles.titleDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text
          style={[
            styles.subtitle,
            {
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.headline.size,
              fontWeight: theme.fontWeights.headline,
              lineHeight: theme.fontLineHeights.headline,
            },
          ]}
        >
          {subtitle}
        </Text>

        {items.length === 0 ? (
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
        ) : (
          items.map((item) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                {
                  borderColor: theme.colors.surfaceStroke,
                  borderRadius: theme.radii.medium,
                },
              ]}
            >
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
                  fontSize: theme.fonts.headline.size,
                  fontWeight: theme.fontWeights.headline,
                  lineHeight: theme.fontLineHeights.headline,
                }}
              >
                {item.title}
              </Text>
              <Text
                style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.headline.size,
                  fontWeight: theme.fontWeights.headline,
                  lineHeight: theme.fontLineHeights.headline,
                }}
              >
                {convertCentsToCurrencyString(item.amountInCents, currency)}
              </Text>
            </View>
          ))
        )}

        <SummaryRow
          label="Subtotal"
          value={convertCentsToCurrencyString(vm.totals.subtotalCents, currency)}
        />
        <SummaryRow
          label="Shipping"
          value={convertCentsToCurrencyString(vm.totals.shippingCents, currency)}
        />
        <View style={[styles.totalDivider, { backgroundColor: theme.colors.surfaceStroke }]} />
        <SummaryRow
          label="Total"
          value={convertCentsToCurrencyString(vm.totals.totalCents, currency)}
          emphasized
        />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          text={checkoutButtonTitle}
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
  const color = emphasized ? theme.colors.textPrimary : theme.colors.textSecondary;
  return (
    <View style={summaryRowStyles.row}>
      <Text
        style={{
          color,
          fontSize: theme.fonts.headline.size,
          fontWeight: theme.fontWeights.headline,
          lineHeight: theme.fontLineHeights.headline,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color,
          fontSize: theme.fonts.headline.size,
          fontWeight: theme.fontWeights.headline,
          lineHeight: theme.fontLineHeights.headline,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const summaryRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    title: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    titleDivider: {
      height: StyleSheet.hairlineWidth,
    },
    scrollContent: {
      paddingBottom: 16,
    },
    subtitle: {
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: ITEM_ROW_HEIGHT,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
      borderWidth: 1,
    },
    itemImage: {
      width: ITEM_IMAGE_SIZE,
      height: ITEM_IMAGE_SIZE,
      borderRadius: 6,
    },
    totalDivider: {
      height: StyleSheet.hairlineWidth,
      marginHorizontal: 16,
      marginVertical: 4,
    },
    footer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    checkoutButton: {
      height: 42,
    },
    empty: {
      paddingVertical: 24,
      alignItems: 'center',
    },
  });
}
