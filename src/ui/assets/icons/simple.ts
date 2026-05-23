// Hand-authored SVG icons replacing the iOS PDF-sourced imagesets:
//   - BlackCircleCloseButton.imageset  → closeCircleSvg
//   - right-chevron.imageset           → rightChevronSvg
//   - left-chevron.imageset            → leftChevronSvg
//   - BlackDownArrow.imageset          → downArrowSvg
//   - filled-selection.imageset        → filledSelectionSvg
//   - empty-selection.imageset         → emptySelectionSvg
//   - emptycard.imageset (iOS bug uses Master Card.pdf) → emptyCardSvg
//   - bank-icon.imageset (iOS bug uses Master Card.pdf) → bankIconSvg
//   - CreditCardIcon.imageset          → creditCardSvg
//
// All accept `currentColor` for fill so callers can tint them via Icon's
// `color` prop.

export const closeCircleSvg = `<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
<circle cx="15" cy="15" r="14" fill="currentColor"/>
<path d="M10 10L20 20M20 10L10 20" stroke="white" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export const rightChevronSvg = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<path d="M7 4L13 10L7 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

export const leftChevronSvg = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<path d="M13 4L7 10L13 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

export const downArrowSvg = `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
<path d="M4 7L10 13L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;

export const filledSelectionSvg = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
<circle cx="11" cy="11" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
<circle cx="11" cy="11" r="5" fill="currentColor"/>
</svg>`;

export const emptySelectionSvg = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
<circle cx="11" cy="11" r="10" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/>
</svg>`;

// Replaces iOS's "Add Payment Method" Debit/Credit Card row icon. iOS ships
// the wrong PDF here (Master Card.pdf) so we author a generic card outline.
export const emptyCardSvg = `<svg width="48" height="32" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
<rect x="2" y="3" width="44" height="26" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/>
<line x1="2" y1="11" x2="46" y2="11" stroke="currentColor" stroke-width="1.6"/>
<rect x="6" y="18" width="8" height="6" rx="1" fill="currentColor" opacity="0.35"/>
</svg>`;

// Replaces iOS's "Bank Account (ACH)" row icon. iOS ships the wrong PDF here
// (Master Card.pdf) so we author a bank-columns icon.
export const bankIconSvg = `<svg width="48" height="32" viewBox="0 0 48 32" xmlns="http://www.w3.org/2000/svg">
<path d="M4 12L24 3L44 12V14H4V12Z" fill="currentColor"/>
<rect x="8" y="16" width="3" height="10" fill="currentColor"/>
<rect x="15" y="16" width="3" height="10" fill="currentColor"/>
<rect x="22.5" y="16" width="3" height="10" fill="currentColor"/>
<rect x="30" y="16" width="3" height="10" fill="currentColor"/>
<rect x="37" y="16" width="3" height="10" fill="currentColor"/>
<rect x="4" y="27" width="40" height="3" fill="currentColor"/>
</svg>`;

export const creditCardSvg = emptyCardSvg;
