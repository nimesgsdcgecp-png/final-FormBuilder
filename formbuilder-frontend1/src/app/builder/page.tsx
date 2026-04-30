'use client';

/**
 * Builder Page — /builder
 *
 * The main drag-and-drop form creation/editing interface. Consists of:
 *   - Left: Sidebar (field type palette — drag sources)
 *   - Centre: Canvas (droppable field canvas) OR LogicPanel (when Logic tab is active)
 *   - Right: PropertiesPanel (field properties editor — only in EDITOR tab)
 */

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  closestCorners,
  CollisionDetection
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useFormStore } from '@/store/useFormStore';
import { FieldType, FormField, FormSchema } from '@/types/schema';
import { saveForm, updateForm } from '@/services/api';
import { toast } from 'sonner';
import LogicPanel from '@/components/builder/LogicPanel';
import CustomValidationsPanel from '@/components/builder/CustomValidationsPanel';
import { validateFormCode, sanitizeFormCode } from '@/utils/codeValidation';
import { usePermissions } from '@/hooks/usePermissions';
import { Archive, GitBranch, Layout, Link2, Save, Palette, Check, ShieldAlert, Plus, Settings2, Lock, AlertCircle, Sparkles } from 'lucide-react';
import { AUTH, FORMS, WORKFLOW, CONFIG } from '@/utils/apiConstants';

import Sidebar, { FIELD_TYPES } from '@/components/builder/Sidebar';
import { SidebarBtnOverlay } from '@/components/builder/DraggableSidebarBtn';
import Canvas from '@/components/builder/Canvas';
import PropertiesPanel from '@/components/builder/PropertiesPanel';
import { SortableField } from '@/components/builder/SortableField';
import { Eye } from 'lucide-react';
import VersionsPanel from '@/components/builder/VersionsPanel';
import AiArchitectModal from '@/components/AiArchitectModal';

interface WorkflowUser {
  id: string | number;
  username: string;
  roles: string[];
}

interface BackendValidationRule {
  id?: string;
  scope?: 'FORM' | 'FIELD';
  fieldKey?: string;
  expression?: string;
  errorMessage?: string;
  executionOrder?: number;
}

interface BackendField {
  id: string | number;
  type: FieldType;
  label: string;
  columnName: string;
  defaultValue?: string;
  options?: unknown;
  required?: boolean;
  validation?: Record<string, unknown>;
  placeholder?: string;
  calculationFormula?: string;
  helpText?: string;
  isHidden?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  isUnique?: boolean;
  isMultiSelect?: boolean;
  children?: BackendField[];
}

interface BackendVersion {
  isActive?: boolean;
  versionNumber?: number;
  rules?: unknown;
  fields: BackendField[];
  formValidations?: BackendValidationRule[];
}

interface BackendFormResponse {
  id: number;
  title: string;
  code?: string;
  codeLocked?: boolean;
  description?: string;
  allowEditResponse?: boolean;
  status?: FormSchema['status'];
  publicShareToken?: string;
  themeColor?: string;
  themeFont?: string;
  versions: BackendVersion[];
}

/**
 * Recursively regenerates all IDs for an imported AI schema to ensure
 * React key uniqueness and stable state management in the builder.
 */
const sanitizeImportedSchema = (schema: FormSchema): FormSchema => {
  const sanitizeFields = (fields: FormField[]): FormField[] => {
    return fields.map(f => ({
      ...f,
      id: crypto.randomUUID(),
      children: f.children ? sanitizeFields(f.children) : undefined
    }));
  };

  const sanitizeConditions = (conditions: any[]): any[] => {
    return conditions.map(c => {
      if (c.type === 'condition') {
        return { ...c, id: crypto.randomUUID() };
      }
      if (c.type === 'group') {
        return {
          ...c,
          id: crypto.randomUUID(),
          conditions: c.conditions ? sanitizeConditions(c.conditions) : []
        };
      }
      return { ...c, id: crypto.randomUUID() }; // Fallback
    });
  };

  const sanitizeRules = (rules: any[]): any[] => {
    return rules.map(r => ({
      ...r,
      id: crypto.randomUUID(),
      conditions: r.conditions ? sanitizeConditions(r.conditions) : []
    }));
  };

  const sanitizeValidations = (validations: any[]): any[] => {
    return validations.map((v, index) => ({
      ...v,
      id: crypto.randomUUID(),
      executionOrder: v.executionOrder ?? index
    }));
  };

  return {
    ...schema,
    fields: schema.fields ? sanitizeFields(schema.fields) : [],
    rules: schema.rules ? sanitizeRules(schema.rules) : [],
    formValidations: schema.formValidations ? sanitizeValidations(schema.formValidations) : []
  };
};

function BuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editFormId = searchParams.get('id');

  const {
    schema, addField, insertField, reorderFields, moveField, setFormId, setTitle, setDescription,
    setFields, setRules, resetForm, setAllowEditResponse, isThemePanelOpen, setThemePanelOpen,
    setThemeColor, setThemeFont, setStatus, setFormValidations
  } = useFormStore();

  const [activeSidebarItem, setActiveSidebarItem] = useState<FieldType | null>(null);
  const [activeCanvasItemId, setActiveCanvasItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'EDITOR' | 'LOGIC' | 'VALIDATIONS' | 'VERSIONS'>('EDITOR');
  const [activeMobileTab, setActiveMobileTab] = useState<'PALETTE' | 'CANVAS' | 'PROPERTIES'>('CANVAS');
  const [initialState, setInitialState] = useState<string>('');
  const isDirty = initialState !== JSON.stringify({ schema });
  const [codeValidationError, setCodeValidationError] = useState<string | null>(null);
  const { hasPermission, assignments } = usePermissions();
  const isPrivileged = assignments.some((a) =>
    ['ADMIN', 'ROLE_ADMIN', 'ROLE_ADMINISTRATOR', 'BUILDER', 'ROLE_BUILDER'].includes(a.role.name)
  );

  // Everyone in the builder whitelist (including USER) can see the editor
  const canAccessBuilder = assignments.some((a) =>
    ['ADMIN', 'ROLE_ADMIN', 'ROLE_ADMINISTRATOR', 'BUILDER', 'ROLE_BUILDER', 'USER', 'ROLE_USER'].includes(a.role.name)
  );

  // Workflow Modal State
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [workflowType, setWorkflowType] = useState<'NORMAL' | 'LEVEL_1' | 'LEVEL_2'>('NORMAL');
  const [availableBuilders, setAvailableBuilders] = useState<WorkflowUser[]>([]);
  const [availableCustomApprovers, setAvailableCustomApprovers] = useState<WorkflowUser[]>([]);
  const [selectedBuilderId, setSelectedBuilderId] = useState<string>('');
  const [selectedApproverIds, setSelectedApproverIds] = useState<string[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [isWorkflowEnabled, setIsWorkflowEnabled] = useState(true);
  const [isRulesEnabled, setIsRulesEnabled] = useState(true);

  useEffect(() => {
    fetch(CONFIG.FEATURES, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          if (typeof data.aiArchitectEnabled === 'boolean') setIsAiEnabled(data.aiArchitectEnabled);
          if (typeof data.workflowEnabled === 'boolean') setIsWorkflowEnabled(data.workflowEnabled);
          if (typeof data.rulesEnabled === 'boolean') setIsRulesEnabled(data.rulesEnabled);
        }
      })
      .catch(() => { });
  }, []);

  // Automatic tab correction if a feature is disabled
  useEffect(() => {
    if (!isRulesEnabled && (activeTab === 'LOGIC' || activeTab === 'VALIDATIONS')) {
      setActiveTab('EDITOR');
    }
  }, [isRulesEnabled, activeTab]);

  useEffect(() => {
    // 1. Check Auth first. If we are just creating a new form, we still need to be logged in.
    const checkAuth = async () => {
      try {
        await fetch(AUTH.ME, { credentials: 'include' });
      } catch {
        router.push('/login');
      }
    };
    checkAuth();


    if (!editFormId) {
      resetForm();
      return;
    }

    fetch(FORMS.GET(editFormId), { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          router.push('/login');
          throw new Error('Unauthorized');
        }
        return res.json();
      })
      .then((data: BackendFormResponse) => {
        const loadedStatus: NonNullable<FormSchema['status']> = data.status ?? 'DRAFT';
        setFormId(data.id);
        setTitle(data.title);
        useFormStore.setState((state) => ({
          schema: { ...state.schema, code: data.code || '', codeLocked: data.codeLocked || false }
        }));
        setDescription(data.description || '');
        setAllowEditResponse(data.allowEditResponse || false);
        setStatus(loadedStatus);

        useFormStore.setState((state) => ({
          schema: { ...state.schema, publicShareToken: data.publicShareToken, status: loadedStatus }
        }));

        if (data.themeColor) setThemeColor(data.themeColor);
        if (data.themeFont) setThemeFont(data.themeFont);

        // Always pick the latest version by versionNumber for editing, 
        // preferring the active one if multiple exist (though usually only one is active).
        const versions = [...data.versions].sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0));
        const activeVersion = versions.find((v) => v.isActive) || versions[0];

        // Load AST custom validations from the active version
        if (activeVersion.formValidations && Array.isArray(activeVersion.formValidations)) {
          setFormValidations(activeVersion.formValidations.map((fv: BackendValidationRule) => ({
            id: fv.id || crypto.randomUUID(),
            scope: fv.scope || 'FORM',
            fieldKey: fv.fieldKey || '',
            expression: fv.expression || '',
            errorMessage: fv.errorMessage || '',
            executionOrder: fv.executionOrder || 0,
          })));
        } else {
          setFormValidations([]);
        }

        let parsedRules: FormSchema['rules'] = [];
        if (activeVersion.rules) {
          let raw: unknown = activeVersion.rules;
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch { }
          }
          // If it's our new wrapper structure { theme, logic }
          if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'logic' in raw) {
            const logicRules = (raw as { logic?: unknown }).logic;
            parsedRules = Array.isArray(logicRules) ? logicRules : [];
          } else {
            parsedRules = Array.isArray(raw) ? raw : [];
          }
        }
        setRules(parsedRules);

        const mapFieldsRecursive = (fields: BackendField[]): FormField[] => {
          return fields.map((f) => {
            let parsedOptions: unknown = [];
            if (f.options) {
              if (typeof f.options === 'string') {
                try { parsedOptions = JSON.parse(f.options); }
                catch { parsedOptions = f.options.split(',').map((s: string) => s.trim()); }
              } else {
                parsedOptions = f.options;
              }
            }
            return {
              id: f.id.toString(),
              type: f.type,
              label: f.label,
              columnName: f.columnName,
              defaultValue: f.defaultValue,
              options: parsedOptions as FormField['options'],
              validation: { required: f.required, ...f.validation },
              placeholder: f.placeholder || '',
              calculationFormula: f.calculationFormula,
              helpText: f.helpText,
              isHidden: f.isHidden,
              isReadOnly: f.isReadOnly,
              isDisabled: f.isDisabled,
              isUnique: f.isUnique,
              isMultiSelect: f.isMultiSelect,
              children: f.children ? mapFieldsRecursive(f.children) : (f.type === 'SECTION_HEADER' ? [] : undefined)
            };
          });
        };

        const mappedFields = mapFieldsRecursive(activeVersion.fields || []);
        setFields(mappedFields);

        // Capture initial state for dirty check after all setters have run
        setTimeout(() => {
          setInitialState(JSON.stringify({
            schema: { ...useFormStore.getState().schema, fields: mappedFields, rules: parsedRules }
          }));
        }, 100);
      })
      .catch(err => {
        console.error("Failed to load form:", err);
        toast.error("Failed to load form data");
      });
  }, [
    editFormId, setFormId, setTitle, setDescription, setFields,
    router, resetForm, setRules, setAllowEditResponse, setStatus,
    setFormValidations, setThemeColor, setThemeFont
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isWorkflowModalOpen) setIsWorkflowModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWorkflowModalOpen]);

  useEffect(() => {
    // Fetch users for workflow selection
    const fetchUsers = async () => {
      try {
        const url = editFormId
          ? `${WORKFLOW.AUTHORITIES}?formId=${editFormId}`
          : WORKFLOW.AUTHORITIES;

        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const users = (await res.json()) as WorkflowUser[];
          // Filter Builders (for final step) - check if any role starts with "BUILDER"
          setAvailableBuilders(users.filter((u) =>
            u.roles.some((r) => r.startsWith('BUILDER'))
          ));
          // Filter Custom Roles (for intermediate steps)
          // A user is a custom approver if they have AT LEAST ONE role that is NOT a static role
          const staticRoles = ['ADMIN', 'ROLE_ADMINISTRATOR', 'BUILDER', 'USER'];
          setAvailableCustomApprovers(users.filter((u) =>
            u.roles.some((r) => !staticRoles.some(s => r.startsWith(s)))
          ));
        }
      } catch (err) { console.error("Failed to load users for workflow", err); }
    };
    fetchUsers();
  }, [editFormId]);

  // SRS: Prevent accidental navigation away from unsaved changes (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED') => {
    if (schema.fields.length === 0) {
      toast.error("Cannot save an empty form");
      return;
    }

    // Validate form code before save (unless already locked)
    if (!schema.codeLocked && schema.code) {
      const codeValidation = validateFormCode(schema.code);
      if (!codeValidation.valid) {
        toast.error(codeValidation.error || "Invalid form code");
        setCodeValidationError(codeValidation.error || null);
        return;
      }
    }

    // Only force workflow modal if:
    // 1. Trying to PUBLISH and NOT an Admin/Builder
    // 2. OR if user explicitly clicks "Request Approval" (which we will handle via its own button)
    if (status === 'PUBLISHED' && !isPrivileged) {
      setIsWorkflowModalOpen(true);
      return;
    }

    setIsSaving(true);
    try {
      const payload: FormSchema = {
        ...schema,
        status: status,
      };

      let savedForm;
      if (editFormId) {
        savedForm = await updateForm(editFormId, payload);
      } else {
        savedForm = await saveForm(payload);
        // After initial save, set the editFormId so subsequent saves update THIS form
        if (savedForm && savedForm.id) {
          setFormId(savedForm.id);
        }
      }

      if (savedForm && savedForm.status) {
        setStatus(savedForm.status);
      }

      // Sync custom validations from the response's active version
      const returnedVersion = (savedForm.versions as BackendVersion[] | undefined)?.find((v) => v.isActive) ||
        [...savedForm.versions || []].sort((a, b) => (b.versionNumber || 0) - (a.versionNumber || 0))[0];

      if (returnedVersion && Array.isArray(returnedVersion.formValidations)) {
        setFormValidations(returnedVersion.formValidations.map((fv: BackendValidationRule) => ({
          id: fv.id || crypto.randomUUID(),
          scope: fv.scope || 'FORM',
          fieldKey: fv.fieldKey || '',
          expression: fv.expression || '',
          errorMessage: fv.errorMessage || '',
          executionOrder: fv.executionOrder || 0,
        })));
      }

      toast.success(`Form ${status === 'PUBLISHED' ? 'published successfully!' : 'saved as draft!'}`);

      // Update initial state after successful save
      setInitialState(JSON.stringify({ schema: payload }));

      // Don't push to '/' yet, allow user to keep editing or "Request Approval"
      // router.push('/'); 
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to save form");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitiateWorkflow = async () => {
    if (isSaving) return; // Prevent double-clicks
    if (!selectedBuilderId) return toast.error("Please select a target Builder");
    if (workflowType === 'LEVEL_1' && selectedApproverIds.length < 1) return toast.error("Select an intermediate authority");
    if (workflowType === 'LEVEL_2' && selectedApproverIds.length < 2) return toast.error("Select 2 intermediate authorities");

    setIsSaving(true);
    try {
      // 1. Save form first if it's new
      const currentPayload: FormSchema = { ...schema, status: 'DRAFT' };
      const savedForm = await saveForm(currentPayload);
      const formId = savedForm.id;

      // 2. Initiate Workflow
      const res = await fetch(WORKFLOW.INITIATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          formId,
          workflowType,
          targetBuilderId: selectedBuilderId,
          intermediateAuthorityIds: selectedApproverIds
        })
      });

      if (res.ok) {
        const result = await res.json();
        console.log("Workflow initiated successfully:", result);
        toast.success("Workflow initiated successfully!");
        router.push('/');
      } else {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData.message || `Failed to initiate workflow: ${res.status}`;
        console.error("Workflow initiation failed:", res.status, message);
        toast.error(message);
      }
    } catch (err: unknown) {
      console.error("Workflow error:", err);
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSaving(false);
    }
  };


  const findParentField = (fields: FormField[], id: string): FormField | null => {
    for (const f of fields) {
      if (f.children?.some((c) => c.id === id)) return f;
      if (f.children) {
        const parent = findParentField(f.children, id);
        if (parent) return parent;
      }
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeData = active.data.current;
    if (activeData?.isSidebarBtn) {
      setActiveSidebarItem(activeData.type);
      setActiveCanvasItemId(null);
      return;
    }
    setActiveSidebarItem(null);
    setActiveCanvasItemId(active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveSidebarItem(null);
    setActiveCanvasItemId(null);
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // ── Handle dropping new fields from sidebar ──────────────────────
    if (activeData?.isSidebarBtn) {
      if (over.id === 'sidebar-palette') return;

      // Block PAGE_BREAK inside sections
      const isSection = overData?.isSection;
      const targetParent = findParentField(schema.fields, over.id as string);
      const isDroppedIntoSection = isSection || (targetParent?.type === 'SECTION_HEADER');
      if (isDroppedIntoSection && activeData.type === 'PAGE_BREAK') return; // silently block

      // 1. Drop into the section's drop zone (includes section-bottom zones)
      if (isSection) {
        addField(activeData.type, overData.parentId);
        return;
      }

      // 2. Drop over a specific field (possibly nested)
      const overIndex = (targetParent?.children ?? schema.fields).findIndex((f) => f.id === over.id);
      if (overIndex !== -1) {
        insertField(activeData.type, overIndex, targetParent?.id);
      } else if (over.id === 'canvas-droppable' || over.id === 'canvas-drop-bottom') {
        addField(activeData.type);
      }
      return;
    }

    // ── Handle reordering / moving existing canvas fields ─────────────
    if (active.id !== over.id) {

      // ── Helper: find active field anywhere in the tree ──────────────
      const findActiveField = (fields: FormField[]): FormField | null => {
        for (const f of fields) {
          if (f.id === active.id) return f;
          if (f.children) { const r = findActiveField(f.children); if (r) return r; }
        }
        return null;
      };
      const activeField = findActiveField(schema.fields);

      // ── Handle dropping existing canvas field at the very bottom ────
      if (over.id === 'canvas-droppable' || over.id === 'canvas-drop-bottom') {
        moveField(active.id as string, null, schema.fields.length);
        return;
      }

      // ── PRIORITY: dropping on any section droppable zone ────────────
      // Must be checked BEFORE the parent‐equality test because section zone
      // IDs (section-* / section-bottom-*) are not field IDs, so findParentField
      // returns null for both sides, making the equality check a false positive.
      if (overData?.isSection) {
        const sectionId = overData.parentId as string;

        // Block SECTION_HEADER nesting and PAGE_BREAK inside sections
        if (activeField?.type === 'SECTION_HEADER' || activeField?.type === 'PAGE_BREAK') return;

        // Find the section to get its current child count for append-to-end
        const findSection = (fields: FormField[]): FormField | null => {
          for (const f of fields) {
            if (f.id === sectionId) return f;
            if (f.children) { const r = findSection(f.children); if (r) return r; }
          }
          return null;
        };
        const sectionField = findSection(schema.fields);
        const targetIndex = sectionField?.children?.length ?? 0;
        moveField(active.id as string, sectionId, targetIndex);
        return;
      }

      const activeParent = findParentField(schema.fields, active.id as string);
      const overParent = findParentField(schema.fields, over.id as string);

      if (activeParent?.id === overParent?.id) {
        // ── Same container — simple reorder ──────────────────────────
        const targetList = activeParent?.children ?? schema.fields;
        const oldIndex = targetList.findIndex((f) => f.id === active.id);
        const newIndex = targetList.findIndex((f) => f.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderFields(arrayMove(targetList, oldIndex, newIndex), activeParent?.id);
        }
      } else {
        // ── Cross-container move ──────────────────────────────────────
        // Block SECTION_HEADER nesting and PAGE_BREAK inside sections
        const isMovingIntoSection = overParent?.type === 'SECTION_HEADER';
        if (isMovingIntoSection && (activeField?.type === 'SECTION_HEADER' || activeField?.type === 'PAGE_BREAK')) return;

        if (overParent?.type === 'SECTION_HEADER') {
          // Dropped over a child inside a section → insert before that child
          const targetIndex = (overParent.children ?? []).findIndex(c => c.id === over.id);
          moveField(active.id as string, overParent.id, targetIndex < 0 ? 0 : targetIndex);
        } else {
          // Dropped on a root-level field (moving from section → root)
          const targetIndex = schema.fields.findIndex(f => f.id === over.id);
          moveField(active.id as string, null, targetIndex < 0 ? schema.fields.length : targetIndex);
        }
      }
    }
  };


  const renderOverlay = () => {
    if (activeSidebarItem) {
      const tool = FIELD_TYPES.find(t => t.type === activeSidebarItem);
      return tool ? <SidebarBtnOverlay label={tool.label} icon={tool.icon} category={tool.category} /> : null;
    }
    if (activeCanvasItemId) {
      // Recursively search entire tree (root + section children) for the dragged field
      const findField = (fields: FormField[]): FormField | undefined => {
        for (const f of fields) {
          if (f.id === activeCanvasItemId) return f;
          if (f.children) { const r = findField(f.children); if (r) return r; }
        }
        return undefined;
      };
      const field = findField(schema.fields);
      return field ? (
        <div className="opacity-80 -rotate-1 pointer-events-none shadow-2xl rounded-xl">
          <SortableField field={field} onRemove={() => { }} onSelect={() => { }} />
        </div>
      ) : null;
    }
    return null;
  };

  /**
   * Custom collision detection that ignores the active item's own descendants.
   * This prevents a bug where dragging a Section header causes it to register
   * a continuous collision with its own children, preventing it from moving past them.
   */
  const customCollisionDetection: CollisionDetection = (args) => {
    const getDescendantIds = (fields: FormField[], targetId: string): string[] => {
      for (const field of fields) {
        if (field.id === targetId) {
          const extractIds = (f: FormField): string[] => {
            let ids = [f.id, `section-${f.id}`, `section-bottom-${f.id}`];
            if (f.children) {
              f.children.forEach(c => ids.push(...extractIds(c)));
            }
            return ids;
          };
          let excluded: string[] = [`section-${field.id}`, `section-bottom-${field.id}`];
          if (field.children) {
            field.children.forEach(c => excluded.push(...extractIds(c)));
          }
          return excluded;
        }
        if (field.children) {
          const res = getDescendantIds(field.children, targetId);
          if (res.length > 0) return res;
        }
      }
      return [];
    };

    const excludedIds = args.active ? getDescendantIds(schema.fields, args.active.id as string) : [];

    const filteredContainers = args.droppableContainers.filter(
      (container) => !excludedIds.includes(container.id as string)
    );

    return closestCorners({
      ...args,
      droppableContainers: filteredContainers,
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen w-full overflow-hidden" style={{ background: 'var(--canvas-bg)' }}>
        {/* Global Header removed from Builder */}

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* ── Builder Toolbar (Sub-Header) ── */}
          <div
            className="h-14 border-b flex items-center justify-between px-6 shrink-0 z-20"
            style={{ background: 'var(--bg-header)', borderColor: 'var(--border)' }}
          >
            {/* Left: Back Button, Form title & Status */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 rounded-lg hover:bg-bg-muted transition-colors group"
                title="Back to Dashboard"
              >
                <Plus className="rotate-45 text-text-muted group-hover:text-accent" size={20} />
              </button>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-text-faint uppercase tracking-widest pl-0.5">Form Title</span>
                    <input
                      type="text"
                      value={schema.title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 w-[240px] focus:outline-none"
                      style={{ color: 'var(--text-primary)' }}
                      placeholder="Untitled Form"
                    />
                  </div>

                  <div className="h-8 w-px bg-border-color mx-1" />

                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-black text-text-faint uppercase tracking-widest pl-0.5">Form Code</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-accent">/</span>
                      <input
                        type="text"
                        value={schema.code || ''}
                        onChange={(e) => {
                          const sanitized = sanitizeFormCode(e.target.value);
                          useFormStore.setState(s => ({ schema: { ...s.schema, code: sanitized } }));

                          // Validate in real-time
                          const validation = validateFormCode(sanitized);
                          setCodeValidationError(validation.valid ? null : validation.error || null);
                        }}
                        disabled={schema.codeLocked}
                        className="bg-transparent border-none p-0 text-xs font-bold focus:ring-0 w-[120px] focus:outline-none"
                        style={{ color: schema.codeLocked ? 'var(--text-faint)' : codeValidationError ? '#ef4444' : 'var(--text-secondary)' }}
                        placeholder={schema.codeLocked ? 'locked' : 'unique_code...'}
                        title={schema.codeLocked ? 'Code is locked after publishing' : codeValidationError || 'Lowercase letters, numbers, underscores only'}
                      />
                      {schema.codeLocked && (
                        <span title="Code is locked and cannot be changed">
                          <Lock size={12} className="text-text-faint shrink-0" />
                        </span>
                      )}
                      {!schema.codeLocked && codeValidationError && (
                        <span title={codeValidationError}>
                          <AlertCircle size={12} className="text-red-500 shrink-0" />
                        </span>
                      )}
                      {!schema.codeLocked && !codeValidationError && schema.code && (
                        <span className="text-[9px] text-green-600 shrink-0">✓</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] font-bold text-accent uppercase tracking-widest bg-accent-subtle px-1.5 py-0.5 rounded">
                    {schema.status}
                  </span>
                  <span className="text-[9px] font-semibold opacity-40 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                    {editFormId ? 'Persistent V-ID' : 'Transient Draft'}
                  </span>
                  {isSaving && <span className="text-[9px] font-black animate-pulse text-blue-500 uppercase tracking-widest">. Saving</span>}
                </div>
              </div>
            </div>

            {/* Centre: View Mode Switcher - Hidden on tiny screens or simplified */}
            <div className="hidden sm:flex bg-bg-muted p-1 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setActiveTab('EDITOR')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'EDITOR' ? 'bg-card-bg shadow-sm text-accent' : 'text-text-faint'}`}
              >
                <Layout size={13} /> Editor
              </button>

              {isRulesEnabled && (
                <>
                  <button
                    onClick={() => setActiveTab('LOGIC')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'LOGIC' ? 'bg-card-bg shadow-sm text-accent' : 'text-text-faint'}`}
                  >
                    <Link2 size={13} /> Rule Engine
                  </button>
                  <button
                    onClick={() => setActiveTab('VALIDATIONS')}
                    className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'VALIDATIONS' ? 'bg-card-bg shadow-sm text-accent' : 'text-text-faint'}`}
                  >
                    <Check size={13} /> Validations
                  </button>
                </>
              )}

              <button
                onClick={() => setActiveTab('VERSIONS')}
                className={`flex items-center gap-2 px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === 'VERSIONS' ? 'bg-card-bg shadow-sm text-accent' : 'text-text-faint'}`}
              >
                <Archive size={13} /> Versions
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => isAiEnabled && setIsAiModalOpen(true)}
                disabled={!isAiEnabled}
                title={isAiEnabled ? "Launch AI Architect" : "AI Architect is disabled"}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
                  ${isAiEnabled
                    ? 'gradient-accent text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-50 dark:bg-gray-800 dark:text-gray-600'
                  }
                `}
              >
                <Sparkles size={14} className={isAiEnabled ? "animate-pulse" : ""} /> <span className="hidden md:inline">AI Architect</span>
              </button>

              <button
                onClick={() => setThemePanelOpen(!isThemePanelOpen)}
                className={`p-2 rounded-lg transition-colors shrink-0 ${isThemePanelOpen ? 'bg-accent text-white' : ''}`}
                style={!isThemePanelOpen ? { color: 'var(--text-muted)' } : {}}
                title="Theme Options"
              >
                <Palette size={16} />
              </button>

              {hasPermission('WRITE') && (
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem('form_builder_preview', JSON.stringify({
                        ...schema,
                        // Ensure we don't accidentally preserve status or IDs if we don't want to
                      }));
                      window.open('/builder/preview', '_blank');
                    } catch {
                      toast.error("Failed to generate preview");
                    }
                  }}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-bg-muted transition-all"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Eye size={14} /> Preview
                </button>
              )}

              {isWorkflowEnabled && (
                <button
                  onClick={() => setIsWorkflowModalOpen(true)}
                  className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold text-white gradient-accent shadow-sm hover:shadow-md shrink-0"
                >
                  <ShieldAlert size={14} className="sm:mr-1.5" /> <span className="hidden lg:inline">Initiate Workflow</span>
                </button>
              )}

              {canAccessBuilder && (
                <>
                  <button
                    onClick={() => handleSave('DRAFT')}
                    disabled={isSaving}
                    className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold border bg-bg-muted hover:bg-bg-subtle transition-all shrink-0"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    <Save size={14} className="sm:mr-1.5" /> <span className="hidden sm:inline">Save</span>
                  </button>

                  <button
                    onClick={() => handleSave('PUBLISHED')}
                    disabled={isSaving || (!isDirty && schema.status !== 'DRAFT')}
                    className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-black shadow-sm transition-all uppercase tracking-widest shrink-0 ${isSaving || !isDirty ? 'bg-bg-muted text-text-muted border cursor-not-allowed' : 'gradient-accent text-white hover:shadow-md'}`}
                    style={isSaving || !isDirty ? { borderColor: 'var(--border)' } : {}}
                  >
                    {isSaving ? '...' : (status === 'PUBLISHED' && !isDirty ? 'Published' : 'Publish')}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden relative">
            {/* ── Mobile View Toggle Tabs ── */}
            <div className="flex lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-60 bg-card-bg border p-1.5 rounded-2xl shadow-2xl backdrop-blur-xl" style={{ borderColor: 'var(--border)' }}>
              <button
                onClick={() => setActiveMobileTab('PALETTE')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMobileTab === 'PALETTE' ? 'bg-accent text-white shadow-lg' : 'text-text-muted'}`}
              >
                <Plus size={14} />
                <span className={activeMobileTab === 'PALETTE' ? 'inline' : 'hidden md:inline'}>Fields</span>
              </button>
              <button
                onClick={() => setActiveMobileTab('CANVAS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMobileTab === 'CANVAS' ? 'bg-accent text-white shadow-lg' : 'text-text-muted'}`}
              >
                <Layout size={14} />
                <span className={activeMobileTab === 'CANVAS' ? 'inline' : 'hidden md:inline'}>Canvas</span>
              </button>
              <button
                onClick={() => setActiveMobileTab('PROPERTIES')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeMobileTab === 'PROPERTIES' ? 'bg-accent text-white shadow-lg' : 'text-text-muted'}`}
              >
                <Settings2 size={14} />
                <span className={activeMobileTab === 'PROPERTIES' ? 'inline' : 'hidden md:inline'}>Setup</span>
              </button>
            </div>

            {/* 1. Sidebar (Palette) */}
            {activeTab === 'EDITOR' && (
              <div className={`${activeMobileTab === 'PALETTE' ? 'flex flex-1' : 'hidden lg:flex'} h-full overflow-hidden border-r`} style={{ borderColor: 'var(--border)' }}>
                <Sidebar />
              </div>
            )}

            {/* 2. Main content (Canvas / Panels) */}
            <main className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden ${activeTab === 'EDITOR' && activeMobileTab !== 'CANVAS' ? 'hidden lg:flex' : 'flex'}`}>
              {activeTab === 'EDITOR' ? (
                <Canvas />
              ) : activeTab === 'LOGIC' ? (
                <LogicPanel />
              ) : activeTab === 'VALIDATIONS' ? (
                <CustomValidationsPanel
                  fields={schema.fields.map(f => ({ columnName: f.columnName, label: f.label }))}
                  rules={schema.formValidations || []}
                  onChange={setFormValidations}
                />
              ) : (
                <VersionsPanel editFormId={schema.id?.toString() || editFormId} />
              )}
            </main>

            {/* 3. Right panel (Properties) */}
            {activeTab === 'EDITOR' && (
              <>
                <div className={`${activeMobileTab === 'PROPERTIES' ? 'flex flex-1' : 'hidden lg:flex'} h-full overflow-hidden border-l`} style={{ borderColor: 'var(--border)' }}>
                  <PropertiesPanel />
                </div>
                <DragOverlay>{renderOverlay()}</DragOverlay>
              </>
            )}
          </div>
        </div>

        {/* Workflow Initiation Modal */}
        {isWorkflowModalOpen && (
          <div
            className="fixed inset-0 flex items-center justify-center p-4 backdrop-blur-xl bg-black/60 animate-in fade-in duration-300"
            style={{ zIndex: 9999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsWorkflowModalOpen(false);
            }}
          >
            <div className="w-full max-w-2xl rounded-[3rem] border shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col overflow-hidden" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>

              {/* Modal Header */}
              <div className="px-10 pt-10 pb-6 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase leading-none mb-2">Initiate <span className="gradient-text">Approval</span></h2>
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Select your chain of responsibility</p>
                </div>
                <button
                  onClick={() => setIsWorkflowModalOpen(false)}
                  className="w-12 h-12 rounded-full flex items-center justify-center transition-all transform hover:rotate-90 group"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-muted)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Plus className="rotate-45" size={28} />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar" style={{ scrollbarGutter: 'stable' }}>
                <div className="space-y-8">
                  {/* Workflow Type Selector */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest ml-1" style={{ color: 'var(--text-faint)' }}>Approval Strategy</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        { id: 'NORMAL', label: 'Self Publish', desc: 'Direct approval' },
                        { id: 'LEVEL_1', label: 'Level 1 Flow', desc: '1-Step Review' },
                        { id: 'LEVEL_2', label: 'Level 2 Flow', desc: '2-Step Review' }
                      ] as const).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setWorkflowType(t.id);
                            setSelectedApproverIds([]);
                          }}
                          className={`p-5 rounded-3xl border-2 transition-all text-left ${workflowType === t.id ? 'shadow-xl -translate-y-1' : 'hover:border-gray-400'}`}
                          style={workflowType === t.id ? { borderColor: 'var(--accent)', background: 'var(--accent-subtle)' } : { borderColor: 'var(--border)', background: 'var(--card-bg)' }}
                        >
                          <p className={`text-xs font-black mb-1`} style={workflowType === t.id ? { color: 'var(--accent)' } : {}}>{t.label}</p>
                          <p className="text-[9px] font-bold opacity-50 leading-tight uppercase tracking-tight">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Authority Chain */}
                  <div className="space-y-6 p-8 rounded-4xl border relative overflow-hidden" style={{ background: 'var(--bg-muted)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full gradient-accent flex items-center justify-center text-white">
                        <GitBranch size={16} />
                      </div>
                      <h4 className="text-xs font-black uppercase tracking-widest">Workflow Chain</h4>
                    </div>

                    <div className="space-y-8 relative">
                      {/* Vertical line connector */}
                      <div className="absolute left-6 top-8 bottom-8 w-px border-l-2 border-dashed" style={{ borderColor: 'var(--border)' }}></div>

                      {/* Intermediate steps */}
                      {(workflowType === 'LEVEL_1' || workflowType === 'LEVEL_2') && (
                        <div className="relative flex items-start gap-6">
                          <div className="w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xs z-10 shrink-0" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>1</div>
                          <div className="flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block opacity-50">Intermediate Authority</label>
                            <select
                              value={selectedApproverIds[0] || ''}
                              onChange={(e) => {
                                const newIds = [...selectedApproverIds];
                                newIds[0] = e.target.value;
                                setSelectedApproverIds(newIds);
                              }}
                              className="w-full px-5 py-4 rounded-xl border outline-none appearance-none font-bold text-sm"
                              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
                            >
                              <option value="">Choose Custom Authority...</option>
                              {availableCustomApprovers.map(u => <option key={u.id} value={u.id}>{u.username} ({u.roles.join(', ')})</option>)}
                            </select>
                          </div>
                        </div>
                      )}

                      {workflowType === 'LEVEL_2' && (
                        <div className="relative flex items-start gap-6">
                          <div className="w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xs z-10 shrink-0" style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}>2</div>
                          <div className="flex-1">
                            <label className="text-[10px] font-black uppercase tracking-widest mb-2 block opacity-50">Secondary Reviewer</label>
                            <select
                              value={selectedApproverIds[1] || ''}
                              onChange={(e) => {
                                const newIds = [...selectedApproverIds];
                                newIds[1] = e.target.value;
                                setSelectedApproverIds(newIds);
                              }}
                              className="w-full px-5 py-4 rounded-xl border outline-none appearance-none font-bold text-sm"
                              style={{ background: 'var(--card-bg)', borderColor: 'var(--border)' }}
                            >
                              <option value="">Choose Custom Authority...</option>
                              {availableCustomApprovers
                                .filter(u => u.id.toString() !== selectedApproverIds[0])
                                .map(u => <option key={u.id} value={u.id}>{u.username} ({u.roles.join(', ')})</option>)}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Final step (Builder) */}
                      <div className="relative flex items-start gap-6">
                        <div className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-xs z-10 shrink-0 shadow-lg shadow-blue-500/20" style={{ background: 'var(--accent)' }}>
                          {workflowType === 'NORMAL' ? '1' : workflowType === 'LEVEL_1' ? '2' : '3'}
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-black uppercase tracking-widest mb-2 block" style={{ color: 'var(--accent)' }}>Final Target (Builder)</label>
                          <select
                            value={selectedBuilderId}
                            onChange={(e) => setSelectedBuilderId(e.target.value)}
                            className="w-full px-5 py-4 rounded-xl border outline-none appearance-none font-black text-sm"
                            style={{ background: 'var(--card-bg)', borderColor: 'var(--accent)' }}
                          >
                            <option value="">Select Target Builder...</option>
                            {availableBuilders.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                          </select>
                          <p className="mt-2 text-[10px] font-medium italic flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                            <ShieldAlert size={10} /> After approval, this person will own this form.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleInitiateWorkflow}
                      disabled={isSaving}
                      className="w-full py-5 rounded-3xl text-sm font-black text-white gradient-accent shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:-translate-y-1 transition-all disabled:opacity-50 uppercase tracking-widest"
                    >
                      {isSaving ? 'Processing Chain...' : 'Submit Request →'}
                    </button>
                    <p className="text-center mt-4 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Form will be locked during approval process</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Architect Modal */}
        <AiArchitectModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onImport={(s) => {
            const clean = sanitizeImportedSchema(s);
            if (clean.title) setTitle(clean.title);
            if (clean.description) setDescription(clean.description);
            if (clean.fields) setFields(clean.fields);
            if (clean.rules) setRules(clean.rules);
            if (clean.formValidations) setFormValidations(clean.formValidations);
            setIsAiModalOpen(false);
            toast.success('AI Schema imported and sanitized successfully!');
          }}
        />
      </div>
    </DndContext>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
        Loading builder...
      </div>
    }>
      <BuilderContent />
    </Suspense>
  );
}
