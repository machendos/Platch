import './ConsequenceLine.css';

type ConsequenceLineProps = {
  /* Indented to the depth the project would land at, so the line says which
     parent it is about to belong to and not merely where it will sit. */
  depth?: number;
};

export const ConsequenceLine = ({ depth = 0 }: ConsequenceLineProps) => (
  <div
    className="consequence-line"
    style={{ marginInlineStart: `calc(var(--project-indent-step) * ${depth})` }}
    aria-hidden="true"
  />
);
