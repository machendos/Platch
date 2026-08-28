import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { EditorAdapter } from './adapter';

export type ActiveField = {
  adapter: EditorAdapter;
  shell: HTMLElement;
};

type ActiveFieldValue = {
  active: ActiveField | null;
  setActive: (field: ActiveField | null) => void;
};

/* Null default rather than a thrown error: a formatted field must still work
   when nothing wrapped it in a provider. It simply has no toolbar then, which
   is the right outcome for a field rendered outside a form. */
const ActiveFieldContext = createContext<ActiveFieldValue>({
  active: null,
  setActive: () => {},
});

export const useActiveField = () => useContext(ActiveFieldContext);

export const ActiveFieldProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<ActiveField | null>(null);
  const value = useMemo(() => ({ active, setActive }), [active]);

  return (
    <ActiveFieldContext.Provider value={value}>
      {children}
    </ActiveFieldContext.Provider>
  );
};
