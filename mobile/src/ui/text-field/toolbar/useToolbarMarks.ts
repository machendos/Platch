import { useEffect, useState } from 'react';
import { NO_MARKS, type EditorAdapter, type Marks } from './adapter';

export const useToolbarMarks = (adapter: EditorAdapter | null): Marks => {
  const [marks, setMarks] = useState<Marks>(NO_MARKS);

  useEffect(() => {
    if (!adapter) {
      setMarks(NO_MARKS);
      return;
    }

    const read = () => setMarks(adapter.readMarks());
    read();
    return adapter.subscribe(read);
  }, [adapter]);

  return marks;
};
