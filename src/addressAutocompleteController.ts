import { suggestAddresses, retrieveAddress, type AddressSuggestion } from './addressSearch';
import type { BillingAddress } from './types';

// The suggestion-list state machine behind an address field. Ports iOS
// AddressAutocompleteController
// (`Sources/Frame/Networking/AddressSearch/AddressAutocompleteController.swift`).
//
// Deliberately plain — no React — for the same reason iOS's version injects
// `Sleeper`/`Search`/`Retrieve` typealiases: the debounce-cancel and
// query-ordering rules are the part worth testing precisely, and doing that
// needs a fake clock and a fake network, not a rendered component. The React
// hook (useAddressAutocomplete.ts) is a thin wrapper that owns one instance of
// this per field and forwards its callbacks into component state.
//
// Autocomplete never blocks manual entry. Every failure path — no token,
// Mapbox unreachable, an empty result set — clears the suggestions and
// reports nothing, so a user who is typing simply sees no list rather than an
// error (suggestAddresses/retrieveAddress already resolve to null/[] on every
// failure, never throw).

/** The shortest query worth a request. Below this the list stays empty. */
export const MINIMUM_QUERY_LENGTH = 2;

/** The most suggestions the list will hold. */
export const MAXIMUM_SUGGESTIONS = 3;

/** Debounce before a keystroke turns into a request. */
export const DEBOUNCE_MS = 80;

export interface AddressAutocompleteControllerOptions {
  onSuggestionsChange: (suggestions: ReadonlyArray<AddressSuggestion>) => void;
  debounceMs?: number;
  maximumSuggestions?: number;
  /** Injected so tests need no real timers. Defaults to setTimeout/clearTimeout. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  /** Injected so tests need no real network. Defaults to addressSearch.ts. */
  search?: typeof suggestAddresses;
  retrieve?: typeof retrieveAddress;
}

export class AddressAutocompleteController {
  private readonly onSuggestionsChange: (suggestions: ReadonlyArray<AddressSuggestion>) => void;
  private readonly debounceMs: number;
  private readonly maximumSuggestions: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly search: typeof suggestAddresses;
  private readonly retrieveAddr: typeof retrieveAddress;

  // The pending debounce timer, cancelled whenever new input arrives so a
  // burst of keystrokes collapses into one request. Only the WAIT is
  // cancelled — a request that already reached the network is left to
  // finish, since killing it is what would force the user to stop typing
  // before any list could ever appear.
  private debounceHandle: unknown = null;

  // Counts queries so a slow response for an earlier one cannot overwrite the
  // list with results for text the user has already moved past. Requests can
  // complete out of order.
  private latestQueryId = 0;

  constructor(options: AddressAutocompleteControllerOptions) {
    this.onSuggestionsChange = options.onSuggestionsChange;
    this.debounceMs = options.debounceMs ?? DEBOUNCE_MS;
    this.maximumSuggestions = options.maximumSuggestions ?? MAXIMUM_SUGGESTIONS;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.search = options.search ?? suggestAddresses;
    this.retrieveAddr = options.retrieve ?? retrieveAddress;
  }

  private cancelDebounce(): void {
    if (this.debounceHandle !== null) {
      this.clearTimer(this.debounceHandle);
      this.debounceHandle = null;
    }
  }

  /**
   * Reacts to the user typing: waits out a short debounce, then searches.
   *
   * A new keystroke cancels only the pending wait, never a request already in
   * flight. Results therefore arrive while the user is still typing rather
   * than after they stop, and a response is applied only when it is for the
   * most recent query — so an earlier lookup that resolves late is discarded
   * instead of replacing newer results.
   */
  queryChanged(query: string, countryCode: string | undefined): void {
    this.cancelDebounce();

    const trimmed = query.trim();
    if (trimmed.length < MINIMUM_QUERY_LENGTH) {
      this.latestQueryId += 1;
      this.onSuggestionsChange([]);
      return;
    }

    this.latestQueryId += 1;
    const queryId = this.latestQueryId;

    this.debounceHandle = this.setTimer(() => {
      this.debounceHandle = null;
      void (async () => {
        const found = await this.search(trimmed, countryCode, this.maximumSuggestions);
        // Apply only if no newer query has been issued while this one was in
        // flight — a response for stale text must not repopulate the list out
        // from under what the user is looking at now.
        if (queryId !== this.latestQueryId) return;
        this.onSuggestionsChange(found);
      })();
    }, this.debounceMs);
  }

  /** Resolves a picked suggestion, or null if it cannot be resolved. */
  async select(suggestion: AddressSuggestion): Promise<BillingAddress | null> {
    this.cancelDebounce();
    // Bumping the id retires any in-flight search, so a response that lands
    // after the pick cannot repopulate the list the user has just dismissed.
    this.latestQueryId += 1;
    this.onSuggestionsChange([]);
    return this.retrieveAddr(suggestion);
  }

  /** Clears the list without sending anything, for dismissing on blur. */
  clear(): void {
    this.cancelDebounce();
    this.latestQueryId += 1;
    this.onSuggestionsChange([]);
  }

  /** Cancels any pending debounce. Call on unmount. */
  dispose(): void {
    this.cancelDebounce();
  }
}
