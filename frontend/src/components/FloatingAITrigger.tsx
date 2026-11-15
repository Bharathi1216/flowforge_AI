import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import React from 'react';
import { useAIAssistant } from '../contexts/assistantState';

export const FloatingAITrigger: React.FC = () => {
  const { isOpen, toggleAssistant } = useAIAssistant();

  if (isOpen) return null;

  return (
    <motion.button
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleAssistant}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30 backdrop-blur-md group transition-all"
      title="Open FlowForge AI Assistant (âŒ˜J)"
    >
      <div className="h-6 w-6 rounded-full bg-purple-950/80 flex items-center justify-center border border-purple-400/40">
        <Sparkles className="h-3.5 w-3.5 text-purple-300 group-hover:rotate-12 transition-transform" />
      </div>
      <div className="flex flex-col text-left">
        <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
          Ask FlowForge AI
          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/40 font-mono">âŒ˜J</span>
        </span>
      </div>
    </motion.button>
  );
};
