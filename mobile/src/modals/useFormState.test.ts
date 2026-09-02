import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useFormState } from './useFormState';

const OPENED = { name: 'Rebuild the shed', goal: 'Roof on', context: '' };

const open = () => renderHook(() => useFormState(OPENED));

describe('useFormState', () => {
  it('opens clean', () => {
    expect(open().result.current.isDirty).toBe(false);
  });

  it('is dirty once a value differs', () => {
    const { result } = open();
    act(() => result.current.set({ goal: 'Roof on before the rain' }));

    expect(result.current.isDirty).toBe(true);
    expect(result.current.values.goal).toBe('Roof on before the rain');
    expect(result.current.values.name).toBe(OPENED.name);
  });

  /* The property that makes this a comparison rather than a change counter:
     typing something and taking it back leaves nothing to discard, so closing
     must not ask. */
  it('is clean again when a change is undone by hand', () => {
    const { result } = open();
    act(() => result.current.set({ name: 'Rebuild the shed!' }));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.set({ name: OPENED.name }));
    expect(result.current.isDirty).toBe(false);
  });

  it('notices a field that started empty', () => {
    const { result } = open();
    act(() => result.current.set({ context: '- [ ] Order the felt' }));

    expect(result.current.isDirty).toBe(true);
  });

  it('reset returns the opening values and goes clean', () => {
    const { result } = open();
    act(() => result.current.set({ goal: 'something else' }));
    act(() => result.current.reset());

    expect(result.current.values).toEqual(OPENED);
    expect(result.current.isDirty).toBe(false);
  });

  /* Saving makes the current values the new baseline, so closing straight
     after a save does not offer to discard what was just written. */
  it('is clean after markSaved, against the new values', () => {
    const { result } = open();
    act(() => result.current.set({ goal: 'Roof on before the rain' }));
    act(() => result.current.markSaved());

    expect(result.current.isDirty).toBe(false);
    expect(result.current.values.goal).toBe('Roof on before the rain');

    // And going back to what it originally opened with is now a change.
    act(() => result.current.set({ goal: OPENED.goal }));
    expect(result.current.isDirty).toBe(true);
  });

  /* The opening values are captured once, so a form left open does not quietly
     re-baseline itself against whatever it currently holds. */
  it('keeps comparing against what it opened with', () => {
    const { result, rerender } = open();
    act(() => result.current.set({ goal: 'edited' }));
    rerender();

    expect(result.current.isDirty).toBe(true);
  });
});
