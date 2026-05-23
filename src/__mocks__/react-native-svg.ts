// Jest stub for react-native-svg. The real package pulls in
// `Touchable.Mixin` from react-native which is undefined under node, so we
// short-circuit every public export to a no-op View component for tests.

import { View } from 'react-native';

const Stub = View;

export const SvgXml = Stub;
export const Svg = Stub;
export const Circle = Stub;
export const Rect = Stub;
export const Path = Stub;
export const G = Stub;
export const Line = Stub;
export const Text = Stub;
export const Defs = Stub;
export const ClipPath = Stub;
export const LinearGradient = Stub;
export const Stop = Stub;
export const Polygon = Stub;
export const Polyline = Stub;
export const Ellipse = Stub;

export default Stub;
