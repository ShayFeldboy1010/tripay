'use client';
import { ReactNode, use } from 'react';
import { loadPolyfills } from '@/polyfills';
import { ErrorBoundary } from './ErrorBoundary';

export function RootClient({ children }: { children: ReactNode }) {
  use(loadPolyfills());
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
