import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Trash2, Type, Hash, Calendar, ToggleLeft, AlignLeft,
  List, Disc, Layers, Clock, Star, BarChartHorizontal, Upload,
  Grid3X3, Table, Link2, Heading, Info, Divide, Plus, ChevronDown, ChevronRight,
  EyeOff, CalendarClock
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FormField } from '@/types/schema';
import React, { useState } from 'react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { useFormStore } from '@/store/useFormStore';

interface SortableFieldProps {
  field: FormField;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  isNested?: boolean;
}

/** Map each FieldType to its icon and category color */
const FIELD_TYPE_META: Record<string, { icon: LucideIcon; iconColor: string; iconBg: string; label: string }> = {
  TEXT: { icon: Type, iconColor: '#3b82f6', iconBg: '#eff6ff', label: 'Text Input' },
  NUMERIC: { icon: Hash, iconColor: '#3b82f6', iconBg: '#eff6ff', label: 'Number' },
  DATE: { icon: Calendar, iconColor: '#3b82f6', iconBg: '#eff6ff', label: 'Date Picker' },
  DATE_TIME: { icon: CalendarClock, iconColor: '#3b82f6', iconBg: '#eff6ff', label: 'Date & Time' },
  BOOLEAN: { icon: ToggleLeft, iconColor: '#3b82f6', iconBg: '#eff6ff', label: 'Checkbox' },
  TEXTAREA: { icon: AlignLeft, iconColor: '#3b82f6', iconBg: '#eff6ff', label: 'Long Text' },
  HIDDEN: { icon: EyeOff, iconColor: '#64748b', iconBg: '#f1f5f9', label: 'Hidden Field' },
  DROPDOWN: { icon: List, iconColor: '#8b5cf6', iconBg: '#f5f3ff', label: 'Dropdown' },
  RADIO: { icon: Disc, iconColor: '#8b5cf6', iconBg: '#f5f3ff', label: 'Multiple Choice' },
  CHECKBOX_GROUP: { icon: Layers, iconColor: '#8b5cf6', iconBg: '#f5f3ff', label: 'Checkboxes' },
  TIME: { icon: Clock, iconColor: '#f59e0b', iconBg: '#fffbeb', label: 'Time' },
  RATING: { icon: Star, iconColor: '#f59e0b', iconBg: '#fffbeb', label: 'Star Rating' },
  SCALE: { icon: BarChartHorizontal, iconColor: '#f59e0b', iconBg: '#fffbeb', label: 'Linear Scale' },
  FILE: { icon: Upload, iconColor: '#f59e0b', iconBg: '#fffbeb', label: 'File Upload' },
  GRID_RADIO: { icon: Grid3X3, iconColor: '#10b981', iconBg: '#ecfdf5', label: 'Choice Grid' },
  GRID_CHECK: { icon: Table, iconColor: '#10b981', iconBg: '#ecfdf5', label: 'Checkbox Grid' },
  LOOKUP: { icon: Link2, iconColor: '#ec4899', iconBg: '#fdf2f8', label: 'Linked Data' },
  SECTION_HEADER: { icon: Heading, iconColor: '#64748b', iconBg: '#f1f5f9', label: 'Section' },
  INFO_LABEL: { icon: Info, iconColor: '#64748b', iconBg: '#f1f5f9', label: 'Info / Label' },
  PAGE_BREAK: { icon: Divide, iconColor: '#ec4899', iconBg: '#fdf2f8', label: 'Page Break' },
  CALCULATED: { icon: Hash, iconColor: '#f59e0b', iconBg: '#fffbeb', label: 'Calculated' },
};

