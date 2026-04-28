'use client';

import React, { useMemo, useState } from 'react';
import FormRenderer from '@/components/FormRenderer';
import { FormSchema } from '@/types/schema';
import ThemeToggle from '@/components/ThemeToggle';
import { Monitor, Tablet, Smartphone, Info, Sparkles } from 'lucide-react';

export default function ArchitectDraftPreview() {
    const [viewMode, setViewMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
    
    const schema = useMemo<FormSchema | null>(() => {
        if (typeof window === 'undefined') return null;
        
        // AI Architect saves to sessionStorage to avoid clobbering builder progress
        const saved = sessionStorage.getItem('form_draft_preview');
        if (!saved) return null;
        
        try {
            return JSON.parse(saved) as FormSchema;
        } catch (e) {
            console.error("Failed to parse AI draft schema", e);
            return null;
        }
    }, []);

    if (!schema) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 text-center px-4">
                <div className="w-16 h-16 bg-[var(--accent)]/10 rounded-2xl flex items-center justify-center mb-4 text-[var(--accent)]">
                    <Sparkles size={32} />
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No AI Draft Found</h1>
                <p className="text-gray-500 max-w-xs">Return to the AI Architect and click &apos;Preview in New Tab&apos; to view your generated proposal.</p>
                <button
                    onClick={() => window.close()}
                    className="mt-6 px-6 py-2 bg-black dark:bg-white dark:text-black text-white rounded-lg text-sm font-medium hover:opacity-80 transition-all shadow-sm"
                >
                    Close Tab
                </button>
            </div>
        );
    }

    const containerWidths = {
        mobile: 'max-w-[375px]',
        tablet: 'max-w-[768px]',
        desktop: 'max-w-4xl'
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950/20 flex flex-col">
            {/* Top Banner */}
            <div className="h-14 px-6 flex items-center justify-between bg-white dark:bg-gray-900 border-b dark:border-gray-800 shrink-0 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                            AI ARCHITECT PREVIEW
                        </h2>
                    </div>

                    <div className="hidden sm:flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('mobile')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'mobile' ? 'bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white' : 'text-gray-400'}`}
                            title="Mobile View"
                        >
                            <Smartphone size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('tablet')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'tablet' ? 'bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white' : 'text-gray-400'}`}
                            title="Tablet View"
                        >
                            <Tablet size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('desktop')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'desktop' ? 'bg-white dark:bg-gray-700 shadow-sm text-black dark:text-white' : 'text-gray-400'}`}
                            title="Desktop View"
                        >
                            <Monitor size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-2" />
                    <button
                        onClick={() => window.close()}
                        className="text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors"
                    >
                        Exit Preview
                    </button>
                </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 p-8 flex justify-center overflow-auto">
                <div className={`w-full ${containerWidths[viewMode]} transition-all duration-300 ease-in-out`}>
                    <FormRenderer
                        schema={schema}
                        isPreview={true}
                        submitButtonText="Submit (Preview Only)"
                    />

                    <div className="mt-12 mb-20 text-center space-y-2">
                        <p className="text-xs text-purple-500 flex items-center justify-center gap-2 font-black uppercase tracking-[0.2em]">
                             AI Generated Content Preview
                        </p>
                        <p className="text-[11px] text-gray-400 max-w-md mx-auto leading-relaxed">
                            This is a temporary preview of the form proposed by the AI Architect. 
                            Click &quot;Apply System&quot; in the architect modal to bring these fields into the live builder.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
