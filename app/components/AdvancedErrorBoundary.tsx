import { motion } from "framer-motion";
import { IconWifi, IconWifiOff, IconRefresh, IconBug, IconShieldX, IconFileX, IconServerOff } from "@tabler/icons-react";
import { Button, Container, Text, Title, Stack, Group, Progress, Badge } from "@mantine/core";
import { useState, useEffect } from "react";

interface AdvancedErrorBoundaryProps {
  error?: {
    status?: number;
    statusText?: string;
    data?: string;
  };
  retry?: () => void;
  showRetryProgress?: boolean;
}

export function AdvancedErrorBoundary({ 
  error, 
  retry,
  showRetryProgress = false 
}: AdvancedErrorBoundaryProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getErrorInfo = () => {
    if (!isOnline) {
      return {
        icon: IconWifiOff,
        title: "No Internet Connection",
        message: "Please check your connection and try again",
        color: "orange",
        severity: "warning"
      };
    }

    switch (error?.status) {
      case 401:
      case 403:
        return {
          icon: IconShieldX,
          title: error.status === 401 ? "Authentication Required" : "Access Denied",
          message: error.status === 401 
            ? "Please log in to access this page"
            : "You don't have permission to access this resource",
          color: "blue",
          severity: "auth"
        };
      case 404:
        return {
          icon: IconFileX,
          title: "Page Not Found",
          message: "The page you're looking for doesn't exist",
          color: "yellow",
          severity: "not-found"
        };
      case 500:
      case 502:
      case 503:
        return {
          icon: IconServerOff,
          title: "Server Error",
          message: "The server encountered an error. Please try again later",
          color: "red",
          severity: "server"
        };
      default:
        return {
          icon: IconBug,
          title: "Something went wrong",
          message: error?.statusText || error?.data || "An unexpected error occurred",
          color: "red",
          severity: "error"
        };
    }
  };

  const handleRetry = async () => {
    if (retry) {
      setIsRetrying(true);
      setRetryProgress(0);
      setRetryCount(prev => prev + 1);

      // Simulate progress if showRetryProgress is true
      if (showRetryProgress) {
        const interval = setInterval(() => {
          setRetryProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              return 100;
            }
            return prev + 10;
          });
        }, 100);

        await new Promise(resolve => setTimeout(resolve, 1000));
        clearInterval(interval);
      }

      retry();
      setIsRetrying(false);
      setRetryProgress(0);
    } else {
      window.location.reload();
    }
  };

  const errorInfo = getErrorInfo();
  const Icon = errorInfo.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-20 left-20 w-40 h-40 bg-blue-300/10 rounded-full blur-2xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-32 h-32 bg-purple-300/10 rounded-full blur-2xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.7, 0.4],
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Network status indicator */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-6 left-1/2 transform -translate-x-1/2 z-50"
          >
            <Badge
              leftSection={<IconWifiOff size={14} />}
              color="red"
              size="lg"
              variant="filled"
            >
              Offline
            </Badge>
          </motion.div>
        )}
      </div>

      <Container size="sm" className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.8, 
            ease: [0.16, 1, 0.3, 1]
          }}
          className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/40 p-10 text-center relative"
        >
          {/* Retry count indicator */}
          {retryCount > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 right-4"
            >
              <Badge size="xs" variant="light" color="gray">
                Attempt {retryCount}
              </Badge>
            </motion.div>
          )}

          {/* Main error icon */}
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              delay: 0.3, 
              type: "spring", 
              stiffness: 120, 
              damping: 15,
              duration: 1
            }}
            className="mb-8 flex justify-center relative"
          >
            <motion.div
              animate={isRetrying ? {
                rotate: 360,
                scale: [1, 1.1, 1],
              } : {
                rotate: [0, -2, 2, 0],
                scale: [1, 1.02, 1],
              }}
              transition={isRetrying ? {
                rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                scale: { duration: 0.5, repeat: Infinity },
              } : {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="relative"
            >
              <Icon 
                size={80} 
                stroke={1.5} 
                className={`text-${errorInfo.color}-500`} 
              />
              
              {/* Pulse effect */}
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  scale: [1, 1.8, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                style={{
                  background: `radial-gradient(circle, var(--mantine-color-${errorInfo.color}-3) 0%, transparent 70%)`
                }}
              />
            </motion.div>
          </motion.div>

          <Stack gap="xl" align="center">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Title 
                order={1} 
                size="2.5rem" 
                className={`text-gray-800 font-bold bg-gradient-to-r from-gray-800 to-${errorInfo.color}-600 bg-clip-text text-transparent`}
                ta="center"
              >
                {errorInfo.title}
              </Title>
            </motion.div>

            {/* Message */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <Text 
                size="lg" 
                c="dimmed" 
                ta="center"
                className="max-w-lg mx-auto leading-relaxed"
              >
                {errorInfo.message}
              </Text>
            </motion.div>

            {/* Error badge */}
            {error?.status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0, duration: 0.4 }}
              >
                <Badge 
                  size="lg" 
                  variant="light" 
                  color={errorInfo.color}
                  className="font-mono"
                >
                  Error {error.status}
                </Badge>
              </motion.div>
            )}

            {/* Retry progress */}
            {isRetrying && showRetryProgress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-xs"
              >
                <Progress 
                  value={retryProgress} 
                  color={errorInfo.color}
                  size="sm"
                  striped
                  animated
                />
                <Text size="sm" c="dimmed" mt="xs" ta="center">
                  Retrying...
                </Text>
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="pt-4"
            >
              <Group justify="center" gap="md">
                {errorInfo.severity === "auth" ? (
                  <>
                    <Button
                      component="a"
                      href="/login"
                      variant="gradient"
                      gradient={{ from: 'blue', to: 'cyan' }}
                      leftSection={<IconWifi size={16} />}
                      size="md"
                      className="shadow-lg"
                    >
                      Go to Login
                    </Button>
                    <Button
                      component="a"
                      href="/"
                      variant="outline"
                      size="md"
                    >
                      Home
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={handleRetry}
                      variant="gradient"
                      gradient={{ from: errorInfo.color, to: `${errorInfo.color}.7` }}
                      leftSection={
                        <motion.div
                          animate={isRetrying ? { rotate: 360 } : {}}
                          transition={isRetrying ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                        >
                          <IconRefresh size={16} />
                        </motion.div>
                      }
                      loading={isRetrying}
                      size="md"
                      className="shadow-lg"
                    >
                      {isRetrying ? "Retrying..." : "Try Again"}
                    </Button>
                    <Button
                      component="a"
                      href="/"
                      variant="outline"
                      size="md"
                    >
                      Go Home
                    </Button>
                  </>
                )}
              </Group>
            </motion.div>

            {/* Help text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.4 }}
            >
              <Text size="sm" c="dimmed" ta="center">
                {!isOnline 
                  ? "Check your internet connection" 
                  : "If the problem persists, please contact support"}
              </Text>
            </motion.div>
          </Stack>
        </motion.div>

        {/* Enhanced floating elements */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-1 h-1 rounded-full ${
              ['bg-blue-400/30', 'bg-purple-400/30', 'bg-indigo-400/30', 'bg-cyan-400/30'][i % 4]
            }`}
            style={{
              top: `${15 + (i * 10)}%`,
              left: `${5 + (i * 11)}%`,
            }}
            animate={{
              y: [0, -30 - (i * 3), 0],
              x: [0, 15 - (i * 2), 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 4 + (i * 0.3),
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.2,
            }}
          />
        ))}
      </Container>
    </div>
  );
}
