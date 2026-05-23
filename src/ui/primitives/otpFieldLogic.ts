// Pure helpers behind OtpInputField. Extracted so we can exercise the focus
// / paste / backspace logic in jest without rendering React.

export const OTP_LENGTH = 6;

export interface OtpUpdate {
  /** Next full 6-char value (always length OTP_LENGTH; trailing slots padded with ''). */
  next: ReadonlyArray<string>;
  /** Index of the box that should receive focus after the change. */
  focusIndex: number;
}

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

export function emptyOtp(): ReadonlyArray<string> {
  return ['', '', '', '', '', ''];
}

/** Normalize a possibly-arbitrary string into a 6-slot digit array. */
export function fromString(value: string): ReadonlyArray<string> {
  const digits = digitsOnly(value).slice(0, OTP_LENGTH);
  const slots: string[] = ['', '', '', '', '', ''];
  for (let i = 0; i < digits.length; i++) slots[i] = digits[i]!;
  return slots;
}

/** Combine the slots into the JS-facing single string (no padding). */
export function toString(slots: ReadonlyArray<string>): string {
  return slots.join('');
}

// Handle the change of a single slot. Two cases:
//   - Single character typed in box `i` → write to slot i, focus i+1.
//   - Paste of multiple characters in box i → expand starting at slot i,
//     focusing the next empty slot (or the last slot when all filled).
//
// Empty `raw` means the user deleted the slot's character; reducer handles
// the deletion by writing '' and leaving focus where it is (the parent's
// onKeyPress handler is responsible for moving focus on Backspace).
export function handleSlotChange(
  prev: ReadonlyArray<string>,
  index: number,
  raw: string,
): OtpUpdate {
  const digits = digitsOnly(raw);
  if (digits === '') {
    // Deletion via clearing the field.
    const next = [...prev];
    next[index] = '';
    return { next, focusIndex: index };
  }
  if (digits.length === 1) {
    const next = [...prev];
    next[index] = digits;
    const focusIndex = Math.min(index + 1, OTP_LENGTH - 1);
    return { next, focusIndex };
  }
  // Paste / autofill: spread starting at `index`.
  const next = [...prev];
  let cursor = index;
  for (const ch of digits) {
    if (cursor >= OTP_LENGTH) break;
    next[cursor] = ch;
    cursor++;
  }
  // Focus the first empty slot we haven't filled — or the last filled slot
  // when the paste reaches the end.
  let focusIndex = cursor;
  if (focusIndex >= OTP_LENGTH) focusIndex = OTP_LENGTH - 1;
  return { next, focusIndex };
}

// Backspace pressed in box `i` when the box is empty → move focus left + clear
// the left neighbor. Called by the parent's onKeyPress handler.
export function handleBackspace(
  prev: ReadonlyArray<string>,
  index: number,
): OtpUpdate | null {
  if (index === 0) return null;
  if (prev[index] !== '') {
    // RN's onKeyPress for Backspace fires BEFORE the delete is applied to a
    // non-empty slot. Let the default delete happen.
    return null;
  }
  const next = [...prev];
  next[index - 1] = '';
  return { next, focusIndex: index - 1 };
}
