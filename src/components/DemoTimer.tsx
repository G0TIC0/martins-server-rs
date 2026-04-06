import React from 'react';
import { motion } from 'motion/react';
import { Clock, AlertCircle, X } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { cn } from '../lib/utils';

export const DemoTimer: React.FC = () => {
  const { isDemoMode, demoTimeLeft, endDemo } = useDemo();

  if (!isDemoMode) return null;

  const minutes = Math.floor(demoTimeLeft / 60000);
  const seconds = Math.floor((demoTimeLeft % 60000) / 1000);
  const isUrgent = minutes < 5;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, y: 100 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl backdrop-blur-xl transition-all duration-500",
        isUrgent 
          ? "bg-red-600 text-white animate-pulse" 
          : "bg-[#111827] text-white"
      )}
    >
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <AlertCircle className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
        <span className="font-mono text-xl font-bold">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        <span className="text-xs font-medium uppercase tracking-wider opacity-70">
          restantes
        </span>
      </div>

      <div className="h-6 w-px bg-white/20"></div>

      <button
        onClick={endDemo}
        className="rounded-lg p-1 transition-colors hover:bg-white/20"
        title="Encerrar demonstração"
      >
        <X className="h-5 w-5" />
      </button>
    </motion.div>
  );
};
