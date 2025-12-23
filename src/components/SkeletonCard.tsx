// src/components/SkeletonCard.tsx
import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonCardProps {
  isEpisode?: boolean;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({ isEpisode = false }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="bg-[#0a0f1e] rounded-2xl overflow-hidden"
    >
      {/* Image skeleton */}
      <div
        className={`relative overflow-hidden bg-slate-800/50 ${
          isEpisode ? 'aspect-video' : 'aspect-[2/3]'
        }`}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/30 to-transparent"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      {/* Text content skeleton */}
      <div className="p-4 space-y-2">
        {/* Title skeleton */}
        <div className="h-4 bg-slate-800/50 rounded-md w-3/4 relative overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/30 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>
        {/* Date skeleton */}
        <div className="h-3 bg-slate-800/50 rounded-md w-1/2 relative overflow-hidden">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/30 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>
      </div>
    </motion.div>
  );
};

export default SkeletonCard;
