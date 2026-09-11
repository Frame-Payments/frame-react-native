
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { AddressAutocompleteController } from '../addressAutocompleteController';
import type { AddressSuggestion } from '../addressSearch';

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

    expect(timers.pendingCount()).toBe(1);

    timers.flush();
    await flushMicrotasks();

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('1 Main St', 'US', expect.any(Number));
  });

  it('a request already in flight is never cancelled by a new keystroke', async () => {
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

    expect(onChange).toHaveBeenLastCalledWith([suggestion('b')]);

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

    resolveSearch([suggestion('late')]);
    await flushMicrotasks();

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
