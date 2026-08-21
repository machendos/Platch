import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox, type CheckboxProps } from './Checkbox';

const Harness = ({
  initial = false,
  ...props
}: Partial<CheckboxProps> & { initial?: boolean }) => {
  const [checked, setChecked] = useState(initial);

  return (
    <Checkbox
      label="Dividable"
      checked={checked}
      onChange={setChecked}
      {...props}
    />
  );
};

const box = () => screen.getByRole('checkbox', { name: 'Dividable' });

describe('Checkbox', () => {
  it('ticks when the label text is clicked, not only the box', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByText('Dividable'));

    expect(box()).toBeChecked();
  });

  it('ticks on the space key', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.tab();
    expect(box()).toHaveFocus();

    await user.keyboard(' ');

    expect(box()).toBeChecked();
  });

  it('reports the new state to the caller', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkbox label="Dividable" checked={false} onChange={onChange} />);

    await user.click(box());

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('follows the checked prop rather than its own state', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox label="Dividable" checked={false} onChange={onChange} />,
    );
    expect(box()).not.toBeChecked();

    rerender(<Checkbox label="Dividable" checked onChange={onChange} />);

    expect(box()).toBeChecked();
  });

  it('neither ticks nor takes focus while disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Checkbox
        label="Dividable"
        checked={false}
        onChange={onChange}
        disabled
      />,
    );

    await user.click(screen.getByText('Dividable'));

    expect(onChange).not.toHaveBeenCalled();
    expect(box()).not.toBeChecked();
    expect(box()).not.toHaveFocus();
  });
});
