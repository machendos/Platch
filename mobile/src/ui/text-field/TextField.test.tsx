import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field, type FieldProps } from './Field';

const Harness = ({
  initial = '',
  ...props
}: Partial<FieldProps> & { initial?: string }) => {
  const [value, setValue] = useState(initial);

  return <Field label="Name" value={value} onChange={setValue} {...props} />;
};

const field = () => screen.getByLabelText('Name');
const replica = () =>
  document.querySelector('.field-body')?.getAttribute('data-replicated-value');

describe('Field', () => {
  it('inserts a newline when newlines are allowed', async () => {
    const user = userEvent.setup();
    render(<Harness allowNewlines initial="one" />);

    await user.click(field());
    await user.keyboard('{Enter}two');

    expect(field()).toHaveValue('one\ntwo');
  });

  it('swallows the newline and blurs when newlines are not allowed', async () => {
    const user = userEvent.setup();
    render(<Harness allowNewlines={false} initial="one" />);

    await user.click(field());
    expect(field()).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(field()).toHaveValue('one');
    expect(field()).not.toHaveFocus();
  });

  it('hands Enter to onEnter instead of blurring when one is given', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(<Harness allowNewlines={false} onEnter={onEnter} initial="one" />);

    await user.click(field());
    await user.keyboard('{Enter}');

    expect(onEnter).toHaveBeenCalledOnce();
    expect(field()).toHaveValue('one');
    expect(field()).toHaveFocus();
  });

  it('labels the return key only where Enter ends the edit', () => {
    const { unmount } = render(<Harness allowNewlines={false} />);
    expect(field()).toHaveAttribute('enterkeyhint', 'done');
    unmount();

    render(<Harness allowNewlines />);
    expect(field()).not.toHaveAttribute('enterkeyhint');
  });

  it('mirrors the value into the replica the box is sized from', async () => {
    const user = userEvent.setup();
    render(<Harness initial="one" />);

    expect(replica()).toBe('one');

    await user.click(field());
    await user.keyboard('{Enter}two');

    expect(replica()).toBe('one\ntwo');
  });
});
