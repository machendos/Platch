import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useEntityForm } from './useEntityForm';
import type { SectionReport } from './useEntityForm';

const OPENED = { name: 'Rebuild the shed', goal: 'Roof on', context: '' };

const open = (reports: (SectionReport | null)[] = [], onDismiss = vi.fn()) =>
  renderHook(() =>
    useEntityForm({ initialValues: OPENED, reports, onDismiss }),
  );

describe('scalar values', () => {
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

  /* The opening values are captured once, so a form left open does not quietly
     re-baseline itself against whatever it currently holds. */
  it('keeps comparing against what it opened with', () => {
    const { result, rerender } = open();
    act(() => result.current.set({ goal: 'edited' }));
    rerender();

    expect(result.current.isDirty).toBe(true);
  });
});

describe('block reports', () => {
  it('is dirty when a block is, with the fields untouched', () => {
    const { result } = open([{ isDirty: true, isValid: true }]);

    expect(result.current.isDirty).toBe(true);
  });

  /* A block that has not reported yet has nothing to say about itself, so only
     an explicit false refuses the save — that is what lets a form open
     savable. */
  it('may be saved while a block has not reported', () => {
    expect(open([null]).result.current.canSave).toBe(true);
  });

  it('cannot be saved while any block reports invalid', () => {
    const { result } = open([
      { isDirty: true, isValid: true },
      { isDirty: false, isValid: false },
    ]);

    expect(result.current.canSave).toBe(false);
  });
});

describe('saving', () => {
  it('dismisses once the submit resolves', async () => {
    const onDismiss = vi.fn();
    const { result } = open([], onDismiss);

    await act(async () => {
      await result.current.save(async () => {});
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  /* The blocks keep baselines of their own, so a saved form has to stop
     reporting dirty by latching rather than by re-baselining — otherwise the
     sheet offers to discard what it just wrote. */
  it('is clean after a save even while a block still reports dirty', async () => {
    const { result } = open([{ isDirty: true, isValid: true }]);
    expect(result.current.isDirty).toBe(true);

    await act(async () => {
      await result.current.save(async () => {});
    });

    expect(result.current.isDirty).toBe(false);
  });

  it('stays open and stays dirty when the submit fails', async () => {
    const onDismiss = vi.fn();
    const { result } = open([], onDismiss);
    act(() => result.current.set({ goal: 'edited' }));

    await act(async () => {
      await result.current
        .save(async () => {
          throw new Error('nope');
        })
        .catch(() => {});
    });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(result.current.isDirty).toBe(true);
    expect(result.current.canSave).toBe(true);
  });
});
