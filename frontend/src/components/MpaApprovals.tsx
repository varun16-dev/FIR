import { useState, useEffect } from 'react';
import { Shield, Check, Users } from 'lucide-react';
import { approvalsApi } from '../services/api';
import { useAuth } from '../App';

export function MpaApprovals({ evidenceId }: { evidenceId?: number }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await approvalsApi.getRequests(evidenceId);
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // eslint-disable-next-line
  }, [evidenceId]);

  const handleApprove = async (requestId: string) => {
    try {
      await approvalsApi.approveRequest(requestId);
      fetchRequests();
    } catch (err: any) {
      alert("Failed to approve: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateRequest = async (operation: string) => {
    if (!evidenceId) return;
    try {
      await approvalsApi.createRequest({
        operation,
        evidence_id: evidenceId,
        reason: `Requested ${operation} for evidence ${evidenceId}`,
        required_approval_count: 2,
        allowed_approver_roles: 'ADMINISTRATOR,LEGAL_PROSECUTOR'
      });
      fetchRequests();
    } catch (err: any) {
      alert("Failed to create request: " + (err.response?.data?.detail || err.message));
    }
  };

  if (loading) return <div className="text-gray-500">Loading approvals...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-vault-400" />
          Multi-Party Authorization
        </h2>
        {evidenceId && (
          <div className="flex gap-2">
            <button 
              onClick={() => handleCreateRequest('DESTRUCT_EVIDENCE')}
              className="btn-danger text-xs"
            >
              Request Destruction
            </button>
            <button 
              onClick={() => handleCreateRequest('TRANSFER_CUSTODY')}
              className="btn-secondary text-xs"
            >
              Request Transfer
            </button>
          </div>
        )}
      </div>

      {requests.length === 0 ? (
        <div className="glass-card p-6 text-center text-dark-400">
          No MPA requests found.
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const hasSigned = r.signatures.some((s: any) => s.approver_id === user?.id);
            const canSign = r.status === 'PENDING' && !hasSigned && 
                           (r.allowed_approver_roles === '' || r.allowed_approver_roles.includes(user?.role || ''));

            return (
              <div key={r.id} className="glass-card p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-md font-bold text-white flex items-center gap-2">
                      {r.operation}
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                        r.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {r.status}
                      </span>
                    </h3>
                    <p className="text-sm text-dark-400 mt-1">Request ID: {r.request_id}</p>
                    <p className="text-sm text-dark-400">Reason: {r.reason}</p>
                  </div>
                  {canSign && (
                    <button 
                      onClick={() => handleApprove(r.request_id)}
                      className="btn-success flex items-center gap-2 text-sm"
                    >
                      <Check className="w-4 h-4" /> Approve
                    </button>
                  )}
                </div>

                <div className="mt-4 bg-dark-900/50 rounded p-3">
                  <div className="flex justify-between text-sm text-dark-400 mb-2">
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" /> Signatures</span>
                    <span>{r.signatures.length} / {r.required_approval_count} Required</span>
                  </div>
                  <div className="space-y-2">
                    {r.signatures.map((s: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs items-center bg-dark-800 p-2 rounded">
                        <span className="text-white">Role: {s.approver_role} (ID: {s.approver_id})</span>
                        <span className="text-dark-400 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-400" /> Signed
                        </span>
                      </div>
                    ))}
                    {r.signatures.length === 0 && (
                      <div className="text-xs text-dark-500 text-center">No signatures yet</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
