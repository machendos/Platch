import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorField, alsoUsedIn } from './ColorField';

/* The block loads the palette itself, so the endpoint is what the test
   supplies rather than a prop. */
const getColors = vi.fn();

vi.mock('../../../system/api.client', () => ({
  apiClient: { project: { colors: { getColors: () => getColors() } } },
  getConnection: () => ({ host: 'test' }),
}));

const COLORS = [
  { id: 'red', placement: 1, hexCode: '#e8503a', projects: [] },
  {
    id: 'blue',
    placement: 2,
    hexCode: '#4a6fd0',
    projects: [
      { id: 'p1', name: 'Kitchen' },
      { id: 'p2', name: 'Shed' },
      { id: 'p3', name: 'Garden' },
    ],
  },
];

const INHERITED_ID = 'red';

beforeEach(() => {
  getColors.mockReset();
  getColors.mockResolvedValue(COLORS);
});

/* Awaited, because the palette arrives from the endpoint a microtask after the
   render — asserting before that lands is what React's act() warning is
   about. */
/* The three cases are two independent props now: `editable` says whether the
   swatch can be pressed, and an inherited colour is what puts the "Unique
   color" checkbox on the row. */
const FREE = { editable: true, inheritedColorId: null };
const LOCKED = { editable: false, inheritedColorId: INHERITED_ID };
const OVERRIDABLE = { editable: true, inheritedColorId: INHERITED_ID };

const mount = async (
  { editable, inheritedColorId }: typeof FREE | typeof LOCKED,
  value: string | null = null,
  onChange = vi.fn(),
) => {
  await act(async () => {
    render(
      <ColorField
        ownColorId={value}
        onChange={onChange}
        editable={editable}
        inheritedColorId={inheritedColorId}
      />,
    );
  });

  return {
    onChange,
    inheritedColorId,
    chip: screen.getByRole('button', { name: 'Project color' }),
  };
};

/* Feeds an emitted value back in, which is the only way a controlled field's
   own state machine gets tested: asserting on what onChange was called with
   passes whether or not the component can live with the answer. */
const settle = async (
  value: string | null,
  {
    onChange,
    inheritedColorId,
  }: { onChange: Mock; inheritedColorId: string | null },
) => {
  await act(async () => {
    render(
      <ColorField
        ownColorId={value}
        onChange={onChange}
        editable
        inheritedColorId={inheritedColorId}
      />,
    );
  });
};

const palette = () => screen.queryByRole('listbox', { name: 'Project color' });

describe('free', () => {
  it('opens the palette and takes a colour', async () => {
    const user = userEvent.setup();
    const { onChange, chip } = await mount(FREE);

    expect(chip).toBeEnabled();
    await user.click(chip);

    await user.click(screen.getAllByRole('option')[1]);
    expect(onChange).toHaveBeenCalledWith('blue');
  });
});

describe('locked', () => {
  it('cannot be opened', async () => {
    const user = userEvent.setup();
    const { chip } = await mount(LOCKED);

    expect(chip).toBeDisabled();
    await user.click(chip);
    expect(palette()).not.toBeInTheDocument();
  });
});

describe('overridable', () => {
  /* The box is unticked and the swatch shows what it inherits. Pressable, and
     that is the point of the split: `editable` says whether this project may
     touch its colour at all, while the box says whether it has taken one of
     its own — so a project that may edit can open the palette either way. */
  it('starts inheriting, with the box unticked', async () => {
    const { chip } = await mount(OVERRIDABLE);

    expect(
      screen.getByRole('checkbox', { name: 'Unique color' }),
    ).not.toBeChecked();
    expect(chip).toBeEnabled();
  });

  /* Taking a colour of its own starts from the inherited one: it is always a
     legal answer, so the tick never leaves the field empty. */
  it('takes the inherited colour over when ticked', async () => {
    const user = userEvent.setup();
    const { onChange } = await mount(OVERRIDABLE);

    await user.click(screen.getByText('Unique color'));
    expect(onChange).toHaveBeenCalledWith(INHERITED_ID);
  });

  /* The tick seeds the inherited colour, so the value that comes back is equal
     to it — and the box has to survive its own answer. It did not: the state
     it emitted was one it then read as unticked, leaving an open palette under
     an empty box. */
  it('stays ticked once the colour it emitted comes back', async () => {
    const user = userEvent.setup();
    const mounted = await mount(OVERRIDABLE);

    await user.click(screen.getByText('Unique color'));
    cleanup();
    await settle(mounted.onChange.mock.calls[0][0] as string | null, mounted);

    expect(
      screen.getByRole('checkbox', { name: 'Unique color' }),
    ).toBeChecked();
  });

  /* Owning a colour is what the box says, not owning a *different* one: a
     project may deliberately keep its parent's colour as its own, and
     unticking then has a real effect to undo. */
  it('is ticked when its own colour matches the inherited one', async () => {
    await mount(OVERRIDABLE, INHERITED_ID);

    expect(
      screen.getByRole('checkbox', { name: 'Unique color' }),
    ).toBeChecked();
  });

  it('is pressable, and explains nothing, once it owns its colour', async () => {
    const { chip } = await mount(OVERRIDABLE, 'blue');

    expect(
      screen.getByRole('checkbox', { name: 'Unique color' }),
    ).toBeChecked();
    expect(chip).toBeEnabled();
  });

  it('goes back to inheriting when unticked', async () => {
    const user = userEvent.setup();
    const { onChange } = await mount(OVERRIDABLE, 'blue');

    await user.click(screen.getByText('Unique color'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('alsoUsedIn', () => {
  it('says nothing for a colour nobody else has', () => {
    expect(alsoUsedIn([])).toBeNull();
  });

  it('names one, and two, without a count', () => {
    expect(alsoUsedIn(['Kitchen'])).toBe('Also used in Kitchen');
    expect(alsoUsedIn(['Kitchen', 'Shed'])).toBe('Also used in Kitchen, Shed');
  });

  /* Past two, the rest becomes a number: naming every project would make the
     longest warning the one nobody reads. */
  it('names two and counts the rest', () => {
    expect(alsoUsedIn(['Kitchen', 'Shed', 'Garden', 'Loft'])).toBe(
      'Also used in Kitchen, Shed, +2',
    );
  });
});

describe('colours already in use', () => {
  it('marks the taken ones and leaves the free ones unmarked', async () => {
    const user = userEvent.setup();
    const { chip } = await mount(FREE);
    await user.click(chip);

    const [red, blue] = screen.getAllByRole('option');
    expect(red.className).not.toContain('color-option-taken');
    expect(blue.className).toContain('color-option-taken');
  });

  /* Sharing a colour is a choice, not a mistake — nothing may block it. */
  it('still lets a taken colour be picked', async () => {
    const user = userEvent.setup();
    const { onChange, chip } = await mount(FREE);
    await user.click(chip);

    await user.click(screen.getAllByRole('option')[1]);
    expect(onChange).toHaveBeenCalledWith('blue');
  });

  it('warns under the row once a shared colour is the value', async () => {
    await mount(FREE, 'blue');

    expect(
      screen.getByText('Also used in Kitchen, Shed, +1'),
    ).toBeInTheDocument();
  });

  it('says nothing when the chosen colour is free', async () => {
    await mount(FREE, 'red');

    expect(screen.queryByText(/^Also used in/)).not.toBeInTheDocument();
  });
});
