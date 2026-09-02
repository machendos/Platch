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

  /* The bug this exists for: a closed reveal is invisible by opacity, which
     does not stop hit-testing, and a third-party subtree can re-enable
     pointer-events and visibility on its own elements — a closed inline
     calendar was catching taps aimed at controls drawn below it. */
  it('is inert while closed, and only while closed', async () => {
    const { rerender } = render(
      <Reveal when={false} keepMounted>
        <p>revealed</p>
      </Reveal>,
    );

    expect(wrapper()).toHaveAttribute('inert');

    rerender(
      <Reveal when keepMounted>
        <p>revealed</p>
      </Reveal>,
    );

    await waitFor(() => expect(wrapper()).not.toHaveAttribute('inert'));
  });

  /* Including on the way out: the content is still laid out through the exit,
     so it must stop taking taps the moment it starts leaving rather than when
     it finishes. */
  it('goes inert as soon as it starts closing', async () => {
    const { rerender } = render(
      <Reveal when keepMounted>
        <p>revealed</p>
      </Reveal>,
    );

    rerender(
      <Reveal when={false} keepMounted>
        <p>revealed</p>
      </Reveal>,
    );

    await waitFor(() => expect(wrapper()).toHaveAttribute('inert'));
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
