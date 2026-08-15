import { tags } from 'typia';

export type Uuid = string & tags.Format<'uuid'>;

export type DateString = string & tags.Format<'date'>;
export type TimeString = string &
  tags.Pattern<'^\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$'>;
export type DateTimeString = string &
  tags.Pattern<'^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,9})?)?$'>;
export type Int<
  Min extends number | undefined = undefined,
  Max extends number | undefined = undefined,
> = number &
  tags.Type<'int32'> &
  (Min extends number ? tags.Minimum<Min> : unknown) &
  (Max extends number ? tags.Maximum<Max> : unknown);
