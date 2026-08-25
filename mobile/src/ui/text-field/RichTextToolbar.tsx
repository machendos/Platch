import './RichTextToolbar.css';

import { Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useVisualViewportTop } from '../../system/viewport/useVisualViewportTop';
import { useActiveField } from './richText/activeField';
import { TOOLBAR_GROUPS, type Control } from './richText/toolbarControls';
import { useToolbarMarks, type Marks } from './richText/useToolbarMarks';

const ToolbarButton = ({
  control,
  marks,
  onPress,
}: {
  control: Control;
  marks: Marks;
  onPress: () => void;
}) => {
  const active = control.isActive?.(marks) ?? false;

  return (
    <button
      className={
        active
          ? 'rich-toolbar-button rich-toolbar-button-active'
          : 'rich-toolbar-button'
      }
      type="button"
      aria-label={control.label}
      aria-pressed={control.isActive ? active : undefined}
      // The editor must keep the selection the command is about to act on.
      // Without this the button takes focus, the selection collapses, and the
      // command has nothing left to apply to.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
    >
      {control.icon}
    </button>
  );
};

/* One toolbar for the whole form, bound to whichever formatted field has
   focus. It answers three questions and nothing else: what to draw
   (toolbarControls), what is currently on (useToolbarMarks), and where to put
   it (the rail in RichTextToolbar.css). */
export const RichTextToolbar = () => {
  const { active } = useActiveField();
  const marks = useToolbarMarks(active?.editor ?? null);

  // iOS pans the page to lift the caret above the keyboard, which moves the
  // container the toolbar sticks inside. The rail's ceiling reads this, and it
  // has to be measured from this field's own container — a sheet's ion-content
  // does not begin where the screen does.
  useVisualViewportTop(active?.shell ?? null);

  if (!active) return null;

  return createPortal(
    <div className="rich-toolbar-rail">
      <div className="rich-toolbar" role="toolbar" aria-label="Formatting">
        {TOOLBAR_GROUPS.map((group, index) => (
          <Fragment key={group[0].label}>
            {index > 0 && (
              <span className="rich-toolbar-divider" aria-hidden="true" />
            )}

            {group.map((control) => (
              <ToolbarButton
                key={control.label}
                control={control}
                marks={marks}
                onPress={() => {
                  active.editor.focus();
                  control.press(active.editor, marks);
                }}
              />
            ))}
          </Fragment>
        ))}
      </div>
    </div>,
    // Into the focused field, so the bar is positioned against the thing it is
    // editing and travels with it.
    active.shell,
  );
};
