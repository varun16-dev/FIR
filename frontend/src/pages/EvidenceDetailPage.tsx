import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { evidenceApi, aiApi, blockchainApi, reportApi, dashboardApi, userApi, e3eeApi } from '../services/api';
import type { Evidence, EvidencePassport, AIAnalysis, CustodyEvent, EvidenceVersion, VerifyResult, BlockchainBlock } from '../types';
import { getOrCreateClientKeyPair, importRsaPrivateKey, unwrapKeyWithRsa, decryptFile } from '../utils/crypto';
import { MpaApprovals } from '../components/MpaApprovals';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft, CheckCircle, XCircle, AlertTriangle, Brain,
  Link2, Clock, RefreshCw, QrCode, Hash, Lock,
  Blocks, Users, FileDown, Zap, Eye, ExternalLink, Download
} from 'lucide-react';



export default function EvidenceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [ai, setAi] = useState<AIAnalysis | null>(null);
  const [custody, setCustody] = useState<CustodyEvent[]>([]);
  const [versions, setVersions] = useState<EvidenceVersion[]>([]);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [blocks, setBlocks] = useState<BlockchainBlock[]>([]);
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphEdges, setGraphEdges] = useState<any[]>([]);
  const [tab, setTab] = useState('passport');
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [transferTarget, setTransferTarget] = useState('');

  useEffect(() => {
    if (!id) return;
    const eid = parseInt(id);

    Promise.all([
      evidenceApi.get(eid),
      evidenceApi.getPassport(eid),
      aiApi.getResults(eid).catch(() => ({ data: null })),
      evidenceApi.getCustody(eid),
      evidenceApi.getVersions(eid),
    ]).then(([ev, pp, aiRes, cust, ver]) => {
      setEvidence(ev.data);
      setPassport(pp.data);
      setAi(aiRes.data);
      setCustody(cust.data);
      setVersions(ver.data);

      // Load blockchain blocks
      if (ev.data.evidence_id) {
        blockchainApi.getEvidenceBlocks(ev.data.evidence_id)
          .then(r => setBlocks(r.data.blocks || []))
          .catch(() => {});
      }

      // Load graph
      evidenceApi.getGraph(eid)
        .then(r => {
          const nodeTypeColors: Record<string, string> = {
            case: '#3b82f6', evidence: '#6366f1', person: '#f59e0b', location: '#10b981',
          };
          const nodes = r.data.nodes.map((n: any, i: number) => ({
            id: n.id,
            position: {
              x: 250 + (i % 4) * 200 + (Math.random() * 50 - 25),
              y: 100 + Math.floor(i / 4) * 150 + (Math.random() * 30 - 15),
            },
            data: {
              label: (
                <div className="text-center">
                  <div className="text-xs font-bold" style={{ color: nodeTypeColors[n.type] || '#94a3b8' }}>
                    {n.type.toUpperCase()}
                  </div>
                  <div className="text-xs text-gray-300 mt-0.5">{n.label}</div>
                </div>
              ),
            },
            style: {
              background: 'rgba(30,41,59,0.9)',
              border: `2px solid ${nodeTypeColors[n.type] || '#475569'}`,
              borderRadius: 10,
              padding: '8px 12px',
              minWidth: 120,
            },
          }));
          const edges = r.data.edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
            style: { stroke: '#6366f1' },
            labelStyle: { fill: '#94a3b8', fontSize: 10 },
            animated: e.type === 'BELONGS_TO',
          }));
          setGraphNodes(nodes);
          setGraphEdges(edges);
        })
        .catch(() => {});
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleVerify = async () => {
    if (!id) return;
    setVerifying(true);
    try {
      const res = await evidenceApi.verify(parseInt(id));
      setVerifyResult(res.data);
      // Refresh evidence status
      const ev = await evidenceApi.get(parseInt(id));
      setEvidence(ev.data);
    } catch { /* ignore */ }
    setVerifying(false);
  };

  const handleDownloadReport = async () => {
    if (!id) return;
    try {
      const res = await reportApi.generateEvidence(parseInt(id));
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${evidence?.evidence_id}.pdf`;
      a.click();
    } catch { /* ignore */ }
  };

  const handleE3eeDownload = async () => {
    if (!id || !evidence) return;
    try {
      // 1. Get Key Envelope
      const envRes = await e3eeApi.getEnvelope(parseInt(id));
      const encryptedKey = envRes.data.encrypted_key;

      // 2. Load our Private Key
      const { privateKeyPem } = await getOrCreateClientKeyPair();
      const rsaPrivKey = await importRsaPrivateKey(privateKeyPem);

      // 3. Unwrap the AES Key
      const aesKey = await unwrapKeyWithRsa(encryptedKey, rsaPrivKey);

      // 4. Download Ciphertext Blob
      const ctRes = await evidenceApi.download(parseInt(id));
      
      // 5. Fetch Metadata (for IV/nonce)
      const metaRes = await e3eeApi.getMetadata(parseInt(id));
      const iv = metaRes.data.nonce;
      
      if (!iv) {
        alert("Missing IV for decryption. Was this evidence encrypted with E3EE?");
        return;
      }
      
      // 6. Decrypt
      const plaintextBlob = await decryptFile(ctRes.data, aesKey, iv);
      
      // 7. Save File
      const url = window.URL.createObjectURL(plaintextBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = evidence.original_filename;
      a.click();
    } catch (err: any) {
      alert("Decryption failed: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleSimulateTamper = async () => {
    if (!id) return;
    try {
      await dashboardApi.simulateTamper(parseInt(id));
      const ev = await evidenceApi.get(parseInt(id));
      setEvidence(ev.data);
      const pp = await evidenceApi.getPassport(parseInt(id));
      setPassport(pp.data);
    } catch { /* ignore */ }
  };

  const handleTransfer = async () => {
    if (!id || !transferTarget) return;
    try {
      await evidenceApi.transfer(parseInt(id), { target_user_id: parseInt(transferTarget) });
      setShowTransfer(false);
      const ev = await evidenceApi.get(parseInt(id));
      setEvidence(ev.data);
      const cust = await evidenceApi.getCustody(parseInt(id));
      setCustody(cust.data);
    } catch { /* ignore */ }
  };

  if (loading || !evidence || !passport) {
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const entities = ai?.entities_json ? JSON.parse(ai.entities_json) : [];
  const anomalies = ai?.anomalies_json ? JSON.parse(ai.anomalies_json) : [];

  const tabs = [
    { id: 'passport', label: 'Evidence Passport', icon: QrCode },
    { id: 'ai', label: 'AI Analysis', icon: Brain },
    { id: 'custody', label: 'Chain of Custody', icon: Link2 },
    { id: 'versions', label: 'Versions', icon: Clock },
    { id: 'blockchain', label: 'Cryptographic Ledger', icon: Blocks },
    { id: 'approvals', label: 'Approvals', icon: Users },
    { id: 'graph', label: 'Evidence Graph', icon: Eye },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate('/evidence')} className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Evidence Vault
      </button>

      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-mono font-bold text-vault-400">{evidence.evidence_id}</span>
              <span className={`badge ${evidence.integrity_status === 'VERIFIED' ? 'badge-verified' : evidence.integrity_status === 'TAMPERED' ? 'badge-tampered' : 'badge-pending'}`}>
                {evidence.integrity_status}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-2">{evidence.original_filename}</h1>
            <p className="text-sm text-dark-400 mt-1">Case: {evidence.case_number} • {evidence.classification} • v{evidence.current_version}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate(`/evidence/${id}/passport`)} className="btn-secondary flex items-center gap-2 text-sm">
              <QrCode className="w-4 h-4 text-vault-400" /> Passport
            </button>
            <button onClick={handleVerify} disabled={verifying} className="btn-success flex items-center gap-2 text-sm">
              {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Verify Integrity
            </button>
            <button onClick={handleE3eeDownload} className="btn-primary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Download Original (E3EE)
            </button>
            <button onClick={handleDownloadReport} className="btn-secondary flex items-center gap-2 text-sm">
              <FileDown className="w-4 h-4" /> Report
            </button>
            <button onClick={() => { userApi.list().then(r => setUsers(r.data)); setShowTransfer(true); }}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Users className="w-4 h-4" /> Transfer
            </button>
            <button onClick={handleSimulateTamper} className="btn-danger flex items-center gap-2 text-xs">
              <Zap className="w-3 h-3" /> Demo: Tamper
            </button>
          </div>

        </div>

        {/* Verify Result Banner */}
        {verifyResult && (
          <div className={`mt-4 p-4 rounded-lg border ${verifyResult.status === 'VERIFIED'
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-3">
              {verifyResult.status === 'VERIFIED' ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <div>
                <p className={`font-bold ${verifyResult.status === 'VERIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {verifyResult.status === 'VERIFIED' ? '✓ INTEGRITY VERIFIED' : '✕ TAMPERING DETECTED'}
                </p>
                <p className="text-sm text-dark-400 mt-1">{verifyResult.details}</p>
                <div className="mt-2 text-xs font-mono text-dark-500">
                  <p>Stored Hash: {verifyResult.stored_hash}</p>
                  <p>Computed Hash: {verifyResult.computed_hash}</p>
                  <p>Blockchain: {verifyResult.blockchain_valid ? '✓ Valid' : '✕ Issue detected'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800/30 rounded-lg p-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t.id ? 'bg-vault-600/20 text-vault-400 border border-vault-600/30' : 'text-dark-400 hover:text-dark-200'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {/* PASSPORT TAB */}
        {tab === 'passport' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-vault-400" /> Evidence Passport
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Evidence ID', passport.evidence_id],
                  ['Case Number', passport.case_number],
                  ['Filename', passport.original_filename],
                  ['Type', passport.evidence_type],
                  ['MIME Type', passport.mime_type],
                  ['File Size', `${(passport.file_size / 1024).toFixed(1)} KB`],
                  ['Version', `v${passport.current_version}`],
                  ['Custodian', passport.current_custodian],
                  ['Classification', passport.classification],
                  ['AI Confidence', `${(passport.ai_confidence * 100).toFixed(0)}%`],
                  ['Blockchain', passport.blockchain_status || 'ANCHORED'],
                  ['Custody Events', (passport.custody_count ?? passport.custody_event_count ?? 1).toString()],
                  ['Created', new Date(passport.created_at).toLocaleString()],

                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-dark-500 text-xs uppercase">{label}</p>
                    <p className="text-dark-200 font-medium mt-0.5">{val}</p>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-dark-700/50">
                <p className="text-dark-500 text-xs uppercase mb-1">SHA-256 Hash</p>
                <p className="font-mono text-xs text-vault-400 break-all bg-dark-800/50 p-3 rounded-lg flex items-center gap-2">
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  {passport.sha256_hash}
                </p>
              </div>
            </div>
            {/* QR Code */}
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
              <p className="text-xs text-dark-500 uppercase mb-3">Scannable Verification Barcode</p>
              <div className="bg-white p-3 rounded-xl shadow-lg border-2 border-vault-500/30 mb-2">
                {passport.qr_code ? (
                  <img src={`data:image/png;base64,${passport.qr_code}`} alt="QR Code"
                    className="w-44 h-44 rounded-lg" />
                ) : (
                  <div className="w-44 h-44 rounded-lg bg-dark-800 flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-dark-600" />
                  </div>
                )}
              </div>
              <p className="font-mono text-xs text-vault-400 font-semibold">{passport.evidence_id}</p>
              <p className="text-[11px] text-dark-400 mt-1">Scan via phone camera or barcode scanner</p>

              {passport.verification_url && (
                <a
                  href={passport.verification_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-vault-600/20 hover:bg-vault-600/30 text-vault-300 hover:text-white border border-vault-500/40 text-xs font-medium transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Test Scan / Public Verification</span>
                </a>
              )}

              <div className="mt-4 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400">Cryptographically Secured & Anchored</span>
              </div>
            </div>

          </div>
        )}

        {/* AI ANALYSIS TAB */}
        {tab === 'ai' && ai && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {[
                { label: 'Document Type', value: ai.document_type, color: 'text-vault-400' },
                { label: 'AI Confidence', value: `${(ai.confidence * 100).toFixed(0)}%`, color: 'text-blue-400' },
                { label: 'Risk Score', value: `${ai.risk_score.toFixed(0)}/100`, color: ai.risk_score >= 50 ? 'text-red-400' : 'text-emerald-400' },
                { label: 'Risk Level', value: ai.risk_level, color: ai.risk_level === 'HIGH' ? 'text-red-400' : ai.risk_level === 'MEDIUM' ? 'text-amber-400' : 'text-emerald-400' },
              ].map((s) => (
                <div key={s.label} className="glass-card p-4">
                  <p className="text-xs text-dark-500 uppercase">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Brain className="w-4 h-4 text-vault-400" /> AI Summary
              </h3>
              <p className="text-sm text-dark-300 leading-relaxed">{ai.summary}</p>
              <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-xs text-dark-500">Key Persons</p>
                  <p className="text-lg font-bold text-amber-400">{ai.key_persons_count}</p>
                </div>
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-xs text-dark-500">Locations</p>
                  <p className="text-lg font-bold text-emerald-400">{ai.locations_count}</p>
                </div>
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-xs text-dark-500">Dates Detected</p>
                  <p className="text-lg font-bold text-blue-400">{ai.dates_count}</p>
                </div>
                <div className="p-3 rounded-lg bg-dark-800/50">
                  <p className="text-xs text-dark-500">Case References</p>
                  <p className="text-lg font-bold text-vault-400">{ai.case_references_count}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-dark-600 italic">Method: {ai.classification_method}-based classification • AI-Assisted Analysis</p>
            </div>

            {/* Entities */}
            {entities.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="text-sm font-semibold text-white mb-3">Extracted Entities</h3>
                <div className="flex flex-wrap gap-2">
                  {entities.slice(0, 20).map((e: any, i: number) => (
                    <span key={i} className={`badge text-xs ${
                      e.type === 'PERSON' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' :
                      e.type === 'LOCATION' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' :
                      e.type === 'DATE' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25' :
                      'bg-dark-600/30 text-dark-400 border border-dark-500/30'
                    }`}>
                      {e.type}: {e.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies */}
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> AI Integrity Analysis
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className={`text-3xl font-bold ${ai.risk_score >= 70 ? 'text-red-400' : ai.risk_score >= 30 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {ai.risk_score.toFixed(0)}/100
                </div>
                <span className={`badge ${ai.risk_level === 'HIGH' ? 'badge-high' : ai.risk_level === 'MEDIUM' ? 'badge-medium' : 'badge-low'}`}>
                  {ai.risk_level} RISK
                </span>
              </div>
              {anomalies.length === 0 ? (
                <div className="space-y-2">
                  {['Hash matches', 'Metadata consistent', 'No duplicate detected', 'Normal custody transition'].map(c => (
                    <div key={c} className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle className="w-4 h-4" /> {c}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {anomalies.map((a: any, i: number) => (
                    <div key={i} className={`flex items-center gap-2 text-sm ${a.severity === 'HIGH' ? 'text-red-400' : 'text-amber-400'}`}>
                      <AlertTriangle className="w-4 h-4" /> {a.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'ai' && !ai && (
          <div className="glass-card p-12 text-center">
            <Brain className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No AI analysis available yet</p>
            <button onClick={async () => {
              if (!id) return;
              const res = await aiApi.analyze(parseInt(id));
              setAi(res.data);
            }} className="btn-primary mt-4 text-sm">Run AI Analysis</button>
          </div>
        )}

        {/* CUSTODY TAB */}
        {tab === 'custody' && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-6 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cyber-400" /> Chain of Custody
            </h3>
            <div className="relative pl-8">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-vault-500 via-cyber-500 to-dark-700" />
              {custody.map((c, i) => (
                <div key={c.id} className="relative mb-6 last:mb-0">
                  <div className={`absolute -left-5 w-4 h-4 rounded-full border-2 ${
                    i === custody.length - 1 ? 'bg-vault-500 border-vault-400' : 'bg-dark-800 border-vault-500'
                  }`} />
                  <div className="glass-card p-4 ml-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{c.actor_name}</span>
                        <span className="badge bg-dark-600/30 text-dark-400 border border-dark-500/30 text-xs">{c.actor_role}</span>
                      </div>
                      <span className="text-xs text-dark-500">
                        {c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                    <p className="text-sm text-vault-400 font-medium">{c.action.replace('_', ' ')}</p>
                    {c.notes && <p className="text-xs text-dark-400 mt-1">{c.notes}</p>}
                    <div className="flex items-center gap-4 mt-2 text-xs text-dark-500">
                      <span>📍 {c.location}</span>
                      <span>🔒 {c.evidence_condition}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VERSIONS TAB */}
        {tab === 'versions' && (
          <div className="glass-card p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Version History</h3>
            <div className="space-y-3">
              {versions.map((v) => (
                <div key={v.id} className="flex items-center gap-4 p-4 bg-dark-800/30 rounded-lg border border-dark-700/50">
                  <div className="w-10 h-10 rounded-full bg-vault-600/20 flex items-center justify-center font-bold text-vault-400">
                    v{v.version_number}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{v.action} by {v.actor_name}</p>
                    <p className="text-xs text-dark-500 mt-0.5">{v.reason}</p>
                    <p className="text-xs font-mono text-dark-600 mt-1">Hash: {v.sha256_hash.substring(0, 32)}...</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-dark-500">{new Date(v.created_at).toLocaleString()}</p>
                    <p className="text-xs text-dark-600">{(v.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BLOCKCHAIN TAB */}
        {tab === 'blockchain' && (
          <div className="space-y-4">
            {blocks.map((b: any, i: number) => (
              <div key={i} className="glass-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Blocks className="w-5 h-5 text-cyan-400" />
                    <span className="text-lg font-bold text-white">Block #{b.block_index}</span>
                  </div>
                  <span className="badge bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 text-xs">{b.action}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-dark-500 uppercase">Evidence</p>
                    <p className="text-vault-400 font-mono">{b.evidence_id}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 uppercase">Actor</p>
                    <p className="text-dark-300">{b.actor}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-dark-500 uppercase">Current Hash</p>
                    <p className="text-cyan-400 font-mono break-all">{b.current_hash}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-dark-500 uppercase">Previous Hash</p>
                    <p className="text-dark-500 font-mono break-all">{b.previous_hash}</p>
                  </div>
                  <div>
                    <p className="text-dark-500 uppercase">Timestamp</p>
                    <p className="text-dark-400">{b.timestamp ? new Date(b.timestamp).toLocaleString() : ''}</p>
                  </div>
                </div>
              </div>
            ))}
            {blocks.length === 0 && (
              <div className="glass-card p-12 text-center">
                <Blocks className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                <p className="text-dark-400">No blockchain blocks for this evidence</p>
              </div>
            )}
          </div>
        )}

        {/* APPROVALS TAB */}
        {tab === 'approvals' && (
          <div className="mt-6">
            <MpaApprovals evidenceId={evidence.id} />
          </div>
        )}

        {/* GRAPH TAB */}
        {tab === 'graph' && (
          <div className="glass-card overflow-hidden" style={{ height: 500 }}>
            <ReactFlow
              nodes={graphNodes}
              edges={graphEdges}
              fitView
              style={{ background: '#0f172a' }}
            >
              <Background color="#1e293b" gap={20} />
              <Controls />
            </ReactFlow>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-white mb-4">Transfer Custody</h2>
            <select value={transferTarget} onChange={(e) => setTransferTarget(e.target.value)}
              className="w-full px-3 py-2 bg-dark-800/50 border border-dark-600 rounded-lg text-sm text-white mb-4">
              <option value="">Select recipient...</option>
              {users.map((u: any) => (
                <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
              ))}
            </select>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowTransfer(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={handleTransfer} className="btn-primary text-sm">Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
