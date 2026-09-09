import {
  SegmentedControl,
  SegmentedOption,
} from '../../../ui/segmented-control/SegmentedControl';

/* Who fixed the time, which is a question the user can answer without
   thinking — they know what they are writing down. Asking it instead of
   asking about time zones is the whole point: "is this a call or my own
   routine" needs no modelling, while "should the clock time follow you across
   time zones" cannot be answered without imagining a trip.

   EXTERNAL is anything whose moment was set outside the user — a call, an
   appointment, a class, a broadcast. INTERNAL is everything they set
   themselves. The tell is not whether other people are involved but who chose
   the hour: a gym *class* is external, going to the gym is internal. */
export enum ProjectType {
  'EXTERNAL' = 'EXTERNAL',
  'INTERNAL' = 'INTERNAL',
}

const TYPE_OPTIONS: SegmentedOption<ProjectType>[] = [
  { value: ProjectType.EXTERNAL, label: 'External' },
  { value: ProjectType.INTERNAL, label: 'Internal' },
];

export const ProjectTypeSwitch = (params: {
  currentValue: ProjectType;
  onChange: (value: ProjectType) => void;
}) => {
  return (
    <SegmentedControl
      className="project-form-type"
      options={TYPE_OPTIONS}
      value={params.currentValue}
      onChange={(type) => params.onChange(type)}
      label="Project type"
    />
  );
};
