import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, RefreshCw } from 'lucide-react';
import { AIMessage } from '../types';

interface AIAssistantChatProps {
  repoName: string;
}

const initialPrompts = [
  "Why did the last build fail?",
  "Summarize this week's changes",
  "Who should I ask about the auth module?"
];

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({ repoName }) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your FlowForge AI assistant for ${repoName}. I can inspect workflow error logs, explain dependency conflicts, find who resolved similar issues in your past commits, and summarize release history. How can I help today?`,
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const getSmartResponse = (query: string): string => {
    const q = query.toLowerCase();
    if (q.includes('why') || q.includes('fail') || q.includes('last build')) {
      return `The latest build failed in the "Install dependencies (npm ci)" step with error **ERESOLVE**. Package \`react-router-dom@6.22.3\` specifies a peer requirement on React 18, whereas the repository root has \`react@19.0.0-rc\`.

**Recommended fix:**
Add \`--legacy-peer-deps\` to your npm install script or pin React packages to \`^18.2.0\` in package.json.`;
    }
    if (q.includes('summarize') || q.includes('changes') || q.includes('week')) {
      return `Here is a summary of recent repository changes for **${repoName}**:
- **Authentication**: Refactored GitHub OAuth handshake token validation and added secure session cookie handler.
- **CI Pipelines**: Updated workflow steps to cache node_modules for 2.4x faster build times.
- **Pull Requests**: Merged PR #14 (RAG diagnostic vector embeddings) by @bharathi1216.`;
    }
    if (q.includes('auth') || q.includes('who') || q.includes('ask')) {
      return `Based on git commit history and PR contributions, **@bharathi1216** is the primary maintainer of the authentication module (8 commits, 2 PRs). You can tag them in a Discussion thread for review!`;
    }
    return `I analyzed the ${repoName} repository context. Everything looks healthy in core configuration, but make sure to monitor the recent peer dependency warnings on CI branch \`main\`. Let me know if you would like me to draft a pull request patch!`;
  };

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim()) return;

    const userMsg: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const reply = getSmartResponse(text);
      const aiMsg: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 900);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl flex flex-col h-[580px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-3.5 border-b border-slate-800">
        <div className="rounded-xl bg-gradient-to-tr from-blue-600 to-pink-500 p-2 text-white shadow-md shadow-primary/20">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Repository AI Assistant
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-mono">
              RAG Active
            </span>
          </h3>
          <p className="text-[10px] text-slate-400">Contextual answers grounded in {repoName} logs & code</p>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 scrollbar-terminal">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {isUser ? (
                <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300">
                  <User className="h-4 w-4" />
                </div>
              ) : (
                <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-blue-600 via-violet-600 to-pink-500 p-0.5 shrink-0 shadow-md shadow-primary/20">
                  <div className="h-full w-full bg-slate-950 rounded-full flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-pink-400" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-primary text-white shadow-lg shadow-primary/15'
                    : 'bg-slate-950/80 border border-slate-800 text-slate-200 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1.5 font-bold">
                  <span>{isUser ? 'You' : 'FlowForge AI'}</span>
                  <span>{m.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-blue-600 via-violet-600 to-pink-500 p-0.5 shrink-0">
              <div className="h-full w-full bg-slate-950 rounded-full flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-pink-400" />
              </div>
            </div>
            <div className="rounded-2xl bg-slate-950 border border-slate-800 px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Analyzing repository context...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="pt-2 pb-3 flex flex-wrap gap-2">
        {initialPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800 hover:border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition-all text-left"
          >
            💬 {prompt}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 pt-2 border-t border-slate-800"
      >
        <input
          type="text"
          placeholder={`Ask anything about ${repoName} (failures, files, commit history)...`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-xl border border-slate-800 bg-slate-950/80 py-3 px-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
