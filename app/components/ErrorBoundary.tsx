import { motion } from "framer-motion";
import { IconRefresh, IconHome, IconLogin, IconAlertTriangle, IconBug, IconCopy, IconCheck } from "@tabler/icons-react";
import { Button, Container, Text, Title, Stack, Group, Code, Collapse, ActionIcon, Tooltip } from "@mantine/core";
import { useState, useEffect } from "react";
import { notifications } from "@mantine/notifications";

interface ErrorBoundaryProps {
  error?: {
    status?: number;
    statusText?: string;
    data?: string;
  };
}

export function ErrorBoundary({ error }: ErrorBoundaryProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Check online status
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

  const getErrorIcon = () => {
    if (error?.status === 401 || error?.status === 403) {
      return <IconLogin size={64} stroke={1.5} className="text-blue-500" />;
    }
    if (error?.status === 404) {
      return <IconAlertTriangle size={64} stroke={1.5} className="text-yellow-500" />;
    }
    return <IconBug size={64} stroke={1.5} className="text-red-500" />;
  };

  const getErrorTitle = () => {
    if (!isOnline) return "Connection Lost";
    if (error?.status === 401) return "Authentication Required";
    if (error?.status === 403) return "Access Denied";
    if (error?.status === 404) return "Page Not Found";
    if (error?.status === 500) return "Server Error";
    if (error?.status) return `Error ${error.status}`;
    return "Oops! Something went wrong";
  };

  const getErrorMessage = () => {
    if (!isOnline) return "Please check your internet connection and try again.";
    if (error?.status === 401) return "Please log in to access this page.";
    if (error?.status === 403) return "You don't have permission to access this resource.";
    if (error?.status === 404) return "The page you're looking for doesn't exist.";
    if (error?.status === 500) return "The server encountered an error. Please try again later.";
    if (error?.statusText || error?.data) return error.statusText || error.data;
    return "An unexpected error occurred. Our team has been notified.";
  };

  const getActionButtons = () => {
    if (error?.status === 401 || error?.status === 403) {
      return (
        <Group justify="center" gap="md">
          <Button
            component="a"
            href="/login"
            variant="filled"
            leftSection={<IconLogin size={16} />}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
            size="md"
          >
            Go to Login
          </Button>
          <Button
            component="a"
            href="/"
            variant="outline"
            leftSection={<IconHome size={16} />}
            size="md"
          >
            Home
          </Button>
        </Group>
      );
    }

    return (
      <Group justify="center" gap="md">
        <Button
          onClick={() => window.location.reload()}
          variant="filled"
          leftSection={<IconRefresh size={16} />}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-lg"
          size="md"
        >
          Try Again
        </Button>
        <Button
          component="a"
          href="/"
          variant="outline"
          leftSection={<IconHome size={16} />}
          size="md"
        >
          Go Home
        </Button>
      </Group>
    );
  };

  const errorDetails = error ? `Status: ${error.status}\nMessage: ${error.statusText || error.data || 'Unknown error'}\nTime: ${new Date().toISOString()}` : 'No error details available';

  const copyErrorDetails = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      notifications.show({
        title: 'Copied!',
        message: 'Error details copied to clipboard',
        color: 'green',
        autoClose: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      notifications.show({
        title: 'Copy failed',
        message: 'Unable to copy to clipboard',
        color: 'red',
        autoClose: 3000,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-300/20 rounded-full blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
            x: [0, 20, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-3/4 right-1/4 w-24 h-24 bg-purple-300/20 rounded-full blur-xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.7, 0.4],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-20 h-20 bg-indigo-300/20 rounded-full blur-xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 0.8, 0.5],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        
        {/* Network status indicator */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full text-sm shadow-lg z-50"
          >
            🌐 No internet connection
          </motion.div>
        )}
      </div>

      <Container size="sm" className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ 
            duration: 0.8, 
            ease: [0.23, 1, 0.32, 1]
          }}
          className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 p-8 text-center"
        >
          {/* Error Icon with complex animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ 
              delay: 0.3, 
              type: "spring", 
              stiffness: 150, 
              damping: 12,
              duration: 1.2
            }}
            className="mb-6 flex justify-center"
          >
            <motion.div
              animate={{ 
                rotate: [0, -3, 3, -2, 2, 0],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
                times: [0, 0.2, 0.4, 0.6, 0.8, 1],
              }}
              className="relative"
            >
              {getErrorIcon()}
              
              {/* Pulse effect */}
              <motion.div
                className="absolute inset-0 rounded-full"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                style={{
                  background: error?.status === 401 || error?.status === 403 
                    ? 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)'
                    : error?.status === 404 
                    ? 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, transparent 70%)'
                }}
              />
            </motion.div>
          </motion.div>

          <Stack gap="xl" align="center">
            {/* Title with typewriter effect */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
            >
              <Title 
                order={1} 
                size="2.5rem" 
                className="text-gray-800 font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
                ta="center"
              >
                {getErrorTitle()}
              </Title>
            </motion.div>

            {/* Message with slide-in animation */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              <Text 
                size="lg" 
                c="dimmed" 
                ta="center"
                className="max-w-md mx-auto leading-relaxed"
              >
                {getErrorMessage()}
              </Text>
            </motion.div>

            {/* Error code badge with enhanced styling */}
            {error?.status && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0, duration: 0.4 }}
                className="flex items-center gap-2"
              >
                <div className="bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 px-4 py-2 rounded-full text-sm font-mono shadow-sm border">
                  Error {error.status}
                </div>
                
                {/* Error details toggle */}
                <Tooltip label={showDetails ? "Hide details" : "Show details"}>
                  <ActionIcon
                    variant="subtle"
                    onClick={() => setShowDetails(!showDetails)}
                    size="sm"
                  >
                    <motion.div
                      animate={{ rotate: showDetails ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      📋
                    </motion.div>
                  </ActionIcon>
                </Tooltip>

                {/* Copy error details */}
                <Tooltip label="Copy error details">
                  <ActionIcon
                    variant="subtle"
                    onClick={copyErrorDetails}
                    size="sm"
                  >
                    <motion.div
                      animate={{ scale: copied ? 1.2 : 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </motion.div>
                  </ActionIcon>
                </Tooltip>
              </motion.div>
            )}

            {/* Collapsible error details */}
            <Collapse in={showDetails}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full"
              >
                <Code block className="text-left max-w-md mx-auto text-xs bg-gray-50 p-4 rounded-lg border">
                  {errorDetails}
                </Code>
              </motion.div>
            </Collapse>

            {/* Action buttons with enhanced styling */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="pt-4"
            >
              {getActionButtons()}
            </motion.div>

            {/* Additional help text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.4 }}
            >
              <Text size="sm" c="dimmed" ta="center">
                If the problem persists, please contact support
              </Text>
            </motion.div>
          </Stack>
        </motion.div>

        {/* Enhanced floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className={`absolute w-2 h-2 rounded-full ${
              i % 3 === 0 ? 'bg-blue-400/40' : 
              i % 3 === 1 ? 'bg-purple-400/40' : 'bg-indigo-400/40'
            }`}
            style={{
              top: `${20 + (i * 15)}%`,
              left: `${10 + (i * 12)}%`,
            }}
            animate={{
              y: [0, -20 - (i * 5), 0],
              x: [0, 10 - (i * 2), 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 3 + (i * 0.5),
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
