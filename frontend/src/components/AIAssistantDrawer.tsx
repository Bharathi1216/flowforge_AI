import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, X, Send, Bot, User, RefreshCw, Copy, Check, 
  Terminal, ArrowRight, MessageSquarePlus, Trash2, Cpu,
  CheckCircle2, AlertCircle, ShieldCheck, Zap
} from 'lucide-react';
import { useAIAssistant } from '../contexts/AIAssistantContext';
import { useToast } from '../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  codeSnippet?: string;
  timestamp: string;
}

export const AIAssistantDrawer: React.FC = () => {
  const { isOpen, closeAssistant, currentRepoContext, initialPrompt, setInitialPrompt } = useAIAssistant();
  const { success } = useToast();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeRepo = currentRepoContext || 'FlowForge-AI';

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello Bharathi! I am your FlowForge AI Assistant for **${activeRepo}**.\n\nI can analyze your GitHub Actions build failures, explain dependency peer mismatches (like React 19 vs 18), generate workflow YAML patches, or find the right collaborator to review.`,
      codeSnippet: `# Quick diagnostic check for ${activeRepo}\nRun #92 failed on step: npm ci (ERESOLVE)\nRoot cause: react-router-dom@6.22.3 peer React 18 mismatch`,
      timestamp: 'Just now'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<'flowforge-agent' | 'gemini-2.5' | 'claude-3.7'>('flowforge-agent');

  // Handle initial prompt passed when opening
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt) {
        handleSendMessage(initialPrompt);
        setInitialPrompt(null);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const quickPrompts = [
    { label: 'Diagnose Run #92 failure', prompt: 'Why did the latest CI build fail for FlowForge-AI and how do I fix it?' },
    { label: 'Generate CI fix patch', prompt: 'Provide a code patch for the npm ERESOLVE peer dependency mismatch in package.json and ci.yml.' },
    { label: 'Who touched this module?', prompt: 'Who is the primary contributor for auth & dependency configuration in this repository?' },
    { label: 'Summarize weekly changes', prompt: 'Summarize recent commits, PRs, and workflow health for FlowForge-AI.' }
  ];

  const generateAIResponse = (userQuery: string): { text: string; code?: string } => {
    const q = userQuery.toLowerCase();

    if (q.includes('fail') || q.includes('why') || q.includes('92') || q.includes('build') || q.includes('error')) {
      return {
        text: `### 🔍 CI Failure Diagnostics (Run #92)

**Step:** \`Install dependencies (npm ci)\`
**Exit Code:** \`1\`
**Error Code:** \`ERESOLVE\`

#### Root Cause:
Package \`react-router-dom@6.22.3\` specifies a strict peer requirement on \`react@>=18 <19\`. Your root \`package.json\` has \`react@19.0.0-rc\`. In modern npm (v9+), peer conflicts strictly halt execution during CI.

#### Solution Strategy:
1. **Option A (Recommended for CI):** Add the \`--legacy-peer-deps\` flag to your GitHub Actions workflow step.
2. **Option B (Dependency alignment):** Pin React and React-DOM to \`^18.2.0\` in \`package.json\`.`,
        code: `# 1. In your .github/workflows/ci.yml:
- name: Install dependencies
  run: npm ci --legacy-peer-deps

# 2. Or pin React in package.json:
npm install react@^18.2.0 react-dom@^18.2.0`
      };
    }

    if (q.includes('patch') || q.includes('generate') || q.includes('fix') || q.includes('yaml')) {
      return {
        text: `Here is the complete patched workflow configuration for \`.github/workflows/ci.yml\` that bypasses peer conflict and enables dependency caching:`,
        code: `name: CI Test & Build

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js 20.x
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - name: Install Dependencies
        run: npm ci --legacy-peer-deps
      - name: Run Tests
        run: npm test -- --passWithNoTests
      - name: Build Application
        run: npm run build`
      };
    }

    if (q.includes('who') || q.includes('contributor') || q.includes('owner') || q.includes('auth') || q.includes('teammate')) {
      return {
        text: `### 👥 Collaborator & Module Attribution

Based on git commit history and PR contributions in **${activeRepo}**:
- **@bharathi1216** (Owner): 28 commits across authentication, CI workflow pipeline, and RAG diagnostics.
- **@john-lead** (Lead Architect): 14 commits in backend database and telemetry.
- **@alex-dev**: 9 commits in UI layout and logs viewer.

**Recommendation:** Tag **@bharathi1216** in the Discussion thread to approve the CI workflow patch.`,
        code: `@bharathi1216 Can you review the proposed --legacy-peer-deps patch for workflow #92?`
      };
    }

    if (q.includes('summary') || q.includes('summarize') || q.includes('changes') || q.includes('commits')) {
      return {
        text: `### 📊 Weekly Summary for ${activeRepo}

- **Active Workflows:** 3 pipelines configured (2 passing, 1 failing)
- **Resolved Issues:** 4 discussion threads addressed
- **Latest Merges:** PR #14 (*RAG diagnostic vector embeddings integration*)
- **Health Score:** **88%** automated pipeline reliability`,
        code: `git log --oneline -n 5\n# e7f2b1a Fix auth webhook retry logic & dependency tree\n# 4b9c1d0 Merge pull request #14 from RAG-embeddings\n# 91a8e2f Update tailwind configuration and dark theme`
      };
    }

    return {
      text: `I've analyzed the current repository state for **${activeRepo}** using RAG vector embeddings. 

All configuration manifests and workflow files are indexed. You can ask me to write a custom GitHub Actions workflow step, optimize build times, or investigate any CI failure trace.`,
      code: `npx flowforge-cli diagnose --repo=${activeRepo}`
    };
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateAIResponse(text);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        codeSnippet: response.code,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 850);
  };

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    success('Code snippet copied to clipboard!', 'Copied');
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const handlePushToThread = (msg: Message) => {
    navigate(`/repositories/${activeRepo}/threads`);
    closeAssistant();
    success(`AI solution ready to publish in ${activeRepo} Discussion Hub`, 'Pushed to Threads');
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: `Chat history cleared. How can I assist you with **${activeRepo}**?`,
        timestamp: 'Just now'
      }
    ]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeAssistant}
            className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[580px] bg-white dark:bg-[#0B0F17] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between"
          >
            {/* 1. Header Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E131F]/90 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 flex items-center justify-center shadow-md shadow-purple-500/20">
                    <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 font-heading">
                        FlowForge AI Assistant
                      </h2>
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        RAG Grounded
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      Context: <span className="font-bold text-purple-600 dark:text-purple-400">{activeRepo}</span> (branch: main)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleClearChat}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                    title="Clear chat history"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={closeAssistant}
                    className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                    title="Close Assistant (Esc)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Model selection & repository pill */}
              <div className="mt-3 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <Cpu className="h-3.5 w-3.5 text-purple-500" />
                  <span>Model: <b>FlowForge RAG 2.5</b></span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Repo AST Indexed</span>
                </div>
              </div>
            </div>

            {/* 2. Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-terminal bg-slate-50/40 dark:bg-[#080B12]">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {isUser ? (
                      <div className="h-7 w-7 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <User className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shrink-0 shadow-md">
                        <div className="h-full w-full bg-slate-950 rounded-full flex items-center justify-center">
                          <Bot className="h-3.5 w-3.5 text-purple-400" />
                        </div>
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed transition-colors ${
                        isUser
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10'
                          : 'bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-2 font-mono font-bold">
                        <span>{isUser ? 'You' : 'FlowForge AI'}</span>
                        <span>{m.timestamp}</span>
                      </div>

                      {/* Content with markdown formatting */}
                      <div className="whitespace-pre-wrap font-sans space-y-2 text-slate-900 dark:text-slate-100">
                        {m.content}
                      </div>

                      {/* Code Snippet Box */}
                      {m.codeSnippet && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-200">
                          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 text-[10px] text-slate-400 font-mono border-b border-slate-800">
                            <span className="flex items-center gap-1.5">
                              <Terminal className="h-3 w-3 text-purple-400" />
                              <span>terminal / workflow snippet</span>
                            </span>
                            <button
                              onClick={() => handleCopyCode(m.codeSnippet!, m.id)}
                              className="flex items-center gap-1 hover:text-white transition-colors"
                            >
                              {copiedCodeId === m.id ? (
                                <Check className="h-3 w-3 text-emerald-400" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              <span>{copiedCodeId === m.id ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto text-purple-300">
                            {m.codeSnippet}
                          </pre>
                        </div>
                      )}

                      {/* Assistant Actions: Push to Thread */}
                      {!isUser && m.id !== 'welcome' && m.id !== 'welcome-reset' && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handlePushToThread(m)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                          >
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            <span>Discuss in Thread</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 p-0.5 shrink-0">
                    <div className="h-full w-full bg-slate-950 rounded-full flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-purple-400 animate-spin" />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white dark:bg-[#111625] border border-slate-200 dark:border-slate-800 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 shadow-sm">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-purple-600 dark:text-purple-400" />
                    <span className="font-mono">Analyzing failure traces & git AST...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 3. Suggested Prompt Chips */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17]">
              <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                <Zap className="h-3 w-3 text-purple-500" />
                <span>Suggested Queries</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-terminal">
                {quickPrompts.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 hover:border-purple-500/50 hover:bg-purple-50 dark:hover:bg-purple-950/30 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-all text-left truncate max-w-full"
                  >
                    💬 {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Chat Input Bar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0E131F] backdrop-blur-md">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Ask FlowForge AI about ${activeRepo}...`}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/90 py-2.5 px-4 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/40 shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isTyping}
                  className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span>Press Enter to send</span>
                <span>Shortcut: <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">⌘J</kbd></span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
