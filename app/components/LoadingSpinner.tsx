import { motion } from "framer-motion";
import { Loader } from "@mantine/core";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: string;
  withText?: boolean;
  text?: string;
}

export function LoadingSpinner({ 
  size = "md", 
  color = "blue", 
  withText = false, 
  text = "Loading..." 
}: LoadingSpinnerProps) {
  const sizeMap = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <Loader size={sizeMap[size]} color={color} />
        </motion.div>
      </motion.div>
      
      {withText && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-gray-600 text-sm"
        >
          {text}
        </motion.div>
      )}
    </div>
  );
}

// Enhanced loading screen for full page loading
export function FullPageLoader({ text = "Loading your content..." }: { text?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      {/* Background animation */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-24 h-24 bg-blue-200/20 rounded-full blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-indigo-200/20 rounded-full blur-xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-white/20 text-center"
      >
        <LoadingSpinner size="xl" color="blue" withText text={text} />
      </motion.div>
    </div>
  );
}
