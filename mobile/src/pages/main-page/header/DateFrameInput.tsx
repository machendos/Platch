import { ChevronDown } from 'lucide-react';
import { TextButton } from '../../../ui/buttons/text-button/TextButton';
import { useFittedLabel } from './useFittedLabel';

/* Mobiscroll's anchor. It hands the ref down to whatever it is given, so the
   picker positions against the real button rather than a wrapper. */

type DateFrameInputProps = {
  /** Both ends of the visible range, already serialized. */
  serializedRange: string;
  /** The two shapes the serializer produces, and the two widths the box has.
      Chosen the moment the range changes, so the box is already the right size
      before anything is measured. */
  isSingleDay: boolean;
  ref?: React.Ref<HTMLButtonElement>;
};

export const DateFrameInput = ({
  serializedRange,
  isSingleDay,
  ref,
}: DateFrameInputProps) => {
  const fitted = useFittedLabel(
    serializedRange,
    isSingleDay ? '--header-range-width-day' : '--header-range-width-span',
  );

  return (
    <TextButton
      size="large"
      ref={ref}
      onClick={() => {}}
      trailing={<ChevronDown />}
      /* No press state: the answer to this tap is the picker opening over it,
         and a spring underneath that is a second reply to the same tap. */
      animate={false}
      labelRef={fitted.ref}
      labelStyle={
        fitted.fontPx === null ? undefined : { fontSize: `${fitted.fontPx}px` }
      }
      style={
        fitted.widthPx === null ? undefined : { width: `${fitted.widthPx}px` }
      }
      className={[
        'header-range-input',
        isSingleDay ? 'header-range-input-day' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {serializedRange}
    </TextButton>
  );
};
