import { useState, useEffect } from 'react';
import { blockchainApi } from '../services/api';
import type { BlockchainBlock } from '../types';
import { Blocks, CheckCircle, XCircle, Shield, RefreshCw } from 'lucide-react';

export default function BlockchainPage() {
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    blockchainApi.listBlocks()
      .then((r) => setBlocks(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await blockchainApi.verifyChain();
      setVerifyResult(res.data);
    } catch { /* ignore */ }
    setVerifying(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Blocks className="w-7 h-7 text-cyan-400" /> Evidence Integrity Ledger
          </h1>
          <p className="text-dark-400 text-sm mt-1">{blocks.length} blocks in chain • <strong className="text-yellow-500">Ledger Status: Development / Local Ledger</strong></p>
        </div>
        <button onClick={handleVerify} disabled={verifying} className="btn-success flex items-center gap-2 text-sm">
          {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          Verify Ledger Chain
        </button>
      </div>

      <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
        <p className="text-blue-200 text-sm">
          <strong>Architecture Note:</strong> The current system uses a simulated Proof-of-Authority ledger stored in the local SQL database. It provides cryptographic hashing and chaining, but is not a decentralized distributed ledger.
        </p>
      </div>

      {/* Verify Result */}
      {verifyResult && (
        <div className={`glass-card p-6 border ${verifyResult.valid ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-center gap-3">
            {verifyResult.valid ? (
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
            <div>
              <p className={`text-lg font-bold ${verifyResult.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {verifyResult.valid ? '✓ Blockchain Integrity Verified' : '✕ Blockchain Integrity Compromised'}
              </p>
              <p className="text-sm text-dark-400">{verifyResult.message}</p>
              <p className="text-xs text-dark-500 mt-1">Blocks checked: {verifyResult.blocks_checked}</p>
            </div>
          </div>
          {verifyResult.valid && (
            <p className="text-xs text-emerald-500/70 mt-3 italic">All blocks are cryptographically linked. No tampering detected.</p>
          )}
          {verifyResult.errors?.length > 0 && (
            <div className="mt-3 space-y-1">
              {verifyResult.errors.map((e: any, i: number) => (
                <p key={i} className="text-xs text-red-400">⚠ Block #{e.block_index}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blocks */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {blocks.map((b) => (
            <div key={b.id} className="glass-card p-5 hover-lift">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-cyan-400">#{b.block_index}</span>
                  </div>
                  <div>
                    <p className="text-sm font-mono text-cyan-400">{b.evidence_id}</p>
                    <p className="text-xs text-dark-400">{b.actor} • {b.actor_role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="badge bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 text-xs">{b.action}</span>
                  <p className="text-xs text-dark-500 mt-1">{b.timestamp ? new Date(b.timestamp).toLocaleString() : ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-dark-800/50">
                  <span className="text-dark-500">Hash: </span>
                  <span className="font-mono text-cyan-400">{b.current_hash.substring(0, 32)}...</span>
                </div>
                <div className="p-2 rounded bg-dark-800/50">
                  <span className="text-dark-500">Prev: </span>
                  <span className="font-mono text-dark-600">{b.previous_hash.substring(0, 32)}...</span>
                </div>
              </div>
              {b.document_hash && (
                <div className="mt-2 p-2 rounded bg-dark-800/50 text-xs">
                  <span className="text-dark-500">Doc Hash: </span>
                  <span className="font-mono text-vault-400">{b.document_hash.substring(0, 32)}...</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
