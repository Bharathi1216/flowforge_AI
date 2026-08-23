import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Info, ShieldCheck } from 'lucide-react';
import { authService } from '../services/authService';
import { GithubIcon } from '../components/GithubIcon';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-login if demo parameter is present
  useEffect(() => {
    if (searchParams.get('demo') === 'true') {
      handleDemoLogin();
    }
  }, [searchParams]);

  const handleGithubLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.loginWithGitHub();
      if (response && response.redirectUrl) {
        navigate(response.redirectUrl);
      } else {
        setError('OAuth redirection failed.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setLoading(true);
    // Simulate slight loader delay for micro-interactions
    setTimeout(() => {
      navigate('/dashboard');
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-12 relative overflow-hidden">
      {/* Background radial overlays */}
      <div className="absolute top-[20%] left-[20%] h-[350px] w-[350px] rounded-full bg-blue-500/5 blur-[100px]" />
      <div className="absolute bottom-[20%] right-[20%] h-[350px] w-[350px] rounded-full bg-violet-500/5 blur-[100px]" />

      <div className="w-full max-w-md space-y-8 z-10">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center">
          <img src="/src/assets/logo.svg" className="h-14 w-14 mb-4" alt="FlowForge" />
          <h2 className="text-2xl font-black uppercase text-white tracking-widest font-sans">
            FlowForge <span className="text-primary">AI</span>
          </h2>
          <p className="mt-1.5 text-xs text-slate-400">Your intelligent development workspace.</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-900 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-sm space-y-6">
          {error && (
            <div className="rounded-lg bg-rose-950/20 border border-rose-900/40 p-3 text-xs text-rose-400 font-medium">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-3">
            {/* Primary GitHub login */}
            <button
              onClick={handleGithubLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-100 hover:bg-white text-slate-950 px-5 py-3.5 text-sm font-bold disabled:opacity-75 transition-all shadow-md"
            >
              <GithubIcon className="h-5 w-5 fill-slate-950" />
              {loading ? 'Connecting...' : 'Continue with GitHub'}
            </button>

            {/* Demo mode login */}
            <button
              onClick={handleDemoLogin}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900 px-5 py-3.5 text-sm font-bold text-slate-300 disabled:opacity-75 transition-all"
            >
              Explore as Demo User
            </button>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 p-3 text-[10px] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              FlowForge requests access only to repositories you authorize. We do not store GitHub credentials or personal access tokens in localStorage.
            </span>
          </div>
        </div>

        {/* Footer legal links */}
        <div className="flex justify-center gap-4 text-[10px] text-slate-600">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="hover:underline">Terms of Service</a>
          <span>•</span>
          <a href="#" className="hover:underline">Help & Docs</a>
        </div>
      </div>
    </div>
  );
};
