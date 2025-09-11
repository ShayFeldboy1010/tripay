'use client';
import React from 'react';

interface State { hasError: boolean; incidentId?: string }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const incidentId = Math.random().toString(36).slice(2);
    // Log first error and stack
    console.error('[ErrorBoundary]', incidentId, error, info.componentStack);
    this.setState({ incidentId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4">
          <p>Something went wrong. Please refresh the page.</p>
          {this.state.incidentId && (
            <p>Incident id: {this.state.incidentId}</p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
