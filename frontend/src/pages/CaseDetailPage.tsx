import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { caseApi, evidenceApi, publicApi } from '../services/api';
import type { Case, Evidence } from '../types';
import ReactFlow, { Background, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Shield,
  Upload,
  ArrowLeft,
  Calendar,
  User,
  Eye,
  QrCode,
  RefreshCw,
  FileText,
  Image,
  File,
  GitBranch,
  CheckCircle2,
  Clock,
  Circle,
  Zap,
  Layers,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';


import { getCaseClassification } from '../utils/caseClassifications';

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [flowData, setFlowData] = useState<any>(null);
  const [graphNodes, setGraphNodes] = useState<any[]>([]);
  const [graphEdges, setGraphEdges] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'flow' | 'evidence'>('flow');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [advancingStage, setAdvancingStage] = useState(false);

  // Case QR Barcode modal state
  const [showCaseQr, setShowCaseQr] = useState(false);
  const [caseQrLoading, setCaseQrLoading] = useState(false);
  const [caseQrData, setCaseQrData] = useState<{ verification_url: string; qr_code: string } | null>(null);
  const [copiedCaseUrl, setCopiedCaseUrl] = useState(false);

  const openCaseQr = async () => {
    if (!caseData) return;
    setShowCaseQr(true);
    setCaseQrLoading(true);
    try {
      const res = await publicApi.verifyCase(caseData.case_number);
      setCaseQrData({
        verification_url: res.data.verification_url,
        qr_code: res.data.qr_code,
      });
    } catch (err) {
      console.error('Failed to load case QR', err);
    } finally {
      setCaseQrLoading(false);
    }
  };

  const loadData = useCallback(() => {
    if (!id) return;
    const caseIdNum = parseInt(id);

    Promise.all([
      caseApi.get(caseIdNum),
      caseApi.getEvidence(caseIdNum),
      caseApi.getFlow(caseIdNum).catch(() => ({ data: null })),
    ])
      .then(([c, e, f]) => {
        setCaseData(c.data);
        setEvidence(e.data);
        if (f?.data) {
          setFlowData(f.data);
          setGraphNodes(f.data.graph?.nodes || []);
          setGraphEdges(f.data.graph?.edges || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !id) return;
    const file = files[0];
    setUploading(true);
    setUploadError('');
    setUploadMsg(`Uploading & encrypting ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('case_id', id);
      formData.append('description', `Case evidence upload: ${file.name}`);

      await evidenceApi.upload(formData);
      setUploadMsg(`✓ ${file.name} registered successfully!`);
      setTimeout(() => {
        setShowUpload(false);
        setUploading(false);
        setUploadMsg('');
        loadData();
      }, 1000);
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.response?.data?.detail || 'Failed to upload evidence');
    }
  };

  const handleVerify = async (evId: number) => {
    setVerifyingId(evId);
    try {
      await evidenceApi.verify(evId);
      loadData();
    } catch {
      /* ignore */
    }
    setVerifyingId(null);
  };

  const handleAdvanceStage = async (stageId: string) => {
    if (!id) return;
    setAdvancingStage(true);
    try {
      await caseApi.advanceStage(parseInt(id), stageId);
      loadData();
    } catch (err) {
      console.error('Failed to advance stage', err);
    } finally {
      setAdvancingStage(false);
    }
  };

  const fileIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (mime.includes('image')) return <Image className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-blue-400" />;
  };

  if (loading || !caseData) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const classInfo = getCaseClassification(caseData.case_type);
  const CaseIcon = classInfo.icon;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <button
        onClick={() => navigate('/cases')}
        className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Cases
      </button>

      {/* Case Header */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono text-vault-400 font-semibold">{caseData.case_number}</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${classInfo.badge}`}>
                <CaseIcon className="w-3.5 h-3.5" />
                {classInfo.label}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-1">{caseData.title}</h1>
            <p className="text-sm text-dark-300 mt-2 whitespace-pre-line leading-relaxed">{caseData.description || 'No detailed case synopsis entered.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => openCaseQr()}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3 border border-vault-500/40 text-vault-300 hover:text-white transition-all shadow-sm"
              title="View & Scan Case QR Code Barcode"
            >
              <QrCode className="w-3.5 h-3.5 text-vault-400" />
              <span>Case QR Passport</span>
            </button>
            <span
              className={`badge ${
                caseData.priority === 'CRITICAL'
                  ? 'badge-critical'
                  : caseData.priority === 'HIGH'
                  ? 'badge-high'
                  : 'badge-medium'
              }`}
            >
              {caseData.priority}
            </span>
            <span className="badge badge-pending">{caseData.status.replace('_', ' ')}</span>
          </div>

        </div>

        {/* Protocol Guideline Banner */}
        <div className="mt-4 p-3 rounded-lg bg-dark-800/70 border border-dark-700/70 flex items-start gap-3 text-xs">
          <div className={`p-1.5 rounded-md bg-dark-900/80 ${classInfo.color} shrink-0`}>
            <CaseIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-white">Recommended Investigation Protocol: </span>
            <span className="text-dark-300">{classInfo.protocolNotes}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm text-dark-400 pt-4 border-t border-dark-700/50">
          <span className="flex items-center gap-1.5">
            <User className="w-4 h-4 text-vault-400" /> Lead: {caseData.investigating_officer || 'Investigator'}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-vault-400" /> Opened: {new Date(caseData.created_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-white">
            <Shield className="w-4 h-4 text-vault-400" /> Evidence Count: {evidence.length}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-3 border-b border-dark-700/70 pb-2">
        <button
          onClick={() => setActiveTab('flow')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'flow'
              ? 'bg-vault-600 text-white shadow-md shadow-vault-600/30'
              : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
          }`}
        >
          <GitBranch className="w-4 h-4 text-vault-300" /> Investigation Flow & Pipeline
          {flowData && (
            <span className="ml-1.5 px-2 py-0.2 rounded-full text-xs bg-white/20 text-white">
              {flowData.progress_pct}%
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'evidence'
              ? 'bg-vault-600 text-white shadow-md shadow-vault-600/30'
              : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
          }`}
        >
          <Shield className="w-4 h-4 text-vault-400" /> Case Evidence Files ({evidence.length})
        </button>
      </div>

      {/* TAB 1: INVESTIGATION FLOW & PIPELINE */}
      {activeTab === 'flow' && flowData && (
        <div className="space-y-6">
          {/* Progress Header Card */}
          <div className="glass-card p-5 border border-dark-700/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs text-dark-400 uppercase tracking-wider font-semibold">
                  Investigation Lifecycle Progression
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" /> Active Stage: {flowData.current_stage}
                </h3>
              </div>

              {/* Advance Stage Control */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-dark-400">Advance Workflow:</span>
                <select
                  disabled={advancingStage}
                  onChange={(e) => {
                    if (e.target.value) handleAdvanceStage(e.target.value);
                  }}
                  defaultValue=""
                  className="px-3 py-1.5 bg-dark-800 border border-dark-600 rounded-lg text-xs text-white focus:outline-none focus:border-vault-500"
                >
                  <option value="" disabled>
                    Select Next Stage...
                  </option>
                  <option value="active_investigation">⚡ Active Investigation</option>
                  <option value="chargesheet_filed">📜 Chargesheet Formulated</option>
                  <option value="court_trial">⚖️ Court Trial & Judicial Review</option>
                  <option value="case_closed">✓ Close Case / Disposed</option>
                </select>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-dark-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-vault-500 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${flowData.progress_pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-dark-400 mt-2">
              <span>FIR Registered</span>
              <span className="font-semibold text-white">{flowData.progress_pct}% Completed</span>
              <span>Judicial Disposal</span>
            </div>
          </div>

          {/* 7-Stage Stepper Flow */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-vault-400" /> Investigation Procedural Stages
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {(flowData.stages || []).map((st: any) => {
                const isDone = st.status === 'COMPLETED';
                const isCurrent = st.status === 'CURRENT';

                return (
                  <div
                    key={st.id}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-dark-800/90 border-vault-500 shadow-lg shadow-vault-900/40 ring-1 ring-vault-500/50'
                        : isDone
                        ? 'bg-dark-800/40 border-emerald-500/30'
                        : 'bg-dark-900/40 border-dark-700/60 opacity-70'
                    }`}
                  >
                    <div>
                      {/* Step Header */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-900 text-dark-400">
                          STAGE {st.step}
                        </span>
                        {isDone ? (
                          <span className="badge bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </span>
                        ) : isCurrent ? (
                          <span className="badge bg-vault-500/20 text-vault-300 border border-vault-500/40 text-[10px] flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="badge bg-dark-700/50 text-dark-500 border border-dark-600/40 text-[10px]">
                            Pending
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-white mb-1">{st.name}</h4>
                      <p className="text-[11px] text-dark-400 mb-3 leading-relaxed">{st.description}</p>
                    </div>

                    {/* Checklist & Actor */}
                    <div className="pt-2 border-t border-dark-700/40 space-y-1 text-[10px]">
                      {st.checklist?.map((chk: any, cidx: number) => (
                        <div key={cidx} className="flex items-center gap-1.5 text-dark-300">
                          {chk.done ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-3 h-3 text-dark-500 shrink-0" />
                          )}
                          <span className={chk.done ? 'text-dark-200' : 'text-dark-500'}>{chk.task}</span>
                        </div>
                      ))}
                      <div className="mt-2 text-[9px] text-dark-500 font-mono pt-1">
                        Responsible: {st.actor}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive ReactFlow Diagram */}
          <div className="glass-card p-5 border border-dark-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-blue-400" /> Interactive Case Flowchart Diagram
                </h3>
                <p className="text-xs text-dark-400 mt-0.5">
                  Visual node network linking Incident FIR → Officer → Seized Evidence → Forensics & AI → Cryptographic Block → Court Presentation
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-dark-400">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Case
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Officer
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Forensics
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" /> Cryptographic Ledger
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Court
                </span>
              </div>
            </div>

            <div className="h-[460px] w-full rounded-xl overflow-hidden border border-dark-700/80 bg-dark-950/70">
              <ReactFlow
                nodes={graphNodes}
                edges={graphEdges}
                fitView
                attributionPosition="bottom-right"
              >
                <Background color="#334155" gap={16} size={1} />
                <Controls className="bg-dark-800 border-dark-700 fill-white text-white" />
              </ReactFlow>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EVIDENCE SECTION */}
      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-vault-400" /> Case Evidence Files ({evidence.length})
            </h2>
            <button
              onClick={() => {
                setShowUpload(true);
                setUploadError('');
                setUploadMsg('');
              }}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Upload className="w-4 h-4" /> + Upload Evidence
            </button>
          </div>

          {/* Evidence Table */}
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700/50 bg-dark-800/40">
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Evidence ID</th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Filename</th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Type</th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Uploaded By</th>
                    <th className="text-center py-3 px-4 text-dark-400 font-medium text-xs uppercase">Version</th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Integrity</th>
                    <th className="text-left py-3 px-4 text-dark-400 font-medium text-xs uppercase">Status</th>
                    <th className="text-right py-3 px-4 text-dark-400 font-medium text-xs uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-dark-400 text-xs">
                        No evidence registered for this case yet. Click "+ Upload Evidence" above.
                      </td>
                    </tr>
                  ) : (
                    evidence.map((ev) => (
                      <tr
                        key={ev.id}
                        onClick={() => navigate(`/evidence/${ev.id}`)}
                        className="border-b border-dark-800/50 hover:bg-dark-800/30 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-vault-400 text-xs font-semibold">{ev.evidence_id}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {fileIcon(ev.mime_type)}
                            <span className="text-dark-200 font-medium truncate max-w-[200px]" title={ev.original_filename}>
                              {ev.original_filename}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="badge bg-vault-600/15 text-vault-400 border border-vault-600/25 text-[11px]">
                            {ev.classification || ev.evidence_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-dark-300">{ev.uploaded_by_name || 'Investigator'}</td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-dark-800 text-dark-300 border border-dark-700">
                            v{ev.current_version}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`badge text-[11px] ${
                              ev.integrity_status === 'VERIFIED'
                                ? 'badge-verified'
                                : ev.integrity_status === 'TAMPERED'
                                ? 'badge-tampered'
                                : 'badge-pending'
                            }`}
                          >
                            {ev.integrity_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-dark-400">{ev.status || 'REGISTERED'}</td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/evidence/${ev.id}`)}
                              className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => navigate(`/evidence/${ev.id}/passport`)}
                              className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
                              title="Evidence Passport"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleVerify(ev.id)}
                              disabled={verifyingId === ev.id}
                              className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
                              title="Verify Cryptographic Integrity"
                            >
                              <RefreshCw className={`w-4 h-4 ${verifyingId === ev.id ? 'animate-spin text-vault-400' : ''}`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-vault-400" /> Upload Case Evidence
            </h2>
            {uploadMsg && (
              <div className="mb-4 p-3 rounded-lg bg-vault-500/10 border border-vault-500/30 text-vault-300 text-sm">
                {uploadMsg}
              </div>
            )}
            {uploadError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {uploadError}
              </div>
            )}
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-dark-600 rounded-xl hover:border-vault-500/50 cursor-pointer transition-colors bg-dark-800/30">
                <Upload className="w-8 h-8 text-dark-400 mb-2" />
                <span className="text-sm text-dark-300 font-medium">Select file to encrypt & upload</span>
                <span className="text-xs text-dark-500 mt-1">PDF, DOCX, Images, Audio, Video, Logs</span>
                <input
                  type="file"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowUpload(false)}
                  disabled={uploading}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Case QR Barcode Modal */}

      {showCaseQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card p-6 w-full max-w-md border-dark-700 space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-dark-700/60 pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="p-2 rounded-lg bg-vault-600/20 text-vault-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Case QR Barcode Passport</h3>
                  <p className="text-[11px] font-mono text-vault-400">{caseData.case_number}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCaseQr(false)}
                className="text-dark-400 hover:text-white p-1 rounded hover:bg-dark-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Universal QR Image */}
            <div className="py-2">
              {caseQrLoading ? (
                <div className="w-52 h-52 mx-auto flex flex-col items-center justify-center bg-dark-900 rounded-xl border border-dark-800">
                  <RefreshCw className="w-8 h-8 text-vault-400 animate-spin mb-2" />
                  <span className="text-xs text-dark-400">Generating Universal QR...</span>
                </div>
              ) : caseQrData?.qr_code ? (
                <div className="bg-white p-4 rounded-xl inline-block shadow-2xl border-4 border-vault-500/40 mx-auto">
                  <img
                    src={`data:image/png;base64,${caseQrData.qr_code}`}
                    alt="Case QR Code"
                    className="w-52 h-52 mx-auto"
                  />
                </div>
              ) : (
                <div className="w-52 h-52 mx-auto flex items-center justify-center bg-dark-900 rounded-xl">
                  <QrCode className="w-16 h-16 text-dark-600" />
                </div>
              )}
            </div>

            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              ✓ Universal QR Code — Scannable by Mobile Phone Camera, Tablet, or Laptop
            </div>

            <p className="text-xs text-dark-400 leading-relaxed max-w-xs mx-auto">
              Scan with any smartphone camera or QR reader to view this full case docket, assigned officers, and all secured evidence items.
            </p>

            {/* Action buttons */}
            <div className="space-y-2 pt-2">
              {caseQrData?.verification_url && (
                <a
                  href={caseQrData.verification_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg bg-vault-600 hover:bg-vault-500 text-white text-xs font-semibold shadow transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Public Case Dossier (Test Scan)</span>
                </a>
              )}
              {caseQrData?.verification_url && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(caseQrData.verification_url);
                    setCopiedCaseUrl(true);
                    setTimeout(() => setCopiedCaseUrl(false), 2000);
                  }}
                  className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-xs border border-dark-700 transition-colors"
                >
                  {copiedCaseUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCaseUrl ? 'Case URL Copied!' : 'Copy Verification URL'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

