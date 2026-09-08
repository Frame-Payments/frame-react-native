import { useCallback, useEffect, useRef, useState } from 'react';
import { AddressAutocompleteController } from '../../addressAutocompleteController';
import type { AddressSuggestion } from '../../addressSearch';
import type { BillingAddress } from '../../types';

// Thin React wrapper around AddressAutocompleteController — see that module
// for the actual debounce/query-ordering state machine and why it is kept
// plain (no React) rather than inlined here.

export interface UseAddressAutocompleteResult {
  suggestions: ReadonlyArray<AddressSuggestion>;
  /** Call on every keystroke in the address field. */
  queryChanged: (query: string, countryCode: string | undefined) => void;
  /** Resolves a picked suggestion, or null if it cannot be resolved. */
  select: (suggestion: AddressSuggestion) => Promise<BillingAddress | null>;
  /** Clears the list without sending anything, for dismissing on blur. */
  clear: () => void;
}

export function useAddressAutocomplete(): UseAddressAutocompleteResult {
  const [suggestions, setSuggestions] = useState<ReadonlyArray<AddressSuggestion>>([]);

  // One controller instance for the lifetime of the field. A ref (not state)
  // since it's a stable, mutable object the render never needs to react to
  // directly — only its reported `suggestions` do.
  const controllerRef = useRef<AddressAutocompleteController | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = new AddressAutocompleteController({
      onSuggestionsChange: setSuggestions,
    });
  }

  const queryChanged = useCallback((query: string, countryCode: string | undefined) => {
    controllerRef.current?.queryChanged(query, countryCode);
  }, []);

  const select = useCallback((suggestion: AddressSuggestion) => {
    return controllerRef.current?.select(suggestion) ?? Promise.resolve(null);
  }, []);

  const clear = useCallback(() => {
    controllerRef.current?.clear();
  }, []);

  // Cancel any pending debounce on unmount so it doesn't fire a setState after
  // the component is gone.
  useEffect(() => {
    return () => controllerRef.current?.dispose();
  }, []);

  return { suggestions, queryChanged, select, clear };
}
