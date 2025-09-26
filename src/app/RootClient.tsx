'use client';
import { ReactNode, use } from 'react';
import { useRealViewportHeight } from '@/hooks/useRealViewportHeight';
import { loadPolyfills } from '@/polyfills';
import { ErrorBoundary } from './ErrorBoundary';

export function RootClient({ children }: { children: ReactNode }) {
  use(loadPolyfills());
  useRealViewportHeight();
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
