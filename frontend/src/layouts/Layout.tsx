import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { dashboardApi, authApi, notificationsApi } from '../services/api';
import { RoleSwitcher } from '../components/RoleSwitcher';
import {
  LayoutDashboard, FolderOpen, Shield,
  Blocks, ClipboardList, Users, LogOut, Search,
  Bell, ChevronLeft, ChevronRight, Fingerprint, X, FileText, KeyRound, Gavel, Network,
  Scale, ShieldCheck
} from 'lucide-react';


import { normalizeRole } from '../components/RoleGuard';

interface NavItemConfig {
  to: string;
  icon: any;
  label: string;
  allowedRoles: string[];
}

const ALL_NAV_ITEMS: NavItemConfig[] = [
  {
    to: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    allowedRoles: ['ADMIN', 'INVESTIGATOR', 'FORENSIC_OFFICER', 'LEGAL_OFFICER', 'AUDITOR'],
  },
  {
    to: '/cases',
    icon: FolderOpen,
    label: 'Cases',
    allowedRoles: ['INVESTIGATOR', 'FORENSIC_OFFICER', 'LEGAL_OFFICER', 'AUDITOR'],
  },
  {
    to: '/evidence',
    icon: Shield,
    label: 'Evidence Vault',
    allowedRoles: ['INVESTIGATOR', 'FORENSIC_OFFICER', 'LEGAL_OFFICER', 'AUDITOR'],
  },
  {
    to: '/court',
    icon: Gavel,
    label: 'Court Dashboard',
    allowedRoles: ['LEGAL_OFFICER'],
  },
  {
    to: '/reports',
    icon: FileText,
    label: 'Case Reports',
    allowedRoles: ['INVESTIGATOR', 'FORENSIC_OFFICER', 'LEGAL_OFFICER'],
  },
  {
    to: '/legal',
    icon: Scale,
    label: 'Legal & BNS Compliance',
    allowedRoles: ['ADMIN', 'INVESTIGATOR', 'FORENSIC_OFFICER', 'LEGAL_OFFICER', 'AUDITOR'],
  },
  {
    to: '/blockchain',
    icon: Blocks,
    label: 'Cryptographic Ledger',
    allowedRoles: ['ADMIN', 'INVESTIGATOR', 'FORENSIC_OFFICER', 'LEGAL_OFFICER', 'AUDITOR'],
  },
  {
    to: '/login-activity',
    icon: KeyRound,
    label: 'Login History',
    allowedRoles: ['ADMIN', 'AUDITOR'],
  },
  {
    to: '/audit',
    icon: ClipboardList,
    label: 'Audit Logs',
    allowedRoles: ['ADMIN', 'AUDITOR'],
  },
  {
    to: '/users',
    icon: Users,
    label: 'Users',
    allowedRoles: ['ADMIN'],
  },
  {
    to: '/cap-demo',
    icon: Network,
    label: 'CAP Demo',
    allowedRoles: ['ADMIN', 'AUDITOR'],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const res = await notificationsApi.getUnreadCount();
        setUnreadCount(res.data.unread_count);
      } catch {}
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const loadNotifications = async (reset = false) => {
    try {
      setNotificationsLoading(true);
      const newOffset = reset ? 0 : offset;
      const res = await notificationsApi.getNotifications(limit, newOffset);
      if (reset) {
        setNotifications(res.data.notifications);
      } else {
        setNotifications(prev => [...prev, ...res.data.notifications]);
      }
      setOffset(newOffset + limit);
      setHasMore(res.data.has_more);
    } catch {
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    if (showNotifications) {
      loadNotifications(true);
    }
  }, [showNotifications]);

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const dismissNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.dismiss(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore if network failure
    }
    logout();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await dashboardApi.search(searchQuery);
      setSearchResults(res.data);
      setShowSearch(true);
    } catch { /* ignore */ }
  };

  const currentRole = normalizeRole(user?.role);
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    item.allowedRoles.map((r) => normalizeRole(r)).includes(currentRole)
  );

  const roleColor: Record<string, string> = {
    ADMIN: 'text-slate-400',
    INVESTIGATOR: 'text-blue-400',
    FORENSIC_OFFICER: 'text-cyan-400',
    LEGAL_OFFICER: 'text-amber-400',
    AUDITOR: 'text-purple-400',
  };

  const roleWorkspaceLabel: Record<string, string> = {
    ADMIN: 'System Administration',
    INVESTIGATOR: 'Investigative Module',
    FORENSIC_OFFICER: 'Forensic & Lab Workspace',
    LEGAL_OFFICER: 'Prosecution & Court Workspace',
    AUDITOR: 'Compliance Oversight',
  };

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 transition-all duration-300 glass border-r border-dark-700/50 flex flex-col`}>
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-dark-700/50">
          <Fingerprint className="w-8 h-8 text-vault-500 flex-shrink-0" />
          {!collapsed && (
            <div className="ml-3 animate-fade-in">
              <h1 className="text-base font-bold text-white tracking-tight">EvidenceVault</h1>
              <p className="text-[10px] text-dark-400 uppercase tracking-widest">Secure • Verified • Trusted</p>
            </div>
          )}
        </div>

        {/* Role Workspace Indicator */}
        {!collapsed && (
          <div className="px-4 py-2 border-b border-dark-700/40 bg-dark-950/40">
            <span className="text-[9px] font-mono uppercase tracking-widest text-dark-400 font-semibold block">
              {roleWorkspaceLabel[currentRole] || 'Role Workspace'}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                ${isActive
                  ? 'bg-vault-600/20 text-vault-400 border border-vault-600/30 shadow-lg shadow-vault-600/10'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'
                }`
              }
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
              {!collapsed && <span className="animate-fade-in">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Public Citizen Portal Quick Link */}
        <div className="p-2 border-t border-dark-700/50">
          <NavLink
            to="/citizen-portal"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/20 transition-all"
            title="Public Citizen FIR Portal"
          >
            <ShieldCheck className={`w-4 h-4 flex-shrink-0 ${collapsed ? 'mx-auto' : ''}`} />
            {!collapsed && <span>Citizen Portal ↗</span>}
          </NavLink>
        </div>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-3 border-t border-dark-700/50 text-dark-400 hover:text-dark-200 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5 mx-auto" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 glass border-b border-dark-700/50 flex items-center px-6 gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search evidence, cases, people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-dark-800/50 border border-dark-700 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-vault-600/50 focus:ring-1 focus:ring-vault-600/25 transition-all"
            />
            {/* Search Results Dropdown */}
            {showSearch && searchResults && (
              <div className="absolute top-full left-0 right-0 mt-2 glass-card p-4 z-50 max-h-80 overflow-y-auto">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs text-dark-400 uppercase tracking-wider">Search Results</span>
                  <button onClick={() => setShowSearch(false)} className="text-dark-500 hover:text-dark-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {searchResults.cases?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-vault-400 font-semibold mb-1">Cases</p>
                    {searchResults.cases.map((c: any) => (
                      <button key={c.id} onClick={() => { navigate(`/cases/${c.id}`); setShowSearch(false); }}
                        className="block w-full text-left px-2 py-1.5 rounded text-sm text-dark-300 hover:bg-dark-800/50">
                        <span className="text-vault-400 font-mono text-xs">{c.case_number}</span> {c.title}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.evidence?.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-cyber-400 font-semibold mb-1">Evidence</p>
                    {searchResults.evidence.map((e: any) => (
                      <button key={e.id} onClick={() => { navigate(`/evidence/${e.id}`); setShowSearch(false); }}
                        className="block w-full text-left px-2 py-1.5 rounded text-sm text-dark-300 hover:bg-dark-800/50">
                        <span className="text-cyber-400 font-mono text-xs">{e.evidence_id}</span> {e.filename}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.people?.length > 0 && (
                  <div>
                    <p className="text-xs text-amber-400 font-semibold mb-1">People</p>
                    {searchResults.people.map((p: any) => (
                      <div key={p.id} className="px-2 py-1.5 text-sm text-dark-300">
                        {p.name} <span className="text-dark-500 text-xs">({p.role})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* 1-Click Role Switcher for Hackathon Demo */}
            <RoleSwitcher />

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-dark-400 hover:text-dark-200 transition-colors cursor-pointer"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-dark-900"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-96 glass-card p-4 z-50 flex flex-col max-h-[80vh] shadow-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-dark-400 uppercase tracking-wider font-semibold">Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
                    <div className="flex gap-2">
                       {unreadCount > 0 && (
                         <button onClick={markAllRead} className="text-xs text-vault-400 hover:text-vault-300 cursor-pointer">Mark all read</button>
                       )}
                       <button onClick={() => setShowNotifications(false)} className="text-dark-500 hover:text-dark-300 cursor-pointer">
                         <X className="w-4 h-4" />
                       </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-1">
                    {notifications.length === 0 && !notificationsLoading ? (
                      <div className="text-sm text-dark-300 text-center py-6">
                        <p className="text-slate-400">No notifications</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { if (!n.read) markRead(n.id); navigate(n.link); setShowNotifications(false); }}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${n.read ? 'bg-dark-800/20 border-dark-700/30 hover:bg-dark-800/40' : 'bg-dark-800/60 border-vault-700/50 hover:bg-dark-700/60'}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${n.type === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : n.type === 'WARNING' ? 'bg-amber-500/20 text-amber-400' : n.type === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>{n.category.replace('_', ' ')}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-dark-400">{new Date(n.timestamp).toLocaleDateString()}</span>
                                <button onClick={(e) => dismissNotif(n.id, e)} className="text-dark-500 hover:text-red-400 cursor-pointer" title="Dismiss">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <h4 className={`text-sm font-medium ${n.read ? 'text-dark-300' : 'text-dark-100'} mt-1`}>{n.title}</h4>
                            <p className="text-xs text-dark-400 mt-1 line-clamp-2">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {notificationsLoading && (
                       <div className="text-center py-4">
                         <span className="text-xs text-vault-400 animate-pulse">Loading...</span>
                       </div>
                    )}
                    {hasMore && !notificationsLoading && (
                       <button onClick={() => loadNotifications(false)} className="w-full py-2 mt-2 text-xs font-medium text-dark-300 bg-dark-800/50 hover:bg-dark-700/50 rounded-lg cursor-pointer">
                         Load More
                       </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User */}
            <div className="flex items-center gap-3 pl-3 border-l border-dark-700">
              <div className="text-right">
                <p className="text-sm font-medium text-dark-200">{user?.full_name}</p>
                <p className={`text-xs font-semibold ${roleColor[user?.role || ''] || 'text-dark-400'}`}>
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-vault-600/30 border border-vault-500/30 flex items-center justify-center">
                <span className="text-sm font-bold text-vault-400">
                  {user?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
              <button onClick={handleLogout} className="p-2 text-dark-500 hover:text-red-400 transition-colors cursor-pointer" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
