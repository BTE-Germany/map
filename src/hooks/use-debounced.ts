import { useEffect, useState } from "react";

/**
 * Mirrors `value`, but only after it has stayed unchanged for `delay` ms.
 *
 * Used to keep keystrokes out of network calls: the input stays instant while
 * whatever is derived from the debounced value fires once the typing stops.
 */
export function useDebounced<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const handle = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handle);
    }, [value, delay]);

    return debounced;
}
