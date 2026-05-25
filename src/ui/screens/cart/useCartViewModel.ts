import { useMemo } from 'react';
import type { FrameCartItem } from '../../../types';

export interface CartTotals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

export interface CartViewModel {
  items: ReadonlyArray<FrameCartItem>;
  totals: CartTotals;
  isCheckoutEnabled: boolean;
}

export function useCartViewModel(
  items: ReadonlyArray<FrameCartItem>,
  shippingAmountInCents: number,
): CartViewModel {
  return useMemo(() => {
    const subtotalCents = items.reduce((sum, item) => sum + item.amountInCents, 0);
    const totalCents = subtotalCents + shippingAmountInCents;
    return {
      items,
      totals: {
        subtotalCents,
        shippingCents: shippingAmountInCents,
        totalCents,
      },
      isCheckoutEnabled: items.length > 0 && totalCents > 0,
    };
  }, [items, shippingAmountInCents]);
}
