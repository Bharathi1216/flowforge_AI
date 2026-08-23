import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, AlertCircle, Search, Database, Cpu, HelpCircle } from 'lucide-react';

export const RAGVisualizer: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-left font-medium text-slate-700 dark:text-slate-300"
      >
        <div className="flex items-center gap-2 text-xs">
          <Database className="h-4 w-4 text-primary" />
          <span>RAG Query Trace: How FlowForge found this answer</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-primary hover:underline font-semibold">
          <span>{isExpanded ? 'Hide Trace' : 'View Source Trace'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="mt-5 space-y-6 pt-4 border-t border-slate-200/60 dark:border-slate-800/40">
              {/* Flowchart Layout */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2 relative">
                
                {/* Step 1: Failure */}
                <div className="flex flex-col items-center text-center w-full md:w-1/4">
                  <div className="rounded-full bg-rose-500/10 p-3 text-rose-500 dark:bg-rose-950/30">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">1. Log Failure</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[130px] mt-0.5">Scanned active ERESOLVE error lines</p>
                </div>

                {/* Arrow 1 */}
                <div className="hidden md:block flex-1 h-[2px] bg-slate-200 dark:bg-slate-800 relative w-full min-w-[20px]">
                  <div className="flowline-horizontal absolute inset-0 rounded" />
                </div>

                {/* Step 2: Vector Search */}
                <div className="flex flex-col items-center text-center w-full md:w-1/4">
                  <div className="rounded-full bg-blue-500/10 p-3 text-blue-500 dark:bg-blue-950/30">
                    <Search className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">2. Index Lookup</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[130px] mt-0.5">Semantic search in Vector Database</p>
                </div>

                {/* Arrow 2 */}
                <div className="hidden md:block flex-1 h-[2px] bg-slate-200 dark:bg-slate-800 relative w-full min-w-[20px]">
                  <div className="flowline-horizontal absolute inset-0 rounded" />
                </div>

                {/* Step 3: Context Retrieval */}
                <div className="flex flex-col items-center text-center w-full md:w-1/4">
                  <div className="rounded-full bg-violet-500/10 p-3 text-violet-500 dark:bg-violet-950/30">
                    <Database className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">3. Context Matches</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[130px] mt-0.5">Pulled past issues & README docs</p>
                </div>

                {/* Arrow 3 */}
                <div className="hidden md:block flex-1 h-[2px] bg-slate-200 dark:bg-slate-800 relative w-full min-w-[20px]">
                  <div className="flowline-horizontal absolute inset-0 rounded" />
                </div>

                {/* Step 4: AI Synthesis */}
                <div className="flex flex-col items-center text-center w-full md:w-1/4">
                  <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500 dark:bg-emerald-950/30">
                    <Cpu className="h-5 w-5" />
                  </div>
                  <h4 className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">4. AI Response</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 max-w-[130px] mt-0.5">Synthesized custom resolution advice</p>
                </div>

              </div>

              {/* RAG Details Explanation */}
              <div className="rounded-lg bg-white p-3.5 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-primary" />
                  What is RAG?
                </div>
                Retrieval-Augmented Generation (RAG) means we don't just send raw logs to the LLM. Instead, we scan the logs for errors, search your repository's local database of previous build resolutions, discussions, and wiki documentation, and feed those matching records alongside the error context to the AI model. This guarantees highly accurate suggestions tailored to your workspace instead of generic internet search replies.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
