import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportApi } from '../services/api';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  FolderOpen,
  Shield,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  RefreshCw,
  Clock,
  Briefcase,
  Search,
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart as RePieChart,

  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  CASE_CLASSIFICATIONS,
  getCaseClassification,
} from '../utils/caseClassifications';

const CHART_COLORS = [
  '#f59e0b', // amber (Accident)
  '#ef4444', // red (Murder)
  '#06b6d4', // cyan (Cyber)
  '#10b981', // emerald (Financial)
  '#f97316', // orange (Theft)
  '#a855f7', // purple (Narcotics)
  '#f43f5e', // rose (Assault)
  '#3b82f6', // blue (Missing Person)
  '#64748b', // slate (General)
];

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

export default function ReportsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'quarterly'>('weekly');
  const [selectedClassification, setSelectedClassification] = useState<string>('ALL');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const getQueryParams = () => {
    const p: Record<string, string | number> = { period };
    if (selectedClassification !== 'ALL') {
      p.case_type = selectedClassification;
    }
    return p;
  };

  const loadReport = () => {
    setLoading(true);
    reportApi
      .getCaseSummary(getQueryParams())
      .then((res) => {
        setReportData(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [period, selectedClassification]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const res = await reportApi.downloadCasePdf(getQueryParams());
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case_report_${period}_${reportData?.start_date || 'period'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download PDF report', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    setDownloadingCsv(true);
    try {
      const res = await reportApi.downloadCaseCsv(getQueryParams());

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cases_${period}_${reportData?.start_date || 'period'}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to download CSV report', err);
    } finally {
      setDownloadingCsv(false);
    }
  };

  const filteredCases = (reportData?.cases || []).filter((c: any) => {
    if (!tableSearch) return true;
    const s = tableSearch.toLowerCase();
    return (
      c.title.toLowerCase().includes(s) ||
      c.case_number.toLowerCase().includes(s) ||
      (c.investigating_officer || '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="w-7 h-7 text-vault-400" /> Case Intelligence & Periodic Reports
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-vault-600/20 text-vault-300 border border-vault-500/30 uppercase tracking-wider">
              Official Dossier
            </span>
          </div>
          <p className="text-dark-400 text-sm mt-1">
            Weekly and monthly investigation summaries, crime classifications, trend metrics, and audit-ready exports
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadReport}
            className="p-2 rounded-lg bg-dark-800 text-dark-300 hover:text-white border border-dark-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs flex items-center gap-1.5"
            title="Print View"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            {downloadingCsv ? 'Exporting...' : 'Export CSV'}
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn-primary text-xs flex items-center gap-1.5 shadow-lg shadow-vault-900/40"
          >
            <Download className="w-3.5 h-3.5" />
            {downloadingPdf ? 'Generating PDF...' : 'Download Official PDF Report'}
          </button>
        </div>
      </div>

      {/* Period & Filter Control Bar */}
      <div className="glass-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-2 bg-dark-900/60 p-1.5 rounded-xl border border-dark-700/80">
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              period === 'weekly'
                ? 'bg-vault-600 text-white shadow-md shadow-vault-600/30'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Weekly Report (7 Days)
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              period === 'monthly'
                ? 'bg-vault-600 text-white shadow-md shadow-vault-600/30'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Monthly Report (30 Days)
          </button>
          <button
            onClick={() => setPeriod('quarterly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              period === 'quarterly'
                ? 'bg-vault-600 text-white shadow-md shadow-vault-600/30'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> Quarterly (90 Days)
          </button>
        </div>

        {/* Classification Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-dark-400 font-medium whitespace-nowrap flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-vault-400" /> Filter by Crime:
          </span>
          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            className="px-3 py-2 bg-dark-800/80 border border-dark-600 rounded-lg text-xs text-white focus:outline-none focus:border-vault-500"
          >
            <option value="ALL">All Classifications</option>
            {CASE_CLASSIFICATIONS.map((cat) => (
              <option key={cat.type} value={cat.type}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Window Banner */}
      {reportData && (
        <div className="px-4 py-2.5 rounded-lg bg-dark-800/50 border border-dark-700/60 flex flex-wrap items-center justify-between text-xs text-dark-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">{reportData.label}</span>
            <span className="text-dark-500">|</span>
            <span>
              Reporting Span: <strong className="text-vault-300">{reportData.start_date}</strong> to{' '}
              <strong className="text-vault-300">{reportData.end_date}</strong>
            </span>
          </div>
          <span className="text-dark-500 text-[11px]">
            Generated at {reportData.generated_at}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reportData ? (
        <>
          {/* Executive Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <div className="glass-card p-4 border border-blue-500/20 bg-blue-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-400 font-medium">Total Cases</span>
                <FolderOpen className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-white">{reportData.total_cases}</p>
              <p className="text-[11px] text-blue-400 mt-1">Logged in period</p>
            </div>

            <div className="glass-card p-4 border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-400 font-medium">Under Investigation</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-white">{reportData.under_investigation}</p>
              <p className="text-[11px] text-amber-400 mt-1">Active investigations</p>
            </div>

            <div className="glass-card p-4 border border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-400 font-medium">Closed / Resolved</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-white">{reportData.closed_cases}</p>
              <p className="text-[11px] text-emerald-400 mt-1">Finalized cases</p>
            </div>

            <div className="glass-card p-4 border border-purple-500/20 bg-purple-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-400 font-medium">Evidence Catalogued</span>
                <Shield className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-white">{reportData.total_evidence}</p>
              <p className="text-[11px] text-purple-400 mt-1">{reportData.verified_evidence} verified on chain</p>
            </div>

            <div className="glass-card p-4 border border-vault-500/20 bg-vault-500/5 col-span-2 md:col-span-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-dark-400 font-medium">Blockchain Integrity</span>
                <CheckCircle2 className="w-4 h-4 text-vault-400" />
              </div>
              <p className="text-2xl font-bold text-white">{reportData.integrity_rate}%</p>
              <p className="text-[11px] text-vault-400 mt-1">Proof-of-custody rate</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Intake Trend Chart */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-vault-400" /> Case Intake Velocity ({reportData.period.toUpperCase()})
                </h3>
                <span className="text-xs text-dark-400 font-mono">Cases / Day</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={reportData.daily_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={(v) => v.slice(5)} />
                  <YAxis stroke="#64748b" fontSize={10} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: '#cbd5e1' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Cases"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Crime Classification Distribution */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-amber-400" /> Crime & Incident Classification Distribution
                </h3>
                <span className="text-xs text-dark-400">Share of Total</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <RePieChart>
                    <Pie
                      data={reportData.by_classification}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {reportData.by_classification.map((_: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </RePieChart>
                </ResponsiveContainer>

                {/* Classification Legend List */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {reportData.by_classification.map((item: any, idx: number) => {
                    const info = getCaseClassification(item.name);
                    const Icon = info.icon;
                    const pct =
                      reportData.total_cases > 0
                        ? Math.round((item.value / reportData.total_cases) * 100)
                        : 0;

                    return (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-dark-800/60"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                          <span className="text-dark-200">{info.shortLabel}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{item.value}</span>
                          <span className="text-dark-500 text-[10px]">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Classification Breakdown Grid */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Crime Categories In Reporting Window
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {CASE_CLASSIFICATIONS.map((cat) => {
                const count = (reportData.cases || []).filter((c: any) => {
                  const norm = (c.case_type || '').toUpperCase();
                  if (cat.type === 'MURDER' && (norm === 'MURDER' || norm === 'HOMICIDE')) return true;
                  return norm === cat.type;
                }).length;

                const CatIcon = cat.icon;
                const pct =
                  reportData.total_cases > 0
                    ? Math.round((count / reportData.total_cases) * 100)
                    : 0;

                return (
                  <div
                    key={cat.type}
                    className={`p-3.5 rounded-xl border ${cat.borderColor} ${cat.bgColor} flex flex-col justify-between`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg bg-dark-900/70 ${cat.color}`}>
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-white">{cat.shortLabel}</span>
                      </div>
                      <span className="text-lg font-bold text-white">{count}</span>
                    </div>

                    <div className="w-full bg-dark-900/60 rounded-full h-1.5 overflow-hidden mt-1">
                      <div
                        className="bg-vault-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-dark-400 mt-2">
                      <span>{cat.defaultPriority} Priority Protocol</span>
                      <span>{pct}% of report</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Case Registry Table */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-blue-400" /> Case Registry Roster ({filteredCases.length} items)
              </h3>
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter table cases..."
                  className="w-full pl-8 pr-3 py-1.5 bg-dark-800/70 border border-dark-700 rounded-lg text-xs text-white focus:outline-none focus:border-vault-500 placeholder-dark-500"
                />
              </div>
            </div>

            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-dark-700/60 bg-dark-800/50">
                      <th className="text-left py-3 px-3.5 text-dark-400 font-semibold uppercase">Case #</th>
                      <th className="text-left py-3 px-3.5 text-dark-400 font-semibold uppercase">Classification</th>
                      <th className="text-left py-3 px-3.5 text-dark-400 font-semibold uppercase">Title / FIR Details</th>
                      <th className="text-left py-3 px-3.5 text-dark-400 font-semibold uppercase">Lead Officer</th>
                      <th className="text-center py-3 px-3.5 text-dark-400 font-semibold uppercase">Priority</th>
                      <th className="text-center py-3 px-3.5 text-dark-400 font-semibold uppercase">Evidence</th>
                      <th className="text-left py-3 px-3.5 text-dark-400 font-semibold uppercase">Status</th>
                      <th className="text-right py-3 px-3.5 text-dark-400 font-semibold uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-dark-400">
                          No cases registered for this reporting criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredCases.map((c: any) => {
                        const classInfo = getCaseClassification(c.case_type);
                        const CaseIcon = classInfo.icon;

                        return (
                          <tr
                            key={c.id}
                            className="border-b border-dark-800/60 hover:bg-dark-800/30 transition-colors"
                          >
                            <td className="py-2.5 px-3.5 font-mono text-vault-400 font-semibold">
                              {c.case_number}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${classInfo.badge}`}
                              >
                                <CaseIcon className="w-3 h-3" />
                                {classInfo.shortLabel}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 font-medium text-white max-w-xs truncate" title={c.title}>
                              {c.title}
                            </td>
                            <td className="py-2.5 px-3.5 text-dark-300">
                              {c.investigating_officer || 'Investigator'}
                            </td>
                            <td className="py-2.5 px-3.5 text-center">
                              <span
                                className={`badge text-[10px] ${
                                  priorityColors[c.priority] || 'badge-low'
                                }`}
                              >
                                {c.priority}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-center text-dark-300 font-semibold">
                              {c.evidence_count}
                            </td>
                            <td className="py-2.5 px-3.5">
                              <span
                                className={`badge text-[10px] ${
                                  statusColors[c.status] || 'badge-pending'
                                }`}
                              >
                                {c.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3.5 text-right">
                              <button
                                onClick={() => navigate(`/cases/${c.id}`)}
                                className="text-vault-400 hover:text-vault-300 inline-flex items-center gap-1 text-[11px] font-medium"
                              >
                                View Case <ChevronRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="glass-card p-12 text-center text-dark-400">
          Failed to load report data. Please retry.
        </div>
      )}
    </div>
  );
}
