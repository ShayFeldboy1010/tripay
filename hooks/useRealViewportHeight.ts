"use client";

import { useEffect } from "react";

type Cleanup = () => void;

type DebouncedFn = ((...args: unknown[]) => void) & { cancel: () => void };

function debounce<T extends (...args: any[]) => void>(fn: T, wait: number): DebouncedFn {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      fn(...args);
    }, wait);
  }) as DebouncedFn;

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

export function useRealViewportHeight(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    const setViewportHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      const unit = height * 0.01;
      root.style.setProperty("--vh", `${unit}px`);
    };

    const update = debounce(setViewportHeight, 50);
    setViewportHeight();

    const cleanups: Cleanup[] = [];

    const handleResize = () => update();

    window.addEventListener("resize", handleResize);
    cleanups.push(() => window.removeEventListener("resize", handleResize));

    window.addEventListener("orientationchange", handleResize);
    cleanups.push(() => window.removeEventListener("orientationchange", handleResize));

    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener("resize", handleResize);
      cleanups.push(() => viewport.removeEventListener("resize", handleResize));

      viewport.addEventListener("scroll", handleResize);
      cleanups.push(() => viewport.removeEventListener("scroll", handleResize));
    }

    return () => {
      update.cancel();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);
}
