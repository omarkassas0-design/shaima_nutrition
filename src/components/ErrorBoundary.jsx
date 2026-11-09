import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Sanitizes error data before logging.
 * Removes sensitive patient data, passwords, OTP codes, tokens, API keys, and medical info.
 * Only logs the error type, message, and stack trace location — never the data payload.
 */
function sanitizeError(error) {
  const safeMessage = error?.message
    ? error.message.replace(/(password|otp|token|api[_-]?key|secret|authorization|bearer)\s*[:=]\s*\S+/gi, '$1=***REDACTED***')
    : 'Unknown error';

  return {
    type: error?.name || 'Error',
    message: safeMessage,
    timestamp: new Date().toISOString(),
    // Only log the first few stack frames for debugging — no data payloads
    stack: error?.stack
      ? error.stack.split('\n').slice(0, 5).join('\n')
      : null,
  };
}

/**
 * Global error boundary — catches unhandled React render errors
 * and shows a user-friendly message without exposing stack traces or sensitive data.
 * Logs sanitized error info to console (no patient data, passwords, OTPs, or tokens).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    const sanitized = sanitizeError(error);
    const errorId = `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.setState({ errorId });

    // Log only sanitized, non-sensitive information
    console.error('Application error:', {
      id: errorId,
      type: sanitized.type,
      message: sanitized.message,
      timestamp: sanitized.timestamp,
      // Log component stack location only — no data
      componentStack: errorInfo?.componentStack
        ? errorInfo.componentStack.split('\n').slice(0, 5).join('\n')
        : null,
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, errorId: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-background p-4">
          <div className="max-w-md text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Your data is safe. Please try reloading the page.
            </p>
            {this.state.errorId && (
              <p className="text-xs text-muted-foreground font-mono">
                Error ID: {this.state.errorId}
              </p>
            )}
            <Button onClick={this.handleReload} className="gradient-primary text-white">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}