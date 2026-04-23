"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "aa.motion.reduced";

/**
 * Returns true when either:
 *   - the OS `prefers-reduced-motion: reduce` media query matches, AND no
 *     in-app override has disabled that preference, OR
 *   - an explicit in-app override is stored in localStorage (`true`).
 *
 * An override of `false` force-enables motion even if the OS says reduce.
 * Missing override → follow OS.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const osPref = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      const override = window.localStorage.getItem(STORAGE_KEY);
      if (override === "true") return true;
      if (override === "false") return false;
      return osPref.matches;
    };
    setReduced(read());

    const onChange = () => setReduced(read());
    osPref.addEventListener("change", onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setReduced(read());
    };
    window.addEventListener("storage", onStorage);

    return () => {
      osPref.removeEventListener("change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return reduced;
}
