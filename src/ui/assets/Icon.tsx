import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { shieldIconSvg } from './icons/shield-icon';
import { personCheckSvg } from './icons/person-check';
import { amexSvg, discoverSvg, mastercardSvg, visaSvg } from './icons/card-brands';
import {
  bankIconSvg,
  closeCircleSvg,
  creditCardSvg,
  downArrowSvg,
  emptyCardSvg,
  emptySelectionSvg,
  filledSelectionSvg,
  leftChevronSvg,
  rightChevronSvg,
} from './icons/simple';

// Single render path for every iOS imageset we port. Pick the icon by
// name; pass `color` to tint the simple (hand-authored) icons that use
// `currentColor`. The full-color brand logos and shield/person-check
// images ignore `color` — they're already styled.

export type IconName =
  | 'shield-icon'
  | 'person-check'
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'close-circle'
  | 'right-chevron'
  | 'left-chevron'
  | 'down-arrow'
  | 'filled-selection'
  | 'empty-selection'
  | 'empty-card'
  | 'bank-icon'
  | 'credit-card';

export interface IconProps {
  name: IconName;
  /** Square size in points (width = height). */
  size?: number;
  /** Tint for icons that use `currentColor` (the hand-authored ones). */
  color?: string;
  /** Override aspect ratio for non-square art (card brand logos are 780×500). */
  width?: number;
  height?: number;
  testID?: string;
}

const SVG_BY_NAME: Record<IconName, string> = {
  'shield-icon': shieldIconSvg,
  'person-check': personCheckSvg,
  visa: visaSvg,
  mastercard: mastercardSvg,
  amex: amexSvg,
  discover: discoverSvg,
  'close-circle': closeCircleSvg,
  'right-chevron': rightChevronSvg,
  'left-chevron': leftChevronSvg,
  'down-arrow': downArrowSvg,
  'filled-selection': filledSelectionSvg,
  'empty-selection': emptySelectionSvg,
  'empty-card': emptyCardSvg,
  'bank-icon': bankIconSvg,
  'credit-card': creditCardSvg,
};

export function Icon({ name, size = 24, color, width, height, testID }: IconProps) {
  const raw = SVG_BY_NAME[name];
  // SvgXml resolves `currentColor` via the `color` prop on the root SVG —
  // pass it through with a regex on the source so cross-platform svg
  // libraries that don't honor `color` still tint correctly.
  const xml = color ? raw.replace(/currentColor/g, color) : raw;
  return (
    <View testID={testID}>
      <SvgXml xml={xml} width={width ?? size} height={height ?? size} />
    </View>
  );
}
