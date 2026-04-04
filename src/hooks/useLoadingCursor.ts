"use client";

import { useEffect } from "react";
import { startLoading, stopLoading } from "@/lib/loading-cursor";

export function useLoadingCursor(isLoading: boolean): void {
  useEffect(() => {
    if (isLoading) {
      startLoading();
    } else {
      stopLoading();
    }
    return () => stopLoading();
  }, [isLoading]);
}
