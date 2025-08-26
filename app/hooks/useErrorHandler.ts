import { useState, useCallback, useEffect } from "react";

interface UseErrorHandlerOptions {
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  onRetry?: (attempt: number) => void;
  onMaxRetriesReached?: () => void;
}

interface ErrorState {
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  hasMaxRetriesReached: boolean;
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onError,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    hasMaxRetriesReached: false,
  });

  const setError = useCallback((error: Error) => {
    setErrorState(prev => ({
      ...prev,
      error,
      isRetrying: false,
    }));
    onError?.(error);
  }, [onError]);

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      hasMaxRetriesReached: false,
    });
  }, []);

  const retry = useCallback(async <T>(asyncFunction: () => Promise<T>): Promise<T> => {
    if (errorState.retryCount >= maxRetries) {
      setErrorState(prev => ({ ...prev, hasMaxRetriesReached: true }));
      onMaxRetriesReached?.();
      throw new Error('Maximum retries reached');
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    onRetry?.(errorState.retryCount + 1);

    try {
      // Add delay before retry
      if (retryDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }

      const result = await asyncFunction();
      
      // Success - clear error state
      clearError();
      return result;
    } catch (error) {
      setErrorState(prev => ({
        ...prev,
        error: error as Error,
        isRetrying: false,
      }));
      throw error;
    }
  }, [errorState.retryCount, maxRetries, retryDelay, onRetry, onMaxRetriesReached, clearError]);

  const executeWithErrorHandling = useCallback(async <T>(
    asyncFunction: () => Promise<T>
  ): Promise<T | null> => {
    try {
      clearError();
      const result = await asyncFunction();
      return result;
    } catch (error) {
      setError(error as Error);
      return null;
    }
  }, [setError, clearError]);

  return {
    error: errorState.error,
    isRetrying: errorState.isRetrying,
    retryCount: errorState.retryCount,
    hasMaxRetriesReached: errorState.hasMaxRetriesReached,
    setError,
    clearError,
    retry,
    executeWithErrorHandling,
  };
}

// Hook for handling network errors specifically
export function useNetworkErrorHandler() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const errorHandler = useErrorHandler({
    maxRetries: 3,
    retryDelay: 2000,
    onError: (error) => {
      console.error("Network error:", error);
    },
    onRetry: (attempt) => {
      console.log(`Retry attempt ${attempt}`);
    },
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const retryWithNetworkCheck = useCallback(async <T>(asyncFunction: () => Promise<T>): Promise<T> => {
    if (!isOnline) {
      throw new Error("No internet connection");
    }
    return retry(asyncFunction);
  }, [isOnline, retry]);

  return {
    ...errorHandler,
    isOnline,
    retryWithNetworkCheck,
  };
}
