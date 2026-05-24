// Shared onboarding form spacing tokens. Every form screen reads these so
// padding/heading/field gaps stay consistent across PhoneAuth, Customer
// Information, Add Payment Method, Add Payout Method, etc. If you find
// yourself overriding a value here, prefer adding a new named token over
// hand-tuning per-screen — divergence is what creates the "every screen
// looks different" complaint.

export const FORM_SPACING = {
  /** Horizontal padding inside each screen's outer ScrollView. */
  contentHorizontal: 24,
  /** Bottom padding inside each screen's outer ScrollView. */
  contentBottom: 24,
  /** Top spacing for the screen heading (sits just below the chrome). */
  headingTop: 8,
  /** Spacing between the screen heading and the first content block. */
  headingBottom: 16,
  /** Spacing between the optional body/subhead and the first field block. */
  subheadBottom: 16,
  /** Vertical gap between sibling form fields inside a `section`. */
  fieldGap: 12,
  /** Spacing between sections (a section is a heading + its fields). */
  sectionBottom: 16,
  /** Footer (continue button) padding. */
  footerHorizontal: 24,
  footerVertical: 24,
} as const;
