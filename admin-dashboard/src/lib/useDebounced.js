import { useEffect, useState } from 'react';

// Returns `value` after it has stopped changing for `delay` ms. Used to avoid
// firing a query on every keystroke in search boxes.
export default function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
