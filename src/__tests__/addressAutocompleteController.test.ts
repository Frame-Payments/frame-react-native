/**
 * Unit tests for the address-autocomplete debounce/query-ordering state
 * machine. Timers and network are injected — no real time, no real
 * suggestAddresses/retrieveAddress — so out-of-order responses and debounce
 * cancellation can be driven deterministically.
 */

// addressAutocompleteController.ts imports addressSearch.ts, which transitively
// imports client.ts for the (unused, since search/retrieve are injected below)
// default network path — that chain reaches `react-native` unmocked. Every
// test here injects its own search/retrieve, so a minimal Platform stub is all
// that's needed to let the module load.
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { AddressAutocompleteController } from '../addressAutocompleteController';
import type { AddressSuggestion } from '../addressSearch';

// A controllable fake for setTimeout/clearTimeout: `flush()` runs every timer
// currently scheduled, in the order they were set, without advancing real
// time or requiring jest's fake-timer machinery (which fights with the
// controller's real `void (async () => {...})()` microtask chains).
function fakeTimers() {
  let nextHandle = 1;
  const pending = new Map<number, () => void>();
  return {
    setTimer: (fn: () => void): number => {
      const handle = nextHandle++;
      pending.set(handle, fn);
      return handle;
    },
    clearTimer: (handle: unknown): void => {
      pending.delete(handle as number);
    },
    pendingCount: () => pending.size,
    // Fires every timer currently pending. Timers a fired callback schedules
    // are NOT run by this call — the test drives those with another flush(),
    // mirroring how a real debounce settles one tick at a time.
    flush: () => {
      const fns = [...pending.values()];
      pending.clear();
      for (const fn of fns) fn();
    },
  };
}

function suggestion(id: string): AddressSuggestion {
  return { id, title: id, subtitle: '' };
}

describe('AddressAutocompleteController.queryChanged', () => {
  it('does nothing below the minimum query length', () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    const search = jest.fn();
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('a', 'US');
    expect(onChange).toHaveBeenCalledWith([]);
    expect(timers.pendingCount()).toBe(0);
    expect(search).not.toHaveBeenCalled();
  });

  it('debounces: only the last keystroke in a burst schedules a search', async () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    const search = jest.fn(async () => [suggestion('a')]);
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('1 Main', 'US');
    controller.queryChanged('1 Main S', 'US');
    controller.queryChanged('1 Main St', 'US');

    // Only one timer should still be pending — each new keystroke cancels the
    // previous wait rather than stacking another one.
    expect(timers.pendingCount()).toBe(1);

    timers.flush();
    await flushMicrotasks();

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('1 Main St', 'US', expect.any(Number));
  });

  it('a request already in flight is never cancelled by a new keystroke', async () => {
    // Only the WAIT is cancellable. A search that already reached "the
    // network" must be allowed to finish — killing it is what would force the
    // user to stop typing before any list could ever appear.
    const timers = fakeTimers();
    const onChange = jest.fn();
    let resolveFirst!: (v: AddressSuggestion[]) => void;
    const search = jest
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async () => [suggestion('second')]);
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('first query', 'US');
    timers.flush(); // fires the debounce, "first query" search starts

    controller.queryChanged('second query', 'US');
    timers.flush(); // fires the debounce, "second query" search starts too

    expect(search).toHaveBeenCalledTimes(2);

    // The stale first search finally resolves. Its own query id is no longer
    // the latest, so it must not overwrite the list with stale results.
    resolveFirst([suggestion('first')]);
    await flushMicrotasks();
    expect(onChange).not.toHaveBeenCalledWith([suggestion('first')]);
  });

  it('discards a stale response that resolves after a newer query has been issued', async () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    let resolveFirst!: (v: AddressSuggestion[]) => void;
    const search = jest
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(async () => [suggestion('b')]);
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('a query', 'US');
    timers.flush();
    controller.queryChanged('b query', 'US');
    timers.flush();
    await flushMicrotasks();

    // "b query"'s response landed (search #2 resolves synchronously via
    // async), so the list should show b's result.
    expect(onChange).toHaveBeenLastCalledWith([suggestion('b')]);

    // Now the slow first response finally arrives — it must be discarded,
    // not overwrite b's result.
    resolveFirst([suggestion('a')]);
    await flushMicrotasks();
    expect(onChange).toHaveBeenLastCalledWith([suggestion('b')]);
  });

  it('applies the result of the only query when nothing else interrupts it', async () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    const search = jest.fn(async () => [suggestion('only')]);
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('123 Main St', 'US');
    timers.flush();
    await flushMicrotasks();

    expect(onChange).toHaveBeenLastCalledWith([suggestion('only')]);
  });

  it('trims whitespace before checking the minimum length', () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    const search = jest.fn();
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('  a  ', 'US');
    expect(onChange).toHaveBeenCalledWith([]);
    expect(timers.pendingCount()).toBe(0);
  });

  it('sends the trimmed query to search, not the raw input', async () => {
    const timers = fakeTimers();
    const search = jest.fn(async () => []);
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: jest.fn(),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('  123 Main St  ', 'US');
    timers.flush();
    await flushMicrotasks();

    expect(search).toHaveBeenCalledWith('123 Main St', 'US', expect.any(Number));
  });
});

