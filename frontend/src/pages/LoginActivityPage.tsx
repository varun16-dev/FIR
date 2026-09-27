import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auditApi } from '../services/api';
import {
  KeyRound, ShieldCheck, User, Search, RefreshCw,
  CheckCircle2, XCircle, AlertTriangle, ArrowLeft,
  Globe,
} from 'lucide-react';

interface LoginRecord {
  id: number;
  timestamp: string;
  user_id: number;
  user_email: string;
  full_name: string;
  badge_number: string;
  department: string;
  role: string;
  action: string;
  ip_address: string;
  status: string;
  details: string;
  is_current_user?: boolean;
}

export default function LoginActivityPage() {
  const [logins, setLogins] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogins = () => {
    setLoading(true);
    const params: any = {};
    if (roleFilter) params.role = roleFilter;
    if (statusFilter) params.status = statusFilter;
    if (searchTerm) params.user_email = searchTerm;

    auditApi.getLogins(params)
      .then((res) => setLogins(res.data))
      .catch((err) => console.error('Failed to load login history', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogins();
  }, [roleFilter, statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogins();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/30',
    INVESTIGATOR: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    FORENSIC_OFFICER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    LEGAL_OFFICER: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    AUDITOR: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/audit-logs" className="text-dark-400 hover:text-white p-1 rounded transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <KeyRound className="w-7 h-7 text-vault-400" /> Officer Authentication History
            </h1>
          </div>
          <p className="text-dark-400 text-sm mt-1 ml-8">
            Immutable audit record of user logins, Multi-Factor Authentication (MFA) challenges, IP addresses, and access sessions.
          </p>
        </div>

        <button
          onClick={fetchLogins}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 border border-dark-700 text-xs font-medium self-start sm:self-auto transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3.5 border-dark-700/80">
          <div className="w-10 h-10 rounded-xl bg-vault-600/20 border border-vault-500/30 flex items-center justify-center text-vault-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-dark-400">Total Authentications</p>
            <p className="text-xl font-bold text-white mt-0.5">{logins.length}</p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-dark-700/80">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-dark-400">Successful Sessions</p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              {logins.filter((l) => l.status === 'SUCCESS').length}
            </p>
          </div>
        </div>

        <div className="glass-card p-4 flex items-center gap-3.5 border-dark-700/80">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-dark-400">Failed / Blocked Attempts</p>
            <p className="text-xl font-bold text-red-400 mt-0.5">
              {logins.filter((l) => l.status !== 'SUCCESS').length}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Search className="w-4 h-4 text-dark-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by officer email, badge, or keyword..."
            className="w-full pl-9 pr-4 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-vault-500"
          />
        </form>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-sm text-dark-200 focus:outline-none focus:border-vault-500 cursor-pointer"
        >
          <option value="">All Officer Roles</option>
          <option value="ADMIN">Administrator</option>
          <option value="INVESTIGATOR">Investigator</option>
          <option value="FORENSIC_OFFICER">Forensic Specialist</option>
          <option value="LEGAL_OFFICER">Legal Prosecutor</option>
          <option value="AUDITOR">Auditor</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-sm text-dark-200 focus:outline-none focus:border-vault-500 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success Only</option>
          <option value="FAILED">Failed Password / MFA</option>
          <option value="BLOCKED">Account Blocked</option>
        </select>
      </div>

      {/* Log Table */}
      <div className="glass-card overflow-hidden border-dark-700/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-dark-900/80 text-dark-400 text-xs uppercase tracking-wider border-b border-dark-700">
              <tr>
                <th className="px-4 py-3">Timestamp (UTC)</th>
                <th className="px-4 py-3">Officer & Credentials</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Client IP & Security</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dark-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-vault-400" />
                    <span>Loading verified authentication history...</span>
                  </td>
                </tr>
              ) : logins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dark-400 italic">
                    No authentication records found matching the filters.
                  </td>
                </tr>
              ) : (
                logins.map((entry) => (
                  <tr key={entry.id} className="hover:bg-dark-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-dark-400 whitespace-nowrap">
                      {formatDate(entry.timestamp)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-dark-800 border border-dark-700 flex items-center justify-center text-vault-400 shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white text-xs">{entry.full_name}</span>
                            {entry.is_current_user && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-vault-600/30 text-vault-300 border border-vault-500/40 font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-dark-400 font-mono truncate max-w-xs">{entry.user_email}</p>
                          {entry.badge_number && (
                            <p className="text-[10px] text-dark-500 font-mono">Badge: #{entry.badge_number}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${roleColors[entry.role] || 'bg-dark-800 text-dark-300 border-dark-700'}`}>
                        {entry.role}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-vault-400 font-bold">
                        {entry.action}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-dark-300">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3 h-3 text-dark-500" />
                        <span>{entry.ip_address}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {entry.status === 'SUCCESS' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Success
                        </span>
                      ) : entry.status === 'BLOCKED' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                          <AlertTriangle className="w-3.5 h-3.5" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/30">
                          <XCircle className="w-3.5 h-3.5" /> Failed
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-dark-400 max-w-xs truncate" title={entry.details}>
                      {entry.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
