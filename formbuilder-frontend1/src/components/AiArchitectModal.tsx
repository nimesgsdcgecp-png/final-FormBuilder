'use client';

import React, { useState, useEffect, useRef } from 'react';

import { Sparkles, X, Send, Wand2, Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import { FormSchema } from '@/types/schema';
import { AI } from '@/utils/apiConstants';

interface AiArchitectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (schema: FormSchema) => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
  schema?: FormSchema;
}

export default function AiArchitectModal({ isOpen, onClose, onImport }: AiArchitectModalProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSchema, setCurrentSchema] = useState<FormSchema | null>(null);
  const [history, setHistory] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

    const [thinkingMessage, setThinkingMessage] = useState('Thinking...');
    const thinkingMessages = [
        "Architecting form structure...",
        "Designing optimal field types...",
        "Configuring validation rules...",
        "Linking logic conditions...",
        "Optimizing user experience...",
        "Finalizing schema design..."
    ];

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isLoading) {
            let i = 0;
            setThinkingMessage(`Analyzing your request for "${input || 'form'}"...`);
            interval = setInterval(() => {
                setThinkingMessage(thinkingMessages[i % thinkingMessages.length]);
                i++;
            }, 2500);
        }
        return () => clearInterval(interval);
    }, [isLoading, input]);

  const handleSend = async (customPrompt?: string) => {
    const prompt = customPrompt || input;
    if (!prompt.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: prompt };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(AI.CHAT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt, history })
      });

      if (!res.ok) throw new Error('Failed to reach Form Architect');

      const data = await res.text();
      let parsedSchema: FormSchema | null = null;
      
      try {
        const jsonMatch = data.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedSchema = JSON.parse(jsonMatch[0]);
        }
      } catch (err) {
        console.error("Failed to parse AI generated JSON", err);
      }

      // Extract the conversational text (non-JSON part)
      let conversationalText = data;
      if (parsedSchema) {
        conversationalText = data.replace(/\{[\s\S]*\}/, '').trim();
        // If the AI put the JSON in code blocks, try to clean those too
        conversationalText = conversationalText.replace(/```json|```/g, '').trim();
        
        if (!conversationalText) {
           conversationalText = "I've architected a form design based on your requirements. Review the preview below to see if it meets your needs.";
        }
      }

      const aiMsg: Message = { 
        role: 'ai', 
        content: conversationalText,
        schema: parsedSchema || undefined
      };

      setMessages(prev => [...prev, aiMsg]);
      if (parsedSchema) setCurrentSchema(parsedSchema);
      setHistory(prev => prev + `\nUser: ${prompt}\nAI: ${data}`);

    } catch (error) {
      toast.error("Form Architect service is currently unavailable.");
      setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I'm having trouble connecting to the Form Architect engine. Please ensure the backend and AI provider are online." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-300"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-4xl max-h-[85vh] rounded-[24px] overflow-hidden flex flex-col relative border shadow-2xl transition-colors duration-200 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
          style={{ 
            background: 'var(--bg-surface)', 
            borderColor: 'var(--border)',
            boxShadow: 'var(--card-shadow-lg)'
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-8 py-5 border-b transition-colors duration-200"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
                 <Wand2 size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Form Architect</h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-bold" style={{ color: 'var(--accent)' }}>
                  <Sparkles size={10} className="animate-pulse" />
                  AI DESIGN ENGINE ACTIVE
                </div>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-[var(--bg-muted)] rounded-xl transition-colors"
              style={{ color: 'var(--text-faint)' }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar scroll-smooth transition-colors duration-200" style={{ background: 'var(--bg-base)' }}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-10">
                <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                   <Sparkles size={40} />
                </div>
                <div className="space-y-2">
                  <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    How can I help you today?
                  </h1>
                  <p className="text-lg max-w-md mx-auto" style={{ color: 'var(--text-muted)' }}>
                    Describe your form requirements in natural language and I'll architect the perfect structure for you.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-6">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-[20px] px-6 py-4 shadow-sm transition-all duration-200 ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'border'
                    }`}
                    style={msg.role === 'ai' ? { background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' } : {}}
                    >
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap font-medium ${msg.role === 'user' ? 'text-white' : ''}`}>{msg.content}</p>
                      
                      {msg.schema && (
                        <div className="mt-6 p-5 rounded-2xl border space-y-6 transition-colors duration-200" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
                           <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Architect Propose</span>
                              <div className="flex gap-2">
                                 <span className="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase border" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', borderColor: 'var(--accent-muted)' }}>{(msg.schema?.fields?.length || 0)} Fields</span>
                                 <span className="text-[9px] px-2 py-0.5 rounded-md font-bold uppercase border" style={{ background: 'var(--then-bg, #f5f3ff25)', color: '#8b5cf6', borderColor: 'var(--then-border, #4f29f7)' }}>{msg.schema?.rules?.length || 0} Rules</span>
                              </div>
                           </div>
                           
                            <div className="space-y-1">
                              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{msg.schema.title}</h3>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{msg.schema.description}</p>
                           </div>

                           {/* Visual Field Preview */}
                           <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar py-2">
                               {msg.schema?.fields?.map((f, idx) => (
                                   <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border shadow-sm transition-colors duration-200" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                       <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                                            <div className="text-[10px] font-bold uppercase">{f.type === 'SECTION_HEADER' ? 'SEC' : f.type.substring(0, 3)}</div>
                                       </div>
                                       <div className="min-w-0">
                                           <div className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>{f.label}</div>
                                           <div className="text-[9px] uppercase font-medium" style={{ color: 'var(--text-faint)' }}>{f.type.replace('_', ' ')} • {f.columnName}</div>
                                       </div>
                                   </div>
                               )) || (
                                 <div className="text-[10px] text-center py-4 text-[var(--text-faint)] italic">No fields generated for this proposal</div>
                               )}
                           </div>

                           <div className="flex gap-3">
                               <button 
                                 onClick={() => {
                                     sessionStorage.setItem('form_draft_preview', JSON.stringify(msg.schema));
                                     window.open('/preview/draft', '_blank');
                                 }}
                                 className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border active:scale-95 shadow-sm"
                                 style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                               >
                                 Preview in New Tab
                               </button>
                               <button 
                                 onClick={() => onImport(msg.schema!)}
                                 className="flex-[2] flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/10 active:scale-95"
                               >
                                 <Check size={14} /> Import to Builder
                               </button>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex flex-col gap-2">
                       <div 
                         className="relative px-6 py-4 rounded-[22px] rounded-tl-none border shadow-lg overflow-hidden flex items-center gap-3 transition-all"
                         style={{ 
                            background: 'rgba(255, 255, 255, 0.03)', 
                            backdropFilter: 'blur(12px)',
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
                         }}
                       >
                          {/* Animated Glow Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-blue-500/10 animate-pulse" />
                          
                          <div className="flex gap-1 relative z-10">
                            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                          </div>
                          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest relative z-10">{thinkingMessage}</span>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Input Area */}
          <div 
            className="p-8 pt-4 border-t transition-colors duration-200"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="max-w-3xl mx-auto">
              <div 
                className="flex items-center gap-3 border rounded-2xl p-2 pl-5 shadow-sm focus-within:shadow-md focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-all"
                style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={"E.g., Build a medical appointment form with date/time picker..."}
                  className="flex-1 bg-transparent border-none outline-none text-sm py-3 placeholder-gray-400 dark:placeholder-gray-500"
                  style={{ color: 'var(--text-primary)' }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:bg-gray-300 dark:disabled:bg-gray-800"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="mt-4 text-[10px] text-center flex items-center justify-center gap-1.5" style={{ color: 'var(--text-faint)' }}>
                <Info size={12} />
                Form Architect AI is built to help you design structure. Always review generated rules before publishing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
