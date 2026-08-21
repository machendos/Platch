import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Reveal } from './Reveal';

const content = () => screen.queryByText('revealed');
const wrapper = () => document.querySelector('.reveal');

describe('Reveal', () => {
  it('renders nothing at all while the condition is false', () => {
    render(
      <Reveal when={false}>
        <p>revealed</p>
      </Reveal>,
    );

    expect(content()).toBeNull();
    expect(wrapper()).toBeNull();
  });

  it('mounts the content as soon as the condition turns true', () => {
    const { rerender } = render(
      <Reveal when={false}>
        <p>revealed</p>
      </Reveal>,
    );

    rerender(
      <Reveal when>
        <p>revealed</p>
      </Reveal>,
    );

    expect(content()).toBeInTheDocument();
  });

  it('keeps the content mounted for the exit, then takes it away', async () => {
    const { rerender } = render(
      <Reveal when>
        <p>revealed</p>
      </Reveal>,
    );

    rerender(
      <Reveal when={false}>
        <p>revealed</p>
      </Reveal>,
    );
    expect(content()).toBeInTheDocument();

    await waitFor(() => expect(content()).toBeNull());
  });

  it('starts open, without a first frame spent animating in', () => {
    render(
      <Reveal when>
        <p>revealed</p>
      </Reveal>,
    );

    expect(wrapper()).toHaveClass('reveal-open', 'reveal-settled');
  });

  it('collapses along the axis it is given', () => {
    render(
      <Reveal when axis="inline">
        <p>revealed</p>
      </Reveal>,
    );

    expect(wrapper()).toHaveClass('reveal-inline');
  });
});
