import { useCallback, useState } from "react";
import { ApiError } from "./http";

// Standard form error state, shared by every form screen.
//  - `error`       -> a form-level message for the <FormError> banner.
//  - `fieldErrors` -> per-field messages for <TextField error={...}>.
// `setFromError` reads a normalized ApiError: when the server returns 422 field
// errors we show those inline and skip the redundant banner; otherwise (network,
// 401, 409, 5xx, …) we show the readable message in the banner.
export function useFormErrors() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clear = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const setFromError = useCallback(
    (e: unknown, fallback = "Something went wrong. Please try again.") => {
      const err = e as ApiError;
      const fe = err?.fieldErrors ?? {};
      setFieldErrors(fe);
      setError(Object.keys(fe).length ? null : err?.message ?? fallback);
    },
    []
  );

  return { error, fieldErrors, setError, setFieldErrors, clear, setFromError };
}
