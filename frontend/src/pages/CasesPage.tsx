import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { caseApi } from '../services/api';
import type { Case, CaseClassificationType } from '../types';
import {
  FolderOpen,
  Plus,
  Search,
  ChevronRight,
  Shield,
  ArrowLeft,
  User,
  AlertCircle,
  FileCheck,
  CheckCircle2,
  FileText,
  LayoutGrid,
  GitBranch,
} from 'lucide-react';
import {
  CASE_CLASSIFICATIONS,
  getCaseClassification,
  type CaseClassificationInfo,
} from '../utils/caseClassifications';

const priorityColors: Record<string, string> = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};

const statusColors: Record<string, string> = {
  OPEN: 'badge-pending',
  UNDER_INVESTIGATION: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  CLOSED: 'bg-dark-600/30 text-dark-400 border border-dark-500/30',
};

export default function CasesPage() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'pipeline'>('grid');

  // Multi-step modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    title: '',
    description: '',
    case_type: 'ACCIDENT' as CaseClassificationType,
    priority: 'HIGH',
    investigating_officer: '',
    incident_location: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = () => {
    caseApi
      .list({ search: search || undefined } as any)
      .then((r) => setCases(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [search]);

  const handleOpenCreate = () => {
    setCreateStep(1);
    setCreateError('');
    setForm({
      title: '',
      description: '',
      case_type: 'ACCIDENT',
      priority: 'HIGH',
      investigating_officer: '',
      incident_location: '',
    });
    setShowCreate(true);
  };

  const handleSelectClassification = (item: CaseClassificationInfo) => {
    setForm((prev) => ({
      ...prev,
      case_type: item.type,
      priority: item.defaultPriority,
    }));
    setCreateStep(2);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setCreateError('Please enter a case title');
      return;
    }
    setCreating(true);
    setCreateError('');

    try {
      const fullDescription = form.incident_location
        ? `${form.description ? form.description + '\n\n' : ''}Incident Location: ${form.incident_location}`
        : form.description;

      await caseApi.create({
        title: form.title.trim(),
        description: fullDescription,
        case_type: form.case_type,
        priority: form.priority,
        investigating_officer: form.investigating_officer.trim(),
      });

      setShowCreate(false);
      setCreateStep(1);
      load();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || 'Failed to create case. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // Filter cases by classification
  const filteredCases = cases.filter((c) => {
    if (selectedCategory === 'ALL') return true;
    const norm = (c.case_type || '').toUpperCase();
    if (selectedCategory === 'MURDER' && (norm === 'MURDER' || norm === 'HOMICIDE')) return true;
    return norm === selectedCategory;
  });

  // Calculate count per classification for tabs
  const getCategoryCount = (type: string) => {
    if (type === 'ALL') return cases.length;
    return cases.filter((c) => {
      const norm = (c.case_type || '').toUpperCase();
      if (type === 'MURDER' && (norm === 'MURDER' || norm === 'HOMICIDE')) return true;
      return norm === type;
    }).length;
  };

  const selectedClassInfo = getCaseClassification(form.case_type);
  const SelectedIcon = selectedClassInfo.icon;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-blue-400" /> Case Management & Registry
          </h1>
          <p className="text-dark-400 text-sm mt-1">
            Categorized evidence vault dossiers & investigation protocols ({cases.length} cases total)
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/reports')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <FileText className="w-4 h-4 text-vault-400" /> Case Reports
          </button>
          <button
            onClick={handleOpenCreate}
            className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-vault-900/30"
          >
            <Plus className="w-4 h-4" /> New Case
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cases by title, case number, or keywords..."
            className="w-full pl-10 pr-4 py-2.5 bg-dark-800/60 border border-dark-700 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-vault-500/60"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-dark-900/70 p-1 rounded-lg border border-dark-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-vault-600 text-white shadow-sm'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid View
            </button>
            <button
              onClick={() => setViewMode('pipeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                viewMode === 'pipeline'
                  ? 'bg-vault-600 text-white shadow-sm'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" /> Workflow Pipeline Flow
            </button>
          </div>
          <span className="text-xs text-dark-400 hidden sm:inline">
            Showing <strong className="text-white">{filteredCases.length}</strong> of {cases.length} cases
          </span>
        </div>
      </div>

      {/* Classification Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        <button
          onClick={() => setSelectedCategory('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-vault-600 text-white shadow-md shadow-vault-600/30'
              : 'bg-dark-800/70 text-dark-300 hover:text-white border border-dark-700/60 hover:border-dark-600'
          }`}
        >
          <span>All Cases</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-dark-700 text-dark-400'
            }`}
          >
            {getCategoryCount('ALL')}
          </span>
        </button>

        {CASE_CLASSIFICATIONS.map((cat) => {
          const count = getCategoryCount(cat.type);
          const CatIcon = cat.icon;
          const isActive = selectedCategory === cat.type;

          return (
            <button
              key={cat.type}
              onClick={() => setSelectedCategory(cat.type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-dark-700 text-white border-2 border-vault-500 shadow-md shadow-vault-900/40'
                  : 'bg-dark-800/70 text-dark-300 hover:text-white border border-dark-700/60 hover:border-dark-600'
              }`}
            >
              <CatIcon className={`w-3.5 h-3.5 ${cat.color}`} />
              <span>{cat.shortLabel}</span>
              {count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isActive ? 'bg-vault-500/30 text-vault-300' : 'bg-dark-700 text-dark-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area: Grid View vs Pipeline Flow */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FolderOpen className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <h3 className="text-white font-medium text-base">No cases found</h3>
          <p className="text-dark-400 text-sm mt-1 max-w-sm mx-auto">
            {selectedCategory !== 'ALL'
              ? `No ${getCaseClassification(selectedCategory).label} cases registered yet.`
              : 'No cases match your search criteria.'}
          </p>
          <button
            onClick={handleOpenCreate}
            className="btn-primary mt-4 inline-flex items-center gap-2 text-xs"
          >
            <Plus className="w-4 h-4" /> Create New Case
          </button>
        </div>
      ) : viewMode === 'pipeline' ? (
        /* --- WORKFLOW PIPELINE FLOW (KANBAN) --- */
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-dark-800/60 border border-dark-700/70 flex items-center justify-between text-xs text-dark-300">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-vault-400" />
              <span>
                <strong className="text-white">Investigation Flow Pipeline:</strong> Visual tracking of cases as they advance from FIR intake through evidence gathering, forensics, active inquiry, and court disposal.
              </span>
            </div>
            <span className="text-[11px] text-dark-400 font-mono">
              Click any card to inspect full procedural flow diagram
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 overflow-x-auto pb-4">
            {[
              {
                id: 'fir_intake',
                name: '1. FIR & Intake',
                desc: 'Case registered, officer assigned',
                color: 'border-blue-500/40 text-blue-400 bg-blue-500/5',
                dot: 'bg-blue-400',
                items: filteredCases.filter((c) => c.status === 'OPEN' && (c.evidence_count || 0) === 0),
              },
              {
                id: 'evidence_seizure',
                name: '2. Evidence Seizure',
                desc: 'Scene cordoned, items vaulted',
                color: 'border-purple-500/40 text-purple-400 bg-purple-500/5',
                dot: 'bg-purple-400',
                items: filteredCases.filter((c) => c.status === 'OPEN' && (c.evidence_count || 0) > 0),
              },
              {
                id: 'active_investigation',
                name: '3. Active Inquiry',
                desc: 'Interrogations & witnesses',
                color: 'border-amber-500/40 text-amber-400 bg-amber-500/5',
                dot: 'bg-amber-400',
                items: filteredCases.filter((c) => c.status === 'UNDER_INVESTIGATION' && c.priority !== 'CRITICAL'),
              },
              {
                id: 'chargesheet',
                name: '4. Chargesheet Formulation',
                desc: 'Evidence sealed & prosecution ready',
                color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/5',
                dot: 'bg-cyan-400',
                items: filteredCases.filter((c) => c.status === 'UNDER_INVESTIGATION' && c.priority === 'CRITICAL'),
              },
              {
                id: 'court_closed',
                name: '5. Court & Disposal',
                desc: 'Judicial verdict executed',
                color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/5',
                dot: 'bg-emerald-400',
                items: filteredCases.filter((c) => c.status === 'CLOSED'),
              },
            ].map((col) => (
              <div
                key={col.id}
                className="flex flex-col rounded-xl bg-dark-900/60 border border-dark-700/80 p-3 min-w-[210px]"
              >
                {/* Column Header */}
                <div className="pb-3 mb-3 border-b border-dark-800">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <h4 className="text-xs font-bold text-white">{col.name}</h4>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-dark-800 text-dark-300 border border-dark-700">
                      {col.items.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-dark-500 leading-tight">{col.desc}</p>
                </div>

                {/* Column Cards */}
                <div className="space-y-2.5 flex-1">
                  {col.items.length === 0 ? (
                    <div className="py-8 text-center text-dark-600 text-[11px] border border-dashed border-dark-800 rounded-lg">
                      No cases in this stage
                    </div>
                  ) : (
                    col.items.map((c) => {
                      const classInfo = getCaseClassification(c.case_type);
                      const CaseIcon = classInfo.icon;

                      return (
                        <div
                          key={c.id}
                          onClick={() => navigate(`/cases/${c.id}`)}
                          className="glass-card p-3 rounded-lg border border-dark-700/80 hover:border-vault-500/60 cursor-pointer hover-lift group transition-all"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono text-vault-400 font-semibold">
                              {c.case_number}
                            </span>
                            <span className={`badge text-[9px] ${priorityColors[c.priority] || 'badge-low'}`}>
                              {c.priority}
                            </span>
                          </div>

                          <div className="mb-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${classInfo.badge}`}
                            >
                              <CaseIcon className="w-3 h-3" />
                              {classInfo.shortLabel}
                            </span>
                          </div>

                          <h5 className="text-xs font-semibold text-white group-hover:text-vault-300 transition-colors line-clamp-2 mb-2 leading-tight">
                            {c.title}
                          </h5>

                          <div className="pt-2 border-t border-dark-800/80 flex items-center justify-between text-[10px] text-dark-400">
                            <span className="truncate max-w-[90px]">
                              {c.investigating_officer || 'Investigator'}
                            </span>
                            <span className="flex items-center gap-0.5 text-vault-400 font-medium">
                              <Shield className="w-3 h-3" /> {c.evidence_count}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* --- STANDARD GRID VIEW --- */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCases.map((c) => {
            const classInfo = getCaseClassification(c.case_type);
            const CaseIcon = classInfo.icon;

            return (
              <button
                key={c.id}
                onClick={() => navigate(`/cases/${c.id}`)}
                className="glass-card p-5 text-left hover-lift group border border-dark-700/60 hover:border-dark-600 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges Row */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-mono text-vault-400 font-semibold">
                      {c.case_number}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`badge ${priorityColors[c.priority] || 'badge-low'} text-[11px]`}>
                        {c.priority}
                      </span>
                    </div>
                  </div>

                  {/* Classification Tag */}
                  <div className="mb-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${classInfo.badge}`}
                    >
                      <CaseIcon className="w-3.5 h-3.5" />
                      {classInfo.shortLabel}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-vault-300 transition-colors line-clamp-2">
                    {c.title}
                  </h3>
                  <p className="text-xs text-dark-400 line-clamp-2 mb-4 leading-relaxed">
                    {c.description || 'No detailed incident description provided.'}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-dark-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`badge text-[11px] ${statusColors[c.status] || 'badge-pending'}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-dark-400 font-medium">
                      <Shield className="w-3.5 h-3.5 text-vault-400" /> {c.evidence_count} evidence
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-dark-500 group-hover:text-vault-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Two-Step Guided Case Creation Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-card w-full max-w-2xl my-8 p-6 border border-dark-600 shadow-2xl relative animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-dark-700/60 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-vault-600/20 text-vault-300 border border-vault-500/30">
                    Step {createStep} of 2
                  </span>
                  <h2 className="text-lg font-bold text-white">
                    {createStep === 1
                      ? 'Choose Case Classification'
                      : 'Enter Case Details'}
                  </h2>
                </div>
                <p className="text-xs text-dark-400 mt-1">
                  {createStep === 1
                    ? 'Select the category of incident to apply relevant protocols and templates'
                    : `Provide incident summary and assignments for this ${selectedClassInfo.shortLabel} case`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-dark-400 hover:text-white text-lg font-bold p-1 hover:bg-dark-800 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Error Message */}
            {createError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            {/* STEP 1: Choose Case Classification */}
            {createStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
                  {CASE_CLASSIFICATIONS.map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <button
                        key={cat.type}
                        type="button"
                        onClick={() => handleSelectClassification(cat)}
                        className={`p-4 rounded-xl text-left border transition-all flex flex-col justify-between group hover-lift ${cat.borderColor} ${cat.bgColor} hover:bg-dark-800/80`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className={`p-2 rounded-lg bg-dark-900/60 ${cat.color}`}>
                              <CatIcon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider group-hover:text-dark-200">
                              Select →
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white group-hover:text-vault-300 transition-colors">
                            {cat.shortLabel}
                          </h4>
                          <p className="text-xs text-dark-400 mt-1 line-clamp-2 leading-relaxed">
                            {cat.description}
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-dark-700/40 text-[10px] text-dark-500 truncate">
                          e.g. {cat.examples}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-3 border-t border-dark-700/60">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Enter Details */}
            {createStep === 2 && (
              <form onSubmit={handleCreate} className="space-y-4">
                {/* Active Classification Banner */}
                <div className="p-3.5 rounded-xl bg-dark-800/80 border border-dark-700 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-dark-900/80 ${selectedClassInfo.color}`}>
                      <SelectedIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">
                          {selectedClassInfo.label}
                        </span>
                        <span className={`badge text-[10px] ${selectedClassInfo.badge}`}>
                          Selected
                        </span>
                      </div>
                      <p className="text-[11px] text-dark-400 mt-0.5">
                        {selectedClassInfo.protocolNotes}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="text-xs text-vault-400 hover:text-vault-300 underline shrink-0 font-medium"
                  >
                    Change
                  </button>
                </div>

                {/* Case Title */}
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1.5">
                    Case Title / FIR Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={selectedClassInfo.suggestedTitlePlaceholder}
                    required
                    className="w-full px-3.5 py-2.5 bg-dark-800/60 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-vault-500 placeholder-dark-500"
                  />
                </div>

                {/* Priority & Investigating Officer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-dark-300 mb-1.5">
                      Case Priority
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-dark-800/60 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-vault-500"
                    >
                      <option value="CRITICAL">CRITICAL (Immediate Action)</option>
                      <option value="HIGH">HIGH (Urgent Investigation)</option>
                      <option value="MEDIUM">MEDIUM (Standard Priority)</option>
                      <option value="LOW">LOW (Routine Review)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dark-300 mb-1.5">
                      Investigating Officer (Lead)
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                      <input
                        type="text"
                        value={form.investigating_officer}
                        onChange={(e) =>
                          setForm({ ...form, investigating_officer: e.target.value })
                        }
                        placeholder="e.g. Inspector R. Sharma"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-dark-800/60 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-vault-500 placeholder-dark-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Incident Location / Jurisdiction */}
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1.5">
                    Incident Location / Police Station Jurisdiction
                  </label>
                  <input
                    type="text"
                    value={form.incident_location}
                    onChange={(e) => setForm({ ...form, incident_location: e.target.value })}
                    placeholder="e.g. Ring Road Junction, North District Police Station"
                    className="w-full px-3.5 py-2.5 bg-dark-800/60 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-vault-500 placeholder-dark-500"
                  />
                </div>

                {/* Incident Description */}
                <div>
                  <label className="block text-xs font-medium text-dark-300 mb-1.5">
                    Incident Synopsis & Initial Report
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    placeholder="Enter key details regarding time, victims, suspects, eyewitness accounts, or seized materials..."
                    className="w-full px-3.5 py-2.5 bg-dark-800/60 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-vault-500 placeholder-dark-500 leading-relaxed"
                  />
                </div>

                {/* Protocol Checklist Reminder */}
                <div className="p-3 rounded-lg bg-vault-950/40 border border-vault-800/50 flex items-start gap-2.5 text-xs text-vault-300">
                  <CheckCircle2 className="w-4 h-4 text-vault-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-white">Recommended Protocol: </span>
                    <span className="text-dark-300">{selectedClassInfo.protocolNotes}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-dark-700/60">
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to Classifications
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="btn-primary text-xs flex items-center gap-1.5 shadow-lg shadow-vault-900/30"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      {creating ? 'Creating Case...' : 'Create & Register Case'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
