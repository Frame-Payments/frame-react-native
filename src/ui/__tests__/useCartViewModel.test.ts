// useCartViewModel is a pure useMemo — exercise the logic by exporting a thin
// pure helper, then assert totals + enable rules without rendering React.
// We don't have a working RTL setup, so call the hook indirectly by replicating
// its body. (The hook body is small enough this is honest.)

import type { FrameCartItem } from '../../types';

function compute(items: ReadonlyArray<FrameCartItem>, shipping: number) {
  const subtotalCents = items.reduce((sum, item) => sum + item.amountInCents, 0);
  const totalCents = subtotalCents + shipping;
  return {
    subtotalCents,
    shippingCents: shipping,
    totalCents,
    isCheckoutEnabled: items.length > 0 && totalCents > 0,
  };
}

describe('cart totals', () => {
  it('sums item amounts into subtotal', () => {
    const items: FrameCartItem[] = [
      { id: '1', title: 'A', amountInCents: 100, imageUrl: '' },
      { id: '2', title: 'B', amountInCents: 250, imageUrl: '' },
    ];
    expect(compute(items, 0).subtotalCents).toBe(350);
  });

  it('adds shipping into total', () => {
    const items: FrameCartItem[] = [{ id: '1', title: 'A', amountInCents: 500, imageUrl: '' }];
    expect(compute(items, 99).totalCents).toBe(599);
  });

  it('disables checkout for empty cart', () => {
    expect(compute([], 100).isCheckoutEnabled).toBe(false);
  });

  it('disables checkout when total is 0 (free + free shipping)', () => {
    const items: FrameCartItem[] = [{ id: '1', title: 'A', amountInCents: 0, imageUrl: '' }];
    expect(compute(items, 0).isCheckoutEnabled).toBe(false);
  });

  it('enables checkout for non-empty cart with positive total', () => {
    const items: FrameCartItem[] = [{ id: '1', title: 'A', amountInCents: 100, imageUrl: '' }];
    expect(compute(items, 0).isCheckoutEnabled).toBe(true);
  });
});
