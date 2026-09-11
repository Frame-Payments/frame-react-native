import { useCallback, useEffect, useRef, useState } from 'react';
import { AddressAutocompleteController } from '../../addressAutocompleteController';
import type { AddressSuggestion } from '../../addressSearch';
import type { BillingAddress } from '../../types';

export interface UseAddressAutocompleteResult {
  suggestions: ReadonlyArray<AddressSuggestion>;
  queryChanged: (query: string, countryCode: string | undefined) => void;
  select: (suggestion: AddressSuggestion) => Promise<BillingAddress | null>;
  clear: () => void;
}

export function useAddressAutocomplete(): UseAddressAutocompleteResult {
  const [suggestions, setSuggestions] = useState<ReadonlyArray<AddressSuggestion>>([]);

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

  useEffect(() => {
    return () => controllerRef.current?.dispose();
  }, []);

  return { suggestions, queryChanged, select, clear };
}
