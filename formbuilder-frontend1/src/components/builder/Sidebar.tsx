// src/components/builder/Sidebar.tsx
'use client';

/**
 * Sidebar — Field Type Palette for the Form Builder
 *
 * What it does:
 *   Renders the left panel of the builder with all available field types. Each type
 *   is displayed as a {@link DraggableSidebarBtn} that can be dragged onto the Canvas
 *   to add a new field. The panel is user-resizable via a drag handle on its right edge.
 */

import { useDroppable } from '@dnd-kit/core';
import { FieldType } from '@/types/schema';
import { Type, Hash, Calendar, ToggleLeft, AlignLeft, List, Disc, Layers, Clock, Star, BarChartHorizontal, Upload, Grid3X3, Table, Link2, Heading, Info, Divide, CalendarClock, EyeOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DraggableSidebarBtn } from './DraggableSidebarBtn';
import { useState, useEffect, useRef, useCallback } from 'react';

interface FieldGroup {
  label: string;
  color: string;
  fields: { type: FieldType; label: string; icon: LucideIcon; category: string }[];
}

export const FIELD_TYPES = [
  { type: 'TEXT' as FieldType, label: 'Text Input', icon: Type, category: 'basic' },
  { type: 'NUMERIC' as FieldType, label: 'Number', icon: Hash, category: 'basic' },
  { type: 'DATE' as FieldType, label: 'Date Picker', icon: Calendar, category: 'basic' },
  { type: 'DATE_TIME' as FieldType, label: 'Date & Time', icon: CalendarClock, category: 'basic' },
  { type: 'BOOLEAN' as FieldType, label: 'Checkbox', icon: ToggleLeft, category: 'basic' },
  { type: 'TEXTAREA' as FieldType, label: 'Long Text', icon: AlignLeft, category: 'basic' },
  { type: 'HIDDEN' as FieldType, label: 'Hidden Field', icon: EyeOff, category: 'basic' },
  { type: 'DROPDOWN' as FieldType, label: 'Dropdown', icon: List, category: 'choice' },
  { type: 'RADIO' as FieldType, label: 'Multiple Choice', icon: Disc, category: 'choice' },
  { type: 'CHECKBOX_GROUP' as FieldType, label: 'Checkboxes', icon: Layers, category: 'choice' },
  { type: 'TIME' as FieldType, label: 'Time', icon: Clock, category: 'special' },
  { type: 'RATING' as FieldType, label: 'Star Rating', icon: Star, category: 'special' },
  { type: 'SCALE' as FieldType, label: 'Linear Scale', icon: BarChartHorizontal, category: 'special' },
  { type: 'CALCULATED' as FieldType, label: 'Calculated Field', icon: Hash, category: 'special' },
  { type: 'FILE' as FieldType, label: 'File Upload', icon: Upload, category: 'special' },
  { type: 'GRID_RADIO' as FieldType, label: 'Multiple Choice Grid', icon: Grid3X3, category: 'grid' },
  { type: 'GRID_CHECK' as FieldType, label: 'Checkbox Grid', icon: Table, category: 'grid' },
  { type: 'LOOKUP' as FieldType, label: 'Linked Data', icon: Link2, category: 'lookup' },
  { type: 'SECTION_HEADER' as FieldType, label: 'Section Header', icon: Heading, category: 'layout' },
  { type: 'INFO_LABEL' as FieldType, label: 'Info / Label', icon: Info, category: 'layout' },
  { type: 'PAGE_BREAK' as FieldType, label: 'Page Break', icon: Divide, category: 'layout' },
];

const GROUPS: FieldGroup[] = [
  { label: 'Basic', color: '#3b82f6', fields: FIELD_TYPES.filter(f => f.category === 'basic') },
  { label: 'Choice', color: '#8b5cf6', fields: FIELD_TYPES.filter(f => f.category === 'choice') },
  { label: 'Special', color: '#f59e0b', fields: FIELD_TYPES.filter(f => f.category === 'special') },
  { label: 'Grid', color: '#10b981', fields: FIELD_TYPES.filter(f => f.category === 'grid') },
  { label: 'Lookup', color: '#ec4899', fields: FIELD_TYPES.filter(f => f.category === 'lookup') },
  { label: 'Layout', color: '#64748b', fields: FIELD_TYPES.filter(f => f.category === 'layout') },
];

export default function Sidebar() {
  const { setNodeRef: setDropRef } = useDroppable({ id: 'sidebar-palette' });

  // ── Resize logic ─────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const isResizing = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    lastX.current = e.clientX;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      setSidebarWidth(prev => Math.min(420, Math.max(180, prev + delta)));
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);
  // ─────────────────────────────────────────────────────────

  const panelRef = useCallback((node: HTMLElement | null) => {
    setDropRef(node);
  }, [setDropRef]);

  return (
    <aside
      ref={panelRef}
      className="flex flex-col h-full z-10 border-r shrink-0 relative"
      style={{
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
        width: sidebarWidth,
        minWidth: 180,
        maxWidth: 420,
      }}
    >
      {/* Sidebar header */}
      <div className="px-4 py-4 border-b shrink-0" style={{ borderColor: 'var(--sidebar-border)' }}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Form Elements</h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Drag fields onto the canvas</p>
      </div>

      {/* Scrollable field type list */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-2 px-1 mb-2">
              <div className="h-2 w-2 rounded-full" style={{ background: group.color }} />
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
                {group.label}
              </span>
            </div>
            {group.fields.map((field) => (
              <DraggableSidebarBtn
                key={field.type}
                type={field.type}
                label={field.label}
                icon={field.icon}
                category={field.category}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Resize handle — right edge */}
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
        style={{ touchAction: 'none' }}
        title="Drag to resize sidebar"
      >
        <div
          className="absolute right-0 top-0 bottom-0 w-1 transition-all rounded-full"
          style={{ background: 'var(--border)', opacity: 0.5 }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--accent)';
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.width = '3px';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--border)';
            (e.currentTarget as HTMLElement).style.opacity = '0.5';
            (e.currentTarget as HTMLElement).style.width = '4px';
          }}
        />
      </div>
    </aside>
  );
}
