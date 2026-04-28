'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ArrowRight, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { AUTH, postOptions } from '@/utils/apiConstants';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  useEffect(() => {
    if (!token) {
      toast.error("Invalid or missing reset token");
      router.push('/login');
    }
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isLoading) return;

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(AUTH.RESET_PASSWORD, postOptions({ token, password }));
      
      if (res.ok) {
        setIsSuccess(true);
        toast.success("Security updated successfully!");
        setTimeout(() => router.push('/login'), 2500);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to reset password");
      }
    } catch (err) {
      toast.error("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden" 
         style={{ background: 'var(--bg-base)' }}>
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500 opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[var(--accent)] opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header Area */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/20 mb-8 transform hover:scale-105 transition-transform duration-500">
             <KeyRound className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)]">New Credentials</h1>
          <p className="mt-4 text-sm text-[var(--text-muted)] max-w-sm mx-auto font-medium leading-relaxed">
            Your identity is verified. Please establish a strong, unique password for your account protection.
          </p>
        </div>

        {/* Main Glassmorphism Card */}
        <div className="bg-[var(--card-bg)] backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-[var(--card-border)] p-10 transform transition-all duration-500 hover:shadow-[0_30px_60px_rgba(0,0,0,0.12)]">
          
          {isSuccess ? (
            <div className="text-center space-y-8 animate-in zoom-in-95 duration-500">
               <div className="flex justify-center">
                 <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                   <CheckCircle2 className="w-10 h-10 text-emerald-500 animate-in spin-in-12 duration-1000" />
                 </div>
               </div>
               <div className="space-y-3">
                 <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">Access Restored</h2>
                 <p className="text-sm text-[var(--text-muted)] font-medium">
                   Your password has been updated securely. Redirecting you to the sign-in portal...
                 </p>
               </div>
               <div className="w-full h-1 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                 <div className="h-full bg-emerald-500 animate-[progress_2.5s_linear_forwards]" />
               </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-5">
                
                {/* Password Field */}
                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.2em] font-black uppercase text-[var(--text-faint)] ml-1">
                    New Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[var(--text-faint)] group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-14 pr-6 py-4.5 bg-[var(--bg-muted)] hover:bg-[var(--card-bg)] focus:bg-[var(--bg-base)] border border-[var(--border)] rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-faint)] shadow-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-3">
                  <label className="text-[10px] tracking-[0.2em] font-black uppercase text-[var(--text-faint)] ml-1">
                    Verify Password
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-[var(--text-faint)] group-focus-within:text-emerald-500 transition-colors" />
                    </div>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-14 pr-6 py-4.5 bg-[var(--bg-muted)] hover:bg-[var(--card-bg)] focus:bg-[var(--bg-base)] border border-[var(--border)] rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-faint)] shadow-sm"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

              </div>

              <button
                type="submit"
                disabled={isLoading || !password || !confirmPassword}
                className="w-full py-4.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-black tracking-tight transition-all shadow-xl shadow-emerald-500/20 active:scale-[0.98] hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="animate-pulse">Updating Security...</span>
                  </>
                ) : (
                  <>
                    Reset Password
                    <ArrowRight className="w-5 h-4 group-hover:translate-x-2 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
