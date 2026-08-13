type DateFrameInputProps = {
  /** Both ends of the visible range, already serialized. */
  serializedRange: string;
  ref?: React.Ref<HTMLButtonElement>;
};

export const DateFrameInput = ({
  serializedRange,
  ref,
}: DateFrameInputProps) => (
  <button className="header-range-input" ref={ref} type="button">
    <span>{serializedRange}</span>
  </button>
);
