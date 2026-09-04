import './ConsequenceLine.css';

type ConsequenceLineProps = {
  top: number;
  depth: number;
};

export const ConsequenceLine = ({ top, depth }: ConsequenceLineProps) => (
  <div
    className="consequence-line"
    style={{
      transform: `translateY(${top}px)`,
      marginInlineStart: `calc(var(--project-indent-step) * ${depth})`,
    }}
    aria-hidden="true"
  />
);
