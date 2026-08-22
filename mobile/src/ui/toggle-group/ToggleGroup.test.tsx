import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleGroup } from './ToggleGroup';
import type { ToggleGroupProps } from './ToggleGroup';

type Weekday = 'MO' | 'TU' | 'WE';

const OPTIONS = [
  { value: 'MO' as const, label: 'Mo' },
  { value: 'TU' as const, label: 'Tu' },
  { value: 'WE' as const, label: 'We' },
];

const Harness = ({
  initial = [],
  ...props
}: Partial<ToggleGroupProps<Weekday>> & { initial?: Weekday[] }) => {
  const [values, setValues] = useState<Weekday[]>(initial);

  return (
    <ToggleGroup
      label="Days"
      options={OPTIONS}
      values={values}
      onChange={setValues}
      {...props}
    />
  );
};

const day = (name: string) => screen.getByRole('button', { name });

describe('ToggleGroup', () => {
  it('holds several values at once', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(day('Mo'));
    await user.click(day('We'));

    expect(day('Mo')).toHaveAttribute('aria-pressed', 'true');
    expect(day('We')).toHaveAttribute('aria-pressed', 'true');
    expect(day('Tu')).toHaveAttribute('aria-pressed', 'false');
  });

  it('turns a value off again', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['TU']} />);

    await user.click(day('Tu'));

    expect(day('Tu')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the set in option order, not the order it was picked in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ToggleGroup
        label="Days"
        options={OPTIONS}
        values={['WE']}
        onChange={onChange}
      />,
    );

    await user.click(day('Mo'));

    expect(onChange).toHaveBeenCalledWith(['MO', 'WE']);
  });

  it('has no select-all unless one is asked for', () => {
    render(<Harness />);

    expect(screen.queryByRole('button', { name: 'All' })).toBeNull();
  });

  it('select-all turns every option on, and off once they all are', async () => {
    const user = userEvent.setup();
    render(<Harness selectAllLabel="All" />);

    await user.click(day('All'));

    for (const name of ['Mo', 'Tu', 'We']) {
      expect(day(name)).toHaveAttribute('aria-pressed', 'true');
    }
    expect(day('All')).toHaveAttribute('aria-pressed', 'true');

    await user.click(day('All'));

    for (const name of ['Mo', 'Tu', 'We']) {
      expect(day(name)).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('select-all reads as pressed once the last option is picked by hand', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['MO', 'TU']} selectAllLabel="All" />);

    expect(day('All')).toHaveAttribute('aria-pressed', 'false');

    await user.click(day('We'));

    expect(day('All')).toHaveAttribute('aria-pressed', 'true');
  });

  it('follows the values prop rather than its own state', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ToggleGroup
        label="Days"
        options={OPTIONS}
        values={[]}
        onChange={onChange}
      />,
    );
    expect(day('Mo')).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <ToggleGroup
        label="Days"
        options={OPTIONS}
        values={['MO']}
        onChange={onChange}
      />,
    );

    expect(day('Mo')).toHaveAttribute('aria-pressed', 'true');
  });
});
