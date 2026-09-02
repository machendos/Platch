import {
  SegmentedControl,
  SegmentedOption,
} from '../../../ui/segmented-control/SegmentedControl';

export enum ProjectStatus {
  'ACTIVE' = 'ACTIVE',
  'BACKLOG' = 'BACKLOG',
}

const STATUS_OPTIONS: SegmentedOption<ProjectStatus>[] = [
  { value: ProjectStatus.ACTIVE, label: 'Active' },
  { value: ProjectStatus.BACKLOG, label: 'Backlog' },
];

export const ProjectStatusSwitch = (params: {
  currentValue: ProjectStatus;
  onChange: (value: ProjectStatus) => void;
}) => {
  return (
    <SegmentedControl
      className="create-project-status"
      options={STATUS_OPTIONS}
      value={params.currentValue}
      onChange={(status) => params.onChange(status)}
      label="Project status"
    />
  );
};