describe('AddressAutocompleteController.select', () => {
  it('clears the list and cancels any pending debounce', () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: jest.fn() as never,
      retrieve: jest.fn(async () => null) as never,
    });

    controller.queryChanged('123 Main St', 'US');
    expect(timers.pendingCount()).toBe(1);

    void controller.select(suggestion('a'));
    expect(timers.pendingCount()).toBe(0);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('returns whatever retrieve resolves to', async () => {
    const timers = fakeTimers();
    const address = { postalCode: '78701', city: 'Austin' };
    const retrieve = jest.fn(async () => address);
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: jest.fn(),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: jest.fn() as never,
      retrieve: retrieve as never,
    });

    const result = await controller.select(suggestion('a'));
    expect(result).toBe(address);
    expect(retrieve).toHaveBeenCalledWith(suggestion('a'));
  });

  it('retires any in-flight search — a late response cannot repopulate the dismissed list', async () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    let resolveSearch!: (v: AddressSuggestion[]) => void;
    const search = jest.fn(() => new Promise((resolve) => { resolveSearch = resolve; }));
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
      retrieve: jest.fn(async () => null) as never,
    });

    controller.queryChanged('123 Main St', 'US');
    timers.flush(); // search is now in flight

    void controller.select(suggestion('picked'));
    expect(onChange).toHaveBeenLastCalledWith([]);

    // The in-flight search from before the pick finally resolves.
    resolveSearch([suggestion('late')]);
    await flushMicrotasks();

    // Must not have repopulated the list the user already dismissed by picking.
    expect(onChange).not.toHaveBeenCalledWith([suggestion('late')]);
  });
});

describe('AddressAutocompleteController.clear', () => {
  it('empties the list and cancels a pending debounce without searching', () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    const search = jest.fn();
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('123 Main St', 'US');
    controller.clear();

    expect(timers.pendingCount()).toBe(0);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('retires an in-flight search the same way select does', async () => {
    const timers = fakeTimers();
    const onChange = jest.fn();
    let resolveSearch!: (v: AddressSuggestion[]) => void;
    const search = jest.fn(() => new Promise((resolve) => { resolveSearch = resolve; }));
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: onChange,
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('123 Main St', 'US');
    timers.flush();
    controller.clear();

    resolveSearch([suggestion('late')]);
    await flushMicrotasks();

    expect(onChange).not.toHaveBeenCalledWith([suggestion('late')]);
  });
});

describe('AddressAutocompleteController.dispose', () => {
  it('cancels a pending debounce so it never fires after disposal', () => {
    const timers = fakeTimers();
    const search = jest.fn();
    const controller = new AddressAutocompleteController({
      onSuggestionsChange: jest.fn(),
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer,
      search: search as never,
    });

    controller.queryChanged('123 Main St', 'US');
    expect(timers.pendingCount()).toBe(1);

    controller.dispose();
    expect(timers.pendingCount()).toBe(0);

    timers.flush();
    expect(search).not.toHaveBeenCalled();
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
