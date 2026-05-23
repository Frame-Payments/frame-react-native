import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useFrameTheme } from '../theme/ThemeContext';
import {
  applyCvcInput,
  applyExpiryInput,
  applyPanInput,
  emptyCardFieldState,
  parseExpiry,
  type CardFieldState,
} from './paymentCardFormat';
import { validateCVC, validateCard, validateCardExpiry } from '../../validation';

// Composite text input for card details. Three sub-fields share one bordered
// container styled like a single text field, matching iOS PaymentCardField and
// Android PaymentCardField. Brand detection runs on each PAN change; max PAN
// + CVC lengths track the detected brand. Validation does NOT run live —
// PaymentCardField.validate() is called by the parent screen at submit time.

export interface PaymentCardFieldHandle {
  /**
   * Run full Luhn + length + expiry + CVC validation. Returns null when valid;
   * otherwise a per-field error map. The parent screen renders errors itself
   * (typically into a Toast) so this component stays stateless about errors.
   */
  validate(): null | {
    pan?: string;
    expiry?: string;
    cvc?: string;
  };
  /** Read current field values for serialization / encryption at submit. */
  getValues(): {
    pan: string; // digits only, no spaces
    expirationMonth: string; // "MM"
    expirationYear: string; // "YY"
    cvc: string;
    brand: string | null;
  };
  /** Wipe everything (used after a successful submit). */
  reset(): void;
}

export interface PaymentCardFieldProps {
  onChange?: (state: { brand: string | null; complete: boolean }) => void;
  testID?: string;
}

export const PaymentCardField = forwardRef<PaymentCardFieldHandle, PaymentCardFieldProps>(
  function PaymentCardField({ onChange, testID }, ref) {
    const theme = useFrameTheme();
    const [state, setState] = useState<CardFieldState>(emptyCardFieldState);
    const styles = useMemo(() => createStyles(theme), [theme]);

    const panInputRef = useRef<TextInput>(null);
    const expiryInputRef = useRef<TextInput>(null);
    const cvcInputRef = useRef<TextInput>(null);

    function update(next: CardFieldState) {
      setState(next);
      onChange?.({
        brand: next.brand,
        complete:
          validateCard(next.panRaw) === null &&
          parseExpiry(next.expiryDisplay) !== null &&
          validateCVC(next.cvcRaw, next.brand) === null,
      });
    }

    function onPanChange(raw: string) {
      const next = applyPanInput(state, raw);
      update(next);
      // Auto-advance once PAN hits max digits.
      const maxLen = next.brand === 'amex' ? 15 : 19;
      if (next.panRaw.length >= maxLen) {
        expiryInputRef.current?.focus();
      }
    }

    function onExpiryChange(raw: string) {
      const next = applyExpiryInput(state, raw);
      update(next);
      // Auto-advance once expiry has a full MM/YY.
      if (next.expiryDisplay.length === 5) {
        cvcInputRef.current?.focus();
      }
    }

    function onCvcChange(raw: string) {
      update(applyCvcInput(state, raw));
    }

    useImperativeHandle(
      ref,
      () => ({
        validate() {
          const errors: { pan?: string; expiry?: string; cvc?: string } = {};
          const panError = validateCard(state.panRaw);
          if (panError) errors.pan = panError;

          const expiry = parseExpiry(state.expiryDisplay);
          if (!expiry) {
            errors.expiry = 'Enter expiration as MM/YY';
          } else {
            const expiryError = validateCardExpiry(expiry.month, expiry.year);
            if (expiryError) errors.expiry = expiryError;
          }

          const cvcError = validateCVC(state.cvcRaw, state.brand);
          if (cvcError) errors.cvc = cvcError;

          return Object.keys(errors).length === 0 ? null : errors;
        },
        getValues() {
          const expiry = parseExpiry(state.expiryDisplay);
          return {
            pan: state.panRaw,
            expirationMonth: expiry?.month ?? '',
            expirationYear: expiry?.year ?? '',
            cvc: state.cvcRaw,
            brand: state.brand,
          };
        },
        reset() {
          setState(emptyCardFieldState());
        },
      }),
      [state],
    );

    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.surfaceStroke,
            borderRadius: theme.radii.medium,
          },
        ]}
        testID={testID}
      >
        <View style={styles.row}>
          <View style={styles.panColumn}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Card number</Text>
            <View style={styles.panRow}>
              <TextInput
                ref={panInputRef}
                value={state.panDisplay}
                onChangeText={onPanChange}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={theme.colors.textSecondary}
                keyboardType="number-pad"
                inputMode="numeric"
                autoComplete="cc-number"
                textContentType="creditCardNumber"
                maxLength={state.brand === 'amex' ? 17 : 23}
                style={[
                  styles.input,
                  {
                    color: theme.colors.textPrimary,
                    fontSize: theme.fonts.body.size,
                    lineHeight: theme.fontLineHeights.body,
                  },
                ]}
                accessibilityLabel="Card number"
              />
              {state.brand ? (
                <Text style={[styles.brand, { color: theme.colors.textSecondary }]}>{brandShortLabel(state.brand)}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceStroke }]} />

        <View style={styles.row}>
          <View style={styles.expiryColumn}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Expiry</Text>
            <TextInput
              ref={expiryInputRef}
              value={state.expiryDisplay}
              onChangeText={onExpiryChange}
              placeholder="MM/YY"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="cc-exp"
              maxLength={5}
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.body.size,
                  lineHeight: theme.fontLineHeights.body,
                },
              ]}
              accessibilityLabel="Card expiration"
            />
          </View>
          <View style={[styles.divider, styles.dividerVertical, { backgroundColor: theme.colors.surfaceStroke }]} />
          <View style={styles.cvcColumn}>
            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>CVC</Text>
            <TextInput
              ref={cvcInputRef}
              value={state.cvcRaw}
              onChangeText={onCvcChange}
              placeholder={state.brand === 'amex' ? '1234' : '123'}
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={state.brand === 'amex' ? 4 : 3}
              secureTextEntry
              style={[
                styles.input,
                {
                  color: theme.colors.textPrimary,
                  fontSize: theme.fonts.body.size,
                  lineHeight: theme.fontLineHeights.body,
                },
              ]}
              accessibilityLabel="Card security code"
            />
          </View>
        </View>
      </View>
    );
  },
);

function brandShortLabel(brand: string): string {
  switch (brand) {
    case 'amex':
      return 'AMEX';
    case 'visa':
      return 'VISA';
    case 'mastercard':
      return 'MC';
    case 'discover':
      return 'DISC';
    case 'diners':
      return 'DCI';
    case 'jcb':
      return 'JCB';
    case 'unionpay':
      return 'UPI';
    default:
      return brand.toUpperCase();
  }
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      borderWidth: 1,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    panColumn: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    panRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    expiryColumn: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    cvcColumn: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    label: {
      fontSize: 12,
      marginBottom: 2,
    },
    input: {
      paddingVertical: 4,
      padding: 0,
    },
    brand: {
      fontSize: 12,
      fontWeight: '600',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      width: '100%',
    },
    dividerVertical: {
      width: StyleSheet.hairlineWidth,
      height: '100%',
    },
  });
}
