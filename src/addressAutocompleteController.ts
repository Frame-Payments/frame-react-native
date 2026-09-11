import { suggestAddresses, retrieveAddress, type AddressSuggestion } from './addressSearch';
import type { BillingAddress } from './types';

export const MINIMUM_QUERY_LENGTH = 2;

export const MAXIMUM_SUGGESTIONS = 3;

export const DEBOUNCE_MS = 80;

export interface AddressAutocompleteControllerOptions {
  onSuggestionsChange: (suggestions: ReadonlyArray<AddressSuggestion>) => void;
  debounceMs?: number;
  maximumSuggestions?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
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

  private debounceHandle: unknown = null;

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
        if (queryId !== this.latestQueryId) return;
        this.onSuggestionsChange(found);
      })();
    }, this.debounceMs);
  }

  async select(suggestion: AddressSuggestion): Promise<BillingAddress | null> {
    this.cancelDebounce();
    this.latestQueryId += 1;
    this.onSuggestionsChange([]);
    return this.retrieveAddr(suggestion);
  }

  clear(): void {
    this.cancelDebounce();
    this.latestQueryId += 1;
    this.onSuggestionsChange([]);
  }

  dispose(): void {
    this.cancelDebounce();
  }
}
