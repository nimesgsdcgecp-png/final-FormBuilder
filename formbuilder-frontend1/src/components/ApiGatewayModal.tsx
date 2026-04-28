'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Code2, Cpu, Globe, Link2, AlertCircle, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { generateIntegration } from '@/services/api';
import { FORMS, API_BASE } from '@/utils/apiConstants';

interface ApiGatewayModalProps {
  formId: string | number;
  publicShareToken?: string;
  formTitle: string;
  formStatus: string;
  isOpen: boolean;
  onClose: () => void;
  formSchema: any;
}

const frameworks = [
  { id: 'react', name: 'React', icon: Code2, description: 'Standard React hook-based component' },
  { id: 'nextjs', name: 'Next.js', icon: Cpu, description: 'Client component for Next.js 13+' },
  { id: 'vue', name: 'Vue 3', icon: globe => <Terminal size={18} />, description: 'Composition API with <script setup>' },
  { id: 'html', name: 'HTML/JS', icon: Globe, description: 'Standalone HTML page with vanilla JS' },
];

export default function ApiGatewayModal({
  formId,
  publicShareToken,
  formTitle,
  formStatus,
  isOpen,
  onClose,
  formSchema
}: ApiGatewayModalProps) {
  const [activeTab, setActiveTab] = useState<'HOSTED' | 'API' | 'AI'>('HOSTED');
  const [selectedFramework, setSelectedFramework] = useState('react');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isDraft = formStatus !== 'PUBLISHED';
  const formCode = formSchema?.code || formId;
  const getUrl = `${API_BASE}/runtime/forms/${formCode}`;
  const postUrl = `${API_BASE}/runtime/forms/${formCode}/submissions`;

  const hostedUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${publicShareToken}` : '';
  const iframeSnippet = `<iframe src="${hostedUrl}" width="100%" height="600px" frameborder="0"></iframe>`;

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    setGeneratedCode('');
    try {
      const code = await generateIntegration(selectedFramework, formSchema);
      setGeneratedCode(code);
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Modal */}
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-[var(--border)] shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col bg-[var(--bg-surface)] backdrop-blur-2xl"
        style={{ 
          boxShadow: 'var(--card-shadow-lg)'
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-muted)]/30">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">API Gateway</h2>
            </div>
            <p className="text-sm text-[var(--text-muted)] mt-1">Manage integrations for "{formTitle}"</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Warning */}
        {isDraft && (
          <div className="px-6 py-3 bg-[var(--status-draft-bg)] border-b border-[var(--status-draft-ring)]/20 flex items-center gap-3">
            <AlertCircle size={16} className="text-[var(--status-draft-text)] shrink-0" />
            <p className="text-xs text-[var(--status-draft-text)] font-medium">
              This form is currently in <span className="font-bold underline underline-offset-2 uppercase tracking-wide">Draft</span>. 
              Submissions may not work until published.
            </p>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-64 border-r border-[var(--border)] p-4 space-y-2 bg-[var(--bg-muted)]/50">
            <button
              onClick={() => setActiveTab('HOSTED')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'HOSTED' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-md border border-[var(--border)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Link2 size={18} />
              Hosted Form
            </button>
            <button
              onClick={() => setActiveTab('API')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'API' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-md border border-[var(--border)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Cpu size={18} />
              API Access
            </button>
            <button
              onClick={() => setActiveTab('AI')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === 'AI' ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-md border border-[var(--border)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Terminal size={18} className="text-blue-500" />
              AI Generator
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeTab === 'HOSTED' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <section>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                    Shareable Link
                  </h3>
                  <div className="relative group">
                    <input 
                      readOnly 
                      value={hostedUrl}
                      className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-5 py-4 text-sm text-[var(--accent)] font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all"
                    />
                    <div className="absolute right-2 top-2 flex gap-2">
                      <button 
                        onClick={() => handleCopy(hostedUrl, 'url')}
                        className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all hover:scale-105 active:scale-95"
                      >
                        {copiedField === 'url' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                      </button>
                      <a 
                        href={hostedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all hover:scale-105 active:scale-95"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest mb-4 flex items-center gap-2">
                    <div className="w-1.5 h-4 bg-purple-500 rounded-full" />
                    Iframe Embed
                  </h3>
                  <div className="relative group">
                    <textarea 
                      readOnly 
                      rows={3}
                      value={iframeSnippet}
                      className="w-full bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-5 py-4 text-sm text-purple-600 dark:text-purple-400 font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent)] transition-all resize-none shadow-inner"
                    />
                    <button 
                      onClick={() => handleCopy(iframeSnippet, 'iframe')}
                      className="absolute right-2 top-2 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all hover:scale-105"
                    >
                      {copiedField === 'iframe' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'API' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                      1. Metadata Fetch
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded border border-emerald-500/20 uppercase">GET</span>
                  </div>
                  <div className="bg-[var(--bg-muted)]/50 rounded-2xl border border-[var(--border)] overflow-hidden">
                    <div className="px-5 py-3 bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center justify-between">
                      <span className="text-xs font-mono text-[var(--text-muted)] truncate mr-4">{getUrl}</span>
                      <button onClick={() => handleCopy(getUrl, 'api-get')} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                        {copiedField === 'api-get' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <pre className="p-5 text-[11px] leading-relaxed text-purple-600 dark:text-purple-300/90 font-mono overflow-x-auto">
{`{
  "code": "${formCode}",
  "title": "${formTitle}",
  "fields": [ ... ],
  "status": "PUBLISHED"
}`}
                    </pre>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-orange-500 rounded-full" />
                      2. Form Submission
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded border border-orange-500/20 uppercase">POST</span>
                  </div>
                  <div className="bg-[var(--bg-muted)]/50 rounded-2xl border border-[var(--border)] overflow-hidden">
                    <div className="px-5 py-3 bg-[var(--bg-surface)] border-b border-[var(--border)] flex items-center justify-between">
                      <span className="text-xs font-mono text-[var(--text-muted)] truncate mr-4">{postUrl}</span>
                      <button onClick={() => handleCopy(postUrl, 'api-post')} className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                        {copiedField === 'api-post' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                    <pre className="p-5 text-[11px] leading-relaxed text-purple-600 dark:text-purple-300/90 font-mono overflow-x-auto">
{`{
  "data": {
    "field_key_1": "value",
    "field_key_2": 123
  },
  "status": "FINAL"
}`}
                    </pre>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'AI' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {!generatedCode ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {frameworks.map((fw) => (
                        <button
                          key={fw.id}
                          onClick={() => setSelectedFramework(fw.id)}
                          className={`p-5 rounded-3xl border text-left transition-all group ${
                            selectedFramework === fw.id 
                              ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/20' 
                              : 'bg-[var(--bg-muted)] border-[var(--border)] hover:border-[var(--accent)]'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${
                            selectedFramework === fw.id ? 'bg-blue-500 text-white shadow-lg' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                          }`}>
                            {React.isValidElement(fw.icon) ? fw.icon : <fw.icon size={20} />}
                          </div>
                          <h4 className={`font-bold text-sm ${selectedFramework === fw.id ? 'text-blue-500' : 'text-[var(--text-primary)]'}`}>{fw.name}</h4>
                          <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed">{fw.description}</p>
                        </button>
                      ))}
                    </div>

                    <button 
                      onClick={handleGenerateCode}
                      disabled={isGenerating}
                      className="w-full py-5 rounded-3xl gradient-accent shadow-xl text-white font-bold text-sm tracking-widest flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Architecting Integration...
                        </>
                      ) : (
                        <>
                          <Cpu size={20} className="animate-pulse" />
                          Generate Frontend Integration
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal size={14} className="text-blue-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-tighter">AI Generated Integration: {selectedFramework.toUpperCase()}</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleCopy(generatedCode, 'code')}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[10px] font-bold text-[var(--text-primary)] transition-all active:scale-95"
                        >
                          {copiedField === 'code' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          {copiedField === 'code' ? 'Copied' : 'Copy Code'}
                        </button>
                        <button 
                          onClick={() => setGeneratedCode('')}
                          className="px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] hover:bg-red-500/10 text-[10px] font-bold text-[var(--text-muted)] hover:text-red-500 transition-all text-gray-400"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div className="relative group">
                      <pre className="p-6 rounded-3xl bg-[var(--bg-muted)] border border-[var(--border)] text-[11px] leading-relaxed font-mono text-purple-600 dark:text-purple-300/90 overflow-x-auto max-h-[400px] custom-scrollbar selection:bg-purple-500/30 shadow-inner">
                        {generatedCode}
                      </pre>
                      <div className="absolute top-0 right-0 p-4 pointer-events-none opacity-5 transition-opacity group-hover:opacity-10 dark:opacity-20 dark:group-hover:opacity-40">
                         <Terminal size={80} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-[var(--accent)]/5 rounded-2xl border border-[var(--accent)]/10">
                       <Cpu size={16} className="text-[var(--accent)] shrink-0" />
                       <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
                         This component is dynamically architected based on your specific form schema. It includes state management, API synchronization, and primitive validation logic.
                       </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[var(--bg-muted)]/50 border-t border-[var(--border)] flex items-center justify-between text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest px-8">
           <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> SYSTEM SECURE</span>
           </div>
        </div>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .gradient-accent {
          background: linear-gradient(135deg, #3b82f6 0%%, #8b5cf6 100%%);
        }
      `}</style>
    </div>
  );
}