export function SortableField({ field, onRemove, onSelect, isNested = false }: SortableFieldProps) {
  const selectedFieldId = useFormStore(state => state.selectedFieldId);
  const isSelected = selectedFieldId === field.id;
  const [isExpanded, setIsExpanded] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });

  // The section's OWN droppable zone (covers whole children area)
  const { setNodeRef: setSectionDropRef, isOver: isSectionOver } = useDroppable({
    id: `section-${field.id}`,
    data: { isSection: true, parentId: field.id }
  });

  // Full DnD context so we can read active drag type and current over target
  const { active, over } = useDndContext();

  const meta = FIELD_TYPE_META[field.type] || FIELD_TYPE_META.TEXT;
  const FieldIcon = meta.icon;
  const isSection = field.type === 'SECTION_HEADER';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    /** Hide the original while it is being dragged — the DragOverlay renders
     *  the visual copy at the cursor position. Without this, the sortable
     *  transform physically moves the DOM element (e.g. up into a section),
     *  creating a confusing 'field inside wrong container' artefact. */
    opacity: isDragging ? 0 : 1,
    pointerEvents: (isDragging ? 'none' : undefined) as React.CSSProperties['pointerEvents'],
  };

  // ── Drag classification ──────────────────────────────────────────────────
  const isAnythingDragging = !!active;
  /** True when the item being dragged came from the sidebar palette */
  const isDraggingNewField = !!active?.data.current?.isSidebarBtn;
  /** True when an existing canvas field is being repositioned */
  const isDraggingExistingField = isAnythingDragging && !isDraggingNewField;
  /** The field type label shown in the placeholder (sidebar drags only) */
  const draggingType = active?.data.current?.type as string | undefined;

  // Block PAGE_BREAK and SECTION_HEADER from entering sections
  // Only relevant for sidebar drags (existing drags are blocked in handleDragEnd)
  const isBlockedForSection = isDraggingNewField &&
    (draggingType === 'PAGE_BREAK' || draggingType === 'SECTION_HEADER');

  // ── Child drop index detection ───────────────────────────────────────────
  const children = field.children ?? [];
  /**
   * Index of the child that `over` currently resolves to.
   * -1 means the dragged item is not directly over any child (hovering the
   * section zone itself, or between children below the last item).
   */
  const overChildIndex = over ? children.findIndex(c => c.id === over.id) : -1;

  /**
   * Should we render a "drop here" placeholder between children?
   * Yes for BOTH sidebar drags and existing-field drags, as long as the item
   * is not blocked (PAGE_BREAK / SECTION_HEADER into section).
   */
  const showBetweenPlaceholders = isAnythingDragging && !isBlockedForSection;

  /**
   * Label inside the placeholder bubble.
   * Sidebar drag  → "Insert TEXT here"
   * Existing drag → "Move field here"
   */
  const placeholderLabel = isDraggingNewField
    ? `Insert ${draggingType ?? 'field'} here`
    : 'Move field here';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/field ${isNested ? 'ml-4' : ''}`}
    >
      {/* ── Field card ─────────────────────────────────────────────────── */}
      <div
        className={`relative flex items-center gap-3 p-4 mb-2 rounded-xl border cursor-pointer transition-all duration-150 ${isSelected ? 'shadow-md scale-[1.01]' : 'shadow-sm'}`}
        style={{
          background: 'var(--card-bg)',
          borderColor: isSelected ? 'var(--accent)' : 'var(--card-border)',
          boxShadow: isSelected ? '0 0 0 3px var(--accent-muted)' : 'var(--card-shadow)',
        }}
        onClick={(e) => { e.stopPropagation(); onSelect(field.id); }}
      >
        {/* Grip handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing shrink-0 transition-colors"
          style={{ color: 'var(--text-faint)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={18} />
        </div>

        {field.type === 'PAGE_BREAK' ? (
          <div className="flex-1 flex items-center gap-4 py-2">
            <div className="h-0.5 flex-1 rounded-full opacity-20" style={{ background: 'var(--accent)' }} />
            <div className="flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest"
              style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)', color: 'var(--accent)' }}>
              <Divide size={12} />
              Page End / New Step
            </div>
            <div className="h-0.5 flex-1 rounded-full opacity-20" style={{ background: 'var(--accent)' }} />
          </div>
        ) : (
          <>
            {/* Collapse/Expand toggle for sections */}
            {isSection && (
              <button
                onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                className="p-1 rounded hover:bg-gray-100 transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}

            {/* Icon */}
            <div className="p-2 rounded-lg shrink-0" style={{ background: meta.iconBg }}>
              <FieldIcon size={16} style={{ color: meta.iconColor }} />
            </div>

            {/* Label */}
            <div className="flex-1 min-w-0 pointer-events-none">
              <div className="flex items-center gap-2">
                <label
                  className={`text-sm font-semibold truncate ${isSection ? 'text-base' : ''}`}
                  style={{ color: 'var(--text-primary)' }}
                >
                  {field.label || 'Untitled Field'}
                </label>
                {field.validation.required && (
                  <span className="text-red-500 text-xs font-bold shrink-0">*</span>
                )}
              </div>
              <div className="text-[11px] mt-0.5 font-medium" style={{ color: 'var(--text-faint)' }}>
                {meta.label}
              </div>
            </div>
          </>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}
          className="p-2 rounded-lg transition-all shrink-0 opacity-0 group-hover/field:opacity-100 hover:bg-red-50 hover:text-red-600"
          style={{ color: 'var(--text-faint)' }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ── Section children drop zone ──────────────────────────────────── */}
      {isSection && isExpanded && (
        <div
          ref={setSectionDropRef}
          className={`ml-8 mt-1 mb-4 p-3 rounded-xl border-2 border-dashed transition-all min-h-[64px] ${
            isSectionOver && !isBlockedForSection
              ? 'border-[var(--accent)] bg-[var(--accent-subtle)] ring-2 ring-[var(--accent-muted)]'
              : isBlockedForSection && isSectionOver
              ? 'border-red-300 bg-red-50/40'
              : 'border-transparent bg-gray-50/50 dark:bg-white/5'
          }`}
        >
          {/* "Blocked" hint when trying to drop PAGE_BREAK or nested SECTION */}
          {isSectionOver && isBlockedForSection && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-red-500">
              <Divide size={14} />
              {draggingType === 'PAGE_BREAK'
                ? 'Page Break cannot be placed inside a Section'
                : 'Section cannot be nested inside another Section'}
            </div>
          )}

          {/* Children list */}
          <SortableContext items={children.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0">
              {children.length === 0 ? (
                /* Empty state */
                !isAnythingDragging || isBlockedForSection ? (
                  <div className="flex flex-col items-center justify-center py-6 opacity-30">
                    <Plus size={20} className="mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Drop fields here</span>
                  </div>
                ) : (
                  /* Actively dragging something valid — show a welcoming zone */
                  <div className="h-[68px] rounded-xl border-2 border-dashed flex items-center justify-center animate-pulse"
                    style={{ borderColor: 'var(--accent)', background: 'var(--accent-subtle)' }}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                      <Plus size={13} /> {placeholderLabel}
                    </div>
                  </div>
                )
              ) : (
                children.map((child, index) => (
                  <React.Fragment key={child.id}>
                    {/* ── Drop placeholder BEFORE each child ──
                        Shown for both sidebar AND existing canvas drags */}
                    {showBetweenPlaceholders && overChildIndex === index && (
                      <div
                        className="h-[68px] rounded-xl border-2 border-dashed flex items-center justify-center mb-2 animate-in fade-in zoom-in duration-150"
                        style={{ borderColor: 'var(--accent)', background: 'var(--accent-subtle)' }}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                          <Plus size={13} />
                          {placeholderLabel}
                        </div>
                      </div>
                    )}
                    <SortableField
                      field={child}
                      onRemove={onRemove}
                      onSelect={onSelect}
                      isNested
                    />
                  </React.Fragment>
                ))
              )}

              {/* ── Drop placeholder AFTER last child (for sidebar drag hovering section zone) ── */}
              {showBetweenPlaceholders && overChildIndex === -1 && isSectionOver && children.length > 0 && (
                <div
                  className="h-[68px] rounded-xl border-2 border-dashed flex items-center justify-center mt-2 animate-in fade-in zoom-in duration-150"
                  style={{ borderColor: 'var(--accent)', background: 'var(--accent-subtle)' }}
                >
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                    <Plus size={13} />
                    {placeholderLabel}
                  </div>
                </div>
              )}
            </div>
          </SortableContext>

          {/* ── Bottom append zone ──
              A separate droppable shown at the bottom of the section so users always
              have an explicit target to append to end, for BOTH sidebar and canvas drags.
              Visible whenever any valid drag is in progress and section has children. */}
          {isAnythingDragging && !isBlockedForSection && children.length > 0 && (
            <SectionBottomZone sectionId={field.id} />
          )}
        </div>
      )}
    </div>
  );
}

/** ─────────────────────────────────────────────────────────────────────────
 * SectionBottomZone
 *
 * An explicit droppable strip at the bottom of a section's children area.
 * Registers with `{ isSection: true, parentId }` so `handleDragEnd` in
 * builder/page.tsx appends the dragged field to the end of this section.
 *
 * Shown for BOTH sidebar drags and existing canvas field drags whenever the
 * section has at least one child.
 * ───────────────────────────────────────────────────────────────────────── */
function SectionBottomZone({ sectionId }: { sectionId: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-bottom-${sectionId}`,
    data: { isSection: true, parentId: sectionId }
  });

  return (
    <div
      ref={setNodeRef}
      className="mt-2 h-10 rounded-xl border-2 border-dashed flex items-center justify-center transition-all"
      style={{
        borderColor: isOver ? 'var(--accent)' : 'var(--border)',
        background: isOver ? 'var(--accent-subtle)' : 'transparent',
        opacity: isOver ? 1 : 0.5,
      }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
        style={{ color: isOver ? 'var(--accent)' : 'var(--text-faint)' }}
      >
        <Plus size={11} /> Add to end of section
      </span>
    </div>
  );
}
