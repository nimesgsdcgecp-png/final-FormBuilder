'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldQuestion } from 'lucide-react';
import { toast } from 'sonner';
import { AUTH, postOptions } from '@/utils/apiConstants';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch(AUTH.FORGOT_PASSWORD, postOptions({ email }));
      
      if (res.ok) {
        const data = await res.json();
        if (data.maskedEmail) {
          setMaskedEmail(data.maskedEmail);
        }
        setIsSent(true);
        toast.success("Identity verified!");
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to process request");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" 
         style={{ background: 'var(--bg-base)' }}>
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)] opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-blue-500 opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Logo Area */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-[var(--accent)] to-indigo-600 shadow-2xl shadow-[var(--accent-glow)] mb-8 transform hover:scale-105 transition-transform duration-500">
             <ShieldQuestion className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)]">Account Recovery</h1>
          <p className="mt-4 text-sm text-[var(--text-muted)] max-w-sm mx-auto font-medium leading-relaxed">
            Lost access? Enter your details below and we'll help you secure your account in minutes.
          </p>
        </div>

        {/* Main Glassmorphism Card */}
        <div className="bg-[var(--card-bg)] backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-[var(--card-border)] p-10 transform transition-all duration-500 hover:shadow-[0_30px_60px_rgba(0,0,0,0.12)]">
          
          {isSent ? (
            <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
               <div className="flex justify-center">
                 <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                 </div>
               </div>
               <div className="space-y-3">
                 <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Check your inbox</h2>
                 <p className="text-sm text-[var(--text-muted)] font-medium">
                   If we found an account matching those details, a secure reset link was sent to:
                 </p>
                 <div className="bg-[var(--bg-muted)] py-4 px-6 rounded-2xl border border-[var(--border)] font-mono text-[var(--accent)] font-black tracking-wider text-sm shadow-inner">
                   {maskedEmail || email}
                 </div>
               </div>
               <button
                  onClick={() => router.push('/login')}
                  className="w-full py-4 bg-[var(--bg-muted)] hover:bg-[var(--border)] text-[var(--text-primary)] border border-[var(--border)] rounded-2xl font-black tracking-tight transition-all mt-4 hover:-translate-y-0.5"
                >
                  Return to Login
                </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] tracking-[0.2em] font-black uppercase text-[var(--text-faint)] ml-1">
                  Email or Username
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-[var(--text-faint)] group-focus-within:text-[var(--accent)] transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-14 pr-6 py-4.5 bg-[var(--bg-muted)] hover:bg-[var(--card-bg)] focus:bg-[var(--bg-base)] border border-[var(--border)] rounded-2xl outline-none focus:ring-4 focus:ring-[var(--accent-glow)] transition-all text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-faint)] shadow-sm"
                    placeholder="e.g. alex_smith or alex@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full py-4.5 bg-gradient-to-r from-[var(--accent)] to-indigo-600 text-white rounded-2xl font-black tracking-tight transition-all shadow-xl shadow-[var(--accent-glow)] active:scale-[0.98] hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="animate-pulse">Verifying Identity...</span>
                  </>
                ) : (
                  <>
                    Find My Account
                    <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Link */}
        {!isSent && (
          <div className="mt-10 text-center animate-in fade-in duration-1000 delay-500">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-3 text-sm font-black uppercase tracking-widest text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-all group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-2 transition-transform" />
              Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
