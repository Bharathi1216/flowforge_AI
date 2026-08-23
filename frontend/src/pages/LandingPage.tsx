import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, Terminal, ShieldAlert, BrainCircuit, Users, ChevronRight, CheckCircle2, GitMerge, Database } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const capabilities = [
    {
      icon: Terminal,
      title: 'CI/CD Insights',
      description: 'Aggregate and filter GitHub Actions logs in a custom-engineered, searchable developer terminal.'
    },
    {
      icon: BrainCircuit,
      title: 'AI Diagnostics',
      description: 'Generate diagnostic insights for build failures by analyzing errors with local RAG embeddings.'
    },
    {
      icon: Users,
      title: 'Actionable Discussions',
      description: 'Start thread discussions tied to specific failures. Mention teammates, paste logs, and mark resolutions.'
    },
    {
      icon: GitBranch,
      title: 'Developer Onboarding',
      description: 'Auto-generate repository guides detailing module structures, architectural layout, and recurring bugs.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-primary/30 relative overflow-hidden">
      {/* Decorative gradient glowing bubbles */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
      <div className="absolute bottom-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[130px]" />

      {/* Header */}
      <header className="relative z-10 mx-auto max-w-7xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/src/assets/logo.svg" className="h-9 w-9" alt="FlowForge" />
          <span className="text-lg font-black tracking-widest text-white uppercase font-sans">
            FlowForge <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">AI</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/login?demo=true')} 
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            Explore Demo
          </button>
          <button
            onClick={() => navigate('/login')}
            className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-950 hover:bg-slate-200 transition-colors"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left text column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary dark:text-primary-hover">
            <span>✨ Introducing FlowForge Workspace</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans">
            Understand failures.<br />
            Collaborate faster.<br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">Build better.</span>
          </h1>

          <p className="text-base text-slate-400 max-w-lg leading-relaxed">
            An intelligent workspace for GitHub repositories that combines CI/CD monitoring, AI-powered failure analysis, repository knowledge, and team collaboration.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="group flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all shadow-lg shadow-primary/20"
            >
              Connect GitHub
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => navigate('/login?demo=true')}
              className="rounded-xl border border-slate-800 bg-slate-900/60 px-6 py-3.5 text-sm font-bold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              Explore Demo Workspace
            </button>
          </div>
        </div>

        {/* Right column: Subtle 3D-effect floating interactive flowchart */}
        <div className="lg:col-span-6 flex justify-center relative">
          <div className="w-full max-w-lg h-[460px] relative flex flex-col justify-between items-center py-4 bg-slate-900/30 rounded-2xl border border-slate-800/60 p-6 backdrop-blur-sm">
            
            {/* Step 1: GitHub Push */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="w-full max-w-[280px] rounded-xl border border-slate-800 bg-slate-950 p-3.5 flex items-center gap-3.5 shadow-xl relative z-10"
              style={{ transform: 'perspective(600px) rotateX(10deg)' }}
            >
              <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                <GitBranch className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-white">git push main</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Commit #e7f2b1a by bharathi1216</div>
              </div>
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            </motion.div>

            {/* Vertical Flow Line 1 */}
            <div className="absolute top-[75px] bottom-[275px] w-[2px] bg-slate-800 overflow-hidden">
              <div className="flowline-vertical absolute inset-0" />
            </div>

            {/* Step 2: CI Action Failure */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="w-full max-w-[280px] rounded-xl border border-rose-900/40 bg-rose-950/20 p-3.5 flex items-center gap-3.5 shadow-xl relative z-10"
              style={{ transform: 'perspective(600px) rotateX(10deg)' }}
            >
              <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
                <Terminal className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-rose-400">Workflow Run #184</div>
                <div className="text-[10px] text-rose-500/80 truncate mt-0.5">FAILED • ERESOLVE Conflict</div>
              </div>
              <div className="rounded-full bg-rose-950/80 px-2 py-0.5 text-[9px] font-bold text-rose-400 border border-rose-900/30">Failed</div>
            </motion.div>

            {/* Vertical Flow Line 2 */}
            <div className="absolute top-[185px] bottom-[165px] w-[2px] bg-slate-800 overflow-hidden">
              <div className="flowline-vertical absolute inset-0" />
            </div>

            {/* Step 3: AI Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="w-full max-w-[280px] rounded-xl border border-primary/30 bg-gradient-to-br from-slate-900 to-primary/10 p-3.5 flex items-center gap-3.5 shadow-xl relative z-10"
              style={{ transform: 'perspective(600px) rotateX(10deg)' }}
            >
              <div className="rounded-lg bg-primary/20 p-2 text-primary">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-white">FlowForge AI Agent</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">Identified react-router peer conflict</div>
              </div>
              <span className="text-[9px] font-bold text-primary animate-pulse uppercase">RAG Match</span>
            </motion.div>

            {/* Vertical Flow Line 3 */}
            <div className="absolute top-[295px] bottom-[55px] w-[2px] bg-slate-800 overflow-hidden">
              <div className="flowline-vertical absolute inset-0" />
            </div>

            {/* Step 4: Resolution */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="w-full max-w-[280px] rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-3.5 flex items-center gap-3.5 shadow-xl relative z-10"
              style={{ transform: 'perspective(600px) rotateX(10deg)' }}
            >
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold text-emerald-400">Discussion Resolved</div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">Fixed by downgrading React 19</div>
              </div>
              <GitMerge className="h-4 w-4 text-emerald-500" />
            </motion.div>

          </div>
        </div>
      </section>

      {/* How it Works / RAG Explanation */}
      <section className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl font-extrabold text-white">How FlowForge AI Works</h2>
            <p className="text-sm text-slate-400">
              Unlike generic LLM systems, FlowForge AI aggregates logs directly from your build, indexes your repository wiki guides, and cross-references team discussions to isolate build errors locally.
            </p>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {capabilities.map((cap, idx) => {
              const Icon = cap.icon;
              return (
                <div key={idx} className="rounded-xl border border-slate-900 bg-slate-900/30 p-6 space-y-4 hover:border-slate-800 transition-colors">
                  <div className="inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-base font-bold text-white">{cap.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{cap.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* RAG Detail Explain Banner */}
      <section className="relative z-10 border-t border-slate-900 bg-slate-900/20 py-20">
        <div className="mx-auto max-w-5xl px-6 flex flex-col md:flex-row items-center gap-10">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 flex flex-col gap-4 max-w-sm shrink-0">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <Database className="h-4 w-4" />
              <span>RETRIEVAL-AUGMENTED GENERATION</span>
            </div>
            <div className="space-y-2">
              <div className="rounded bg-slate-900/60 p-2 text-[10px] text-slate-400 border border-slate-800">
                🔍 Scan: ERESOLVE peer lock mismatch
              </div>
              <div className="rounded bg-slate-900/60 p-2 text-[10px] text-slate-400 border border-slate-800">
                📚 Retrieve: German-Bharatham Wiki doc
              </div>
              <div className="rounded bg-slate-900/60 p-2 text-[10px] text-slate-400 border border-slate-800">
                💬 Context: Sarah's advice in Comment #3
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-white">Why Developer Teams Need RAG</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              When a developer runs into a dependency installation problem, search engines only recommend basic fixes. By mapping your repository's local context (wiki docs, previous issues, chat suggestions) to vector search nodes, our AI agent can explain *exactly* why your pipeline failed in your code, providing drop-in replacements.
            </p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="relative z-10 border-t border-slate-900 py-24 text-center">
        <div className="mx-auto max-w-4xl px-6 space-y-6">
          <h2 className="text-3xl font-extrabold text-white">Build healthier workflows today.</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Authorize FlowForge access to repositories you control, analyze failed runs, and solve logs together.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <button
              onClick={() => navigate('/login')}
              className="rounded-xl bg-primary px-8 py-4 text-sm font-bold text-white hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors shadow-lg"
            >
              Get Started with GitHub
            </button>
          </div>
        </div>
      </section>

      {/* Footer Copyright */}
      <footer className="relative z-10 border-t border-slate-900/80 py-8 text-center text-xs text-slate-500">
        <p>© 2026 FlowForge AI. All rights reserved. Built for developer productivity.</p>
      </footer>
    </div>
  );
};
