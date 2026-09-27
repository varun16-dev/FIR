import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../services/api';
import type { AuditLog } from '../types';
import { ClipboardList, Search, KeyRound } from 'lucide-react';

const actionColors: Record<string, string> = {
  LOGIN: 'text-blue-400', EVIDENCE_UPLOADED: 'text-emerald-400',
  EVIDENCE_VERIFIED: 'text-cyan-400', CUSTODY_TRANSFERRED: 'text-amber-400',
  CASE_CREATED: 'text-vault-400', AI_ANALYSIS: 'text-purple-400',
  BLOCKCHAIN_VERIFIED: 'text-cyan-400', REPORT_GENERATED: 'text-teal-400',
  DEMO_TAMPER_SIMULATION: 'text-red-400',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    const params: any = {};
    if (action) params.action = action;
    if (userFilter) params.user_email = userFilter;

    auditApi.list(params)
      .then((r) => setLogs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [action, userFilter]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <ClipboardList className="w-7 h-7 text-amber-400" /> Audit Logs
          </h1>
          <p className="text-dark-400 text-sm mt-1">Complete operation audit trail</p>
        </div>
        <Link
          to="/login-activity"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-vault-600/10 border border-vault-500/20 text-xs font-medium text-vault-400 hover:bg-vault-600/20 transition-all self-start sm:self-auto"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>View Dedicated Login History →</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select value={action} onChange={(e) => setAction(e.target.value)}
          className="px-3 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-sm text-dark-200 focus:outline-none">
          <option value="">All Actions</option>
          {['LOGIN', 'CASE_CREATED', 'EVIDENCE_UPLOADED', 'EVIDENCE_VERIFIED', 'EVIDENCE_VIEWED',
            'CUSTODY_TRANSFERRED', 'AI_ANALYSIS', 'BLOCKCHAIN_VERIFIED', 'REPORT_GENERATED'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input type="text" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Filter by user..."
            className="pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none" />
        </div>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Timestamp</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">User</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Role</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Action</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Resource</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Status</th>
                <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-dark-800/50 hover:bg-dark-800/20 transition-colors">
                  <td className="py-3 px-4 text-dark-400 text-xs">{l.timestamp ? new Date(l.timestamp).toLocaleString() : ''}</td>
                  <td className="py-3 px-4 text-dark-300 text-xs">{l.user_email}</td>
                  <td className="py-3 px-4"><span className="badge bg-dark-600/30 text-dark-400 border border-dark-500/30 text-xs">{l.role}</span></td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-mono font-semibold ${actionColors[l.action] || 'text-dark-400'}`}>{l.action}</span>
                  </td>
                  <td className="py-3 px-4 text-dark-400 text-xs font-mono">{l.resource_type} {l.resource_id}</td>
                  <td className="py-3 px-4">
                    <span className={`badge text-xs ${l.status === 'SUCCESS' ? 'badge-verified' : l.status === 'FAILED' ? 'badge-tampered' : 'badge-pending'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-dark-500 text-xs max-w-[200px] truncate">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
