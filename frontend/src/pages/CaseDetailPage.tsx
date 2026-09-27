import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { caseApi, evidenceApi, publicApi, aiApi, legalApi } from '../services/api';
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
  Bot,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  Send,
  Scale,
  Network,
  SendHorizontal,
  CalendarClock,
  ShieldAlert,
  FileCode,
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
  const [activeTab, setActiveTab] = useState<'flow' | 'evidence' | 'assistant' | 'integration'>('flow');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [advancingStage, setAdvancingStage] = useState(false);

  // Feature 2: AI Case Assistant ("Ask the Case")
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    q: string;
    a: string;
    sources?: string[];
    confidence?: string;
    contradictions_found?: number;
  }>>([]);
  const [contradictions, setContradictions] = useState<any[] | null>(null);
  const [contradictionsLoading, setContradictionsLoading] = useState(false);
  const [timeline, setTimeline] = useState<any[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Feature 5: National CCTNS / ICJS Integration
  const [syncingCctns, setSyncingCctns] = useState(false);
  const [transmittingIcjs, setTransmittingIcjs] = useState(false);
  const [syncActionMessage, setSyncActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [inspectPayload, setInspectPayload] = useState<{ title: string; json: any } | null>(null);

  // Feature 1 & 3: Legal & DPDP Exports
  const [exportingBsaPdf, setExportingBsaPdf] = useState(false);
  const [exportingDpdpPdf, setExportingDpdpPdf] = useState(false);

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

  // AI Case Assistant handlers
  const handleAskQuestion = async (customQ?: string) => {
    const q = customQ || chatQuestion;
    if (!q.trim() || !caseData) return;
    setChatLoading(true);
    try {
      const res = await aiApi.askTheCase({ case_id: caseData.id, question: q.trim() });
      setChatHistory((prev) => [
        {
          q: q.trim(),
          a: res.data.answer,
          sources: res.data.evidence_sources,
          confidence: res.data.confidence,
          contradictions_found: res.data.contradictions_flagged?.length || 0,
        },
        ...prev,
      ]);
      setChatQuestion('');
    } catch (err: any) {
      console.error('Ask the case failed', err);
      setChatHistory((prev) => [
        {
          q: q.trim(),
          a: `AI Assistant analysis unavailable: ${err.response?.data?.detail || err.message}`,
        },
        ...prev,
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const loadContradictions = async () => {
    if (!caseData) return;
    setContradictionsLoading(true);
    try {
      const res = await aiApi.getContradictions(caseData.id);
      setContradictions(res.data.contradictions || []);
    } catch (err) {
      console.error('Contradiction load failed', err);
    } finally {
      setContradictionsLoading(false);
    }
  };

  const loadTimeline = async () => {
    if (!caseData) return;
    setTimelineLoading(true);
    try {
      const res = await aiApi.getTimeline(caseData.id);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      console.error('Timeline load failed', err);
    } finally {
      setTimelineLoading(false);
    }
  };

  // CCTNS / ICJS handlers
  const handleSyncCctns = async () => {
    if (!caseData) return;
    setSyncingCctns(true);
    setSyncActionMessage(null);
    try {
      const res = await caseApi.syncCctns(caseData.id);
      setSyncActionMessage({
        text: `✓ Synchronized with National CCTNS CAS (Packet: ${res.data.cctns_sync_id})`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      setSyncActionMessage({
        text: `✕ CCTNS Sync Failed: ${err.response?.data?.detail || err.message}`,
        type: 'error',
      });
    } finally {
      setSyncingCctns(false);
    }
  };

  const handleTransmitIcjs = async () => {
    if (!caseData) return;
    setTransmittingIcjs(true);
    setSyncActionMessage(null);
    try {
      const res = await caseApi.transmitIcjs(caseData.id);
      setSyncActionMessage({
        text: `✓ Transmitted to e-Courts ICJS (Docket: ${res.data.icjs_docket_ref})`,
        type: 'success',
      });
      loadData();
    } catch (err: any) {
      setSyncActionMessage({
        text: `✕ ICJS Transmission Failed: ${err.response?.data?.detail || err.message}`,
        type: 'error',
      });
    } finally {
      setTransmittingIcjs(false);
    }
  };

  const handleInspectCctns = async () => {
    if (!caseData) return;
    try {
      const res = await caseApi.getCctnsPacket(caseData.id);
      setInspectPayload({
        title: 'NCRB CCTNS CAS IIF-I/V Standardized Packet',
        json: res.data,
      });
    } catch (err: any) {
      alert(`Could not fetch CCTNS packet: ${err.message}`);
    }
  };

  const handleInspectIcjs = async () => {
    if (!caseData) return;
    try {
      const res = await caseApi.getIcjsDossier(caseData.id);
      setInspectPayload({
        title: 'Interoperable Criminal Justice System (ICJS) Judicial Exchange Dossier',
        json: res.data,
      });
    } catch (err: any) {
      alert(`Could not fetch ICJS dossier: ${err.message}`);
    }
  };

  // PDF Export handlers
  const handleExportBsaPdf = async () => {
    if (!caseData) return;
    setExportingBsaPdf(true);
    try {
      const res = await legalApi.downloadBsaCaseCertificatePdf(caseData.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BSA_Sec63_Dossier_${caseData.case_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(`Failed to export BSA Certificate Dossier: ${err.message}`);
    } finally {
      setExportingBsaPdf(false);
    }
  };

  const handleExportDpdpPdf = async () => {
    if (!caseData) return;
    setExportingDpdpPdf(true);
    try {
      const res = await legalApi.downloadDpdpRedactedCasePdf(caseData.id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DPDP_Media_FIR_${caseData.case_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err: any) {
      alert(`Failed to export DPDP Sanitized FIR: ${err.message}`);
    } finally {
      setExportingDpdpPdf(false);
    }
  };

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
              onClick={handleExportBsaPdf}
              disabled={exportingBsaPdf}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3 border border-amber-500/40 text-amber-300 hover:text-white transition-all shadow-sm"
              title="Download Bharatiya Sakshya Adhiniyam Section 63 Electronic Certificate & Evidence Dossier"
            >
              <Scale className={`w-3.5 h-3.5 text-amber-400 ${exportingBsaPdf ? 'animate-spin' : ''}`} />
              <span>{exportingBsaPdf ? 'Exporting...' : 'BSA Sec 63 Dossier (PDF)'}</span>
            </button>
            <button
              onClick={handleExportDpdpPdf}
              disabled={exportingDpdpPdf}
              className="btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3 border border-emerald-500/40 text-emerald-300 hover:text-white transition-all shadow-sm"
              title="Download DPDP Act 2023 Compliant Redacted Public / Media FIR Slip"
            >
              <ShieldAlert className={`w-3.5 h-3.5 text-emerald-400 ${exportingDpdpPdf ? 'animate-spin' : ''}`} />
              <span>{exportingDpdpPdf ? 'Masking...' : 'DPDP Media FIR (PDF)'}</span>
            </button>
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
          {caseData.cctns_synced && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400 font-medium">
              <Network className="w-3.5 h-3.5" /> CCTNS: {caseData.cctns_sync_id || 'SYNCED'}
            </span>
          )}
          {caseData.icjs_transmitted && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <Scale className="w-3.5 h-3.5" /> ICJS: {caseData.icjs_docket_ref || 'TRANSMITTED'}
            </span>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-dark-700/70 pb-2">
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

        <button
          onClick={() => {
            setActiveTab('assistant');
            if (!contradictions) loadContradictions();
            if (!timeline) loadTimeline();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'assistant'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
          }`}
        >
          <Bot className="w-4 h-4 text-purple-300" /> AI Case Assistant ("Ask the Case")
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 font-mono">
            AI + Timeline
          </span>
        </button>

        <button
          onClick={() => setActiveTab('integration')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === 'integration'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-dark-400 hover:text-white hover:bg-dark-800/60'
          }`}
        >
          <Network className="w-4 h-4 text-blue-300" /> National CCTNS / ICJS
          {caseData.cctns_synced && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="CCTNS Synced" />
          )}
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

      {/* TAB 3: AI CASE ASSISTANT ("ASK THE CASE") */}
      {activeTab === 'assistant' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="glass-card p-6 border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-dark-800 to-dark-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    AI Case Assistant ("Ask the Case")
                    <span className="px-2 py-0.5 rounded text-[11px] bg-purple-500/20 text-purple-300 font-mono">
                      v2.0 Legal Copilot
                    </span>
                  </h2>
                  <p className="text-xs text-dark-300 mt-0.5">
                    Query witness statements, spot factual contradictions, and generate chronological crime timelines across all case evidence.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadContradictions}
                  disabled={contradictionsLoading}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 border border-purple-500/30 text-purple-300 hover:text-white"
                >
                  <AlertTriangle className={`w-3.5 h-3.5 ${contradictionsLoading ? 'animate-spin' : ''}`} />
                  <span>{contradictionsLoading ? 'Scanning...' : 'Re-scan Contradictions'}</span>
                </button>
                <button
                  type="button"
                  onClick={loadTimeline}
                  disabled={timelineLoading}
                  className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 border border-purple-500/30 text-purple-300 hover:text-white"
                >
                  <CalendarClock className={`w-3.5 h-3.5 ${timelineLoading ? 'animate-spin' : ''}`} />
                  <span>{timelineLoading ? 'Synthesizing...' : 'Rebuild Timeline'}</span>
                </button>
              </div>
            </div>

            {/* Quick suggested questions */}
            <div className="mt-4 pt-4 border-t border-dark-700/60 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-dark-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Suggested queries:
              </span>
              {[
                'Are there contradictions between suspect alibi and crime scene evidence?',
                'What weapons or physical artifacts were recovered?',
                'Reconstruct the timeline of events from the witnesses.',
                'What are the key charges under BNS 2023 for this offense?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setChatQuestion(suggestion);
                    handleAskQuestion(suggestion);
                  }}
                  className="px-2.5 py-1 rounded-full bg-dark-800 hover:bg-purple-900/40 text-dark-300 hover:text-purple-200 border border-dark-700 hover:border-purple-500/30 transition-all text-[11px]"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Interactive Query Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskQuestion();
              }}
              className="mt-4 flex gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  placeholder="Ask any question about this case (e.g. statement discrepancies, recovery memos, CCTV time delta)..."
                  className="w-full px-4 py-2.5 bg-dark-900 border border-purple-500/30 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-purple-400 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={chatLoading || !chatQuestion.trim()}
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-600/30 shrink-0"
              >
                {chatLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Ask AI</span>
              </button>
            </form>
          </div>

          {/* Chat History Q&A Results */}
          {chatHistory.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" /> Inquiry Answers ({chatHistory.length})
              </h3>
              <div className="space-y-3">
                {chatHistory.map((item, idx) => (
                  <div key={idx} className="glass-card p-5 border-dark-700/80 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-md bg-purple-600/20 text-purple-300 shrink-0 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                        <p className="font-semibold text-white text-sm">{item.q}</p>
                      </div>
                      {item.confidence && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                          Confidence: {item.confidence}
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-lg bg-dark-900/80 border border-purple-500/20 text-dark-200 text-sm leading-relaxed whitespace-pre-line">
                      {item.a}
                    </div>

                    {item.sources && item.sources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-dark-800 text-xs text-dark-400">
                        <span className="font-medium text-dark-300">Grounding Sources:</span>
                        {item.sources.map((src, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 rounded bg-dark-800 border border-dark-700 text-vault-300 font-mono text-[11px]">
                            {src}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contradictions & Discrepancies Detector */}
          <div className="glass-card p-6 border-amber-500/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" /> Statement Contradictions & Discrepancies Spotter
                </h3>
                <p className="text-xs text-dark-400 mt-0.5">
                  Automated conflict detection across victim reports, suspect statements, forensic logs, and witness testimonies.
                </p>
              </div>
              <button
                type="button"
                onClick={loadContradictions}
                disabled={contradictionsLoading}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${contradictionsLoading ? 'animate-spin' : ''}`} /> Refresh Checks
              </button>
            </div>

            {contradictionsLoading ? (
              <div className="p-8 text-center text-dark-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                Scanning case statements for discrepancies...
              </div>
            ) : contradictions && contradictions.length > 0 ? (
              <div className="space-y-3">
                {contradictions.map((c, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      c.severity === 'CRITICAL'
                        ? 'bg-red-950/30 border-red-500/40 text-red-200'
                        : c.severity === 'HIGH'
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                        : 'bg-dark-800 border-dark-700 text-dark-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            c.severity === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {c.severity} CONTRADICTION
                        </span>
                        <span className="text-xs font-semibold text-white">{c.type || 'Discrepancy'}</span>
                      </div>
                      <span className="text-[11px] font-mono text-dark-400">
                        Sources: {Array.isArray(c.sources) ? c.sources.join(' vs ') : 'Cross-examination'}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-white mt-2 leading-relaxed">
                      {c.description || c.statement_a + ' vs ' + c.statement_b}
                    </p>

                    {c.legal_relevance && (
                      <div className="mt-2 p-2.5 rounded-lg bg-dark-900/60 border border-dark-700/60 text-xs space-y-1">
                        <span className="font-semibold text-amber-300 block">Court Admissibility Note:</span>
                        <p className="text-dark-300">{c.legal_relevance}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">No Statement Contradictions Flagged</p>
                <p className="text-xs text-dark-400 mt-1">
                  Witness reports, suspect depositions, and seizure memos are currently corroborated by evidence logs.
                </p>
              </div>
            )}
          </div>

          {/* Chronological Crime Timeline */}
          <div className="glass-card p-6 border-blue-500/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-400" /> Chronological Crime Timeline
                </h3>
                <p className="text-xs text-dark-400 mt-0.5">
                  AI-synthesized chronology mapping incident progression from reported time to forensic verification.
                </p>
              </div>
              <button
                type="button"
                onClick={loadTimeline}
                disabled={timelineLoading}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${timelineLoading ? 'animate-spin' : ''}`} /> Refresh Timeline
              </button>
            </div>

            {timelineLoading ? (
              <div className="p-8 text-center text-dark-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
                Synthesizing chronological milestones...
              </div>
            ) : timeline && timeline.length > 0 ? (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-500/30">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-6 top-1.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-dark-900 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>

                    <div className="glass-card p-4 border-dark-700/80 hover:border-blue-500/40 transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400">
                          {event.time || event.timestamp || 'Milestone ' + (idx + 1)}
                        </span>
                        <div className="flex items-center gap-2">
                          {event.phase && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-dark-800 text-dark-300 border border-dark-700 font-semibold">
                              {event.phase}
                            </span>
                          )}
                          {event.confidence && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                              {event.confidence}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-sm font-medium text-white mt-1.5 leading-relaxed">
                        {event.event || event.description}
                      </p>

                      {event.evidence_source && (
                        <p className="text-xs text-dark-400 mt-2 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-vault-400" /> Grounded in: <span className="font-mono text-vault-300">{event.evidence_source}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-dark-400 text-xs">
                No timeline records synthesized yet. Click "Rebuild Timeline" above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: NATIONAL CCTNS / ICJS INTEGRATION */}
      {activeTab === 'integration' && (
        <div className="space-y-6">
          {/* Status Message Banner */}
          {syncActionMessage && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between ${
                syncActionMessage.type === 'success'
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/30 border-red-500/40 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {syncActionMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
                <span>{syncActionMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncActionMessage(null)}
                className="text-xs opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* Integration Header */}
          <div className="glass-card p-6 border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-dark-800 to-dark-900">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                <Network className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  National CCTNS & ICJS Judicial Adapters
                  <span className="px-2 py-0.5 rounded text-[11px] bg-blue-500/20 text-blue-300 font-mono">
                    MoHA / NCRB Standardized
                  </span>
                </h2>
                <p className="text-xs text-dark-300">
                  Direct interoperability with India's Crime and Criminal Tracking Network & Systems (CCTNS) and Inter-operable Criminal Justice System (ICJS).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CCTNS CAS Packet Card */}
            <div className="glass-card p-6 border-dark-700/80 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-blue-400 font-bold tracking-wider">
                    Ministry of Home Affairs • NCRB
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">CCTNS CAS Data Packet</h3>
                  <p className="text-xs text-dark-400 mt-0.5">
                    Standardized Integrated Investigation Form (IIF-I First Information & IIF-V Crime Detail) packet.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    caseData.cctns_synced
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {caseData.cctns_synced ? '✓ SYNCHRONIZED' : '● PENDING SYNC'}
                </span>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-dark-900/60 border border-dark-700/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-dark-400">Sync Reference ID:</span>
                  <span className="font-mono text-white font-semibold">{caseData.cctns_sync_id || 'Not Yet Synced'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Target Station Network:</span>
                  <span className="text-dark-200">DL-ND-CONNAUGHT-CAS-01</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Standard Schema:</span>
                  <span className="font-mono text-vault-300">NCRB CAS v4.2 JSON</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSyncCctns}
                  disabled={syncingCctns}
                  className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingCctns ? 'animate-spin' : ''}`} />
                  <span>{syncingCctns ? 'Synchronizing...' : caseData.cctns_synced ? 'Re-Sync CCTNS Packet' : 'Sync to National CCTNS'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleInspectCctns}
                  className="py-2 px-3 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white font-semibold text-xs border border-dark-700 transition-all flex items-center gap-1.5"
                >
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  <span>Inspect IIF</span>
                </button>
              </div>
            </div>

            {/* ICJS e-Court Dossier Card */}
            <div className="glass-card p-6 border-dark-700/80 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                    e-Courts Mission Mode Project
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">ICJS Judicial Dossier</h3>
                  <p className="text-xs text-dark-400 mt-0.5">
                    Inter-operable Criminal Justice System court docket transmission with blockchain cryptographic proof.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                    caseData.icjs_transmitted
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {caseData.icjs_transmitted ? '✓ TRANSMITTED' : '● STAGED FOR COURT'}
                </span>
              </div>

              <div className="space-y-2 p-3 rounded-lg bg-dark-900/60 border border-dark-700/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-dark-400">Judicial Docket Ref:</span>
                  <span className="font-mono text-white font-semibold">{caseData.icjs_docket_ref || 'Awaiting Court Filing'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Jurisdiction Court Code:</span>
                  <span className="text-dark-200">DL-HC-PATIALA-04</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Evidence Chain Proof:</span>
                  <span className="font-mono text-emerald-300">BSA Sec 63 Embedded</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTransmitIcjs}
                  disabled={transmittingIcjs}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50"
                >
                  <SendHorizontal className={`w-3.5 h-3.5 ${transmittingIcjs ? 'animate-spin' : ''}`} />
                  <span>{transmittingIcjs ? 'Transmitting...' : caseData.icjs_transmitted ? 'Re-Transmit to Court' : 'Transmit to ICJS Court'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleInspectIcjs}
                  className="py-2 px-3 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-200 hover:text-white font-semibold text-xs border border-dark-700 transition-all flex items-center gap-1.5"
                >
                  <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Inspect Docket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Payload Inspector Modal */}
      {inspectPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="glass-card p-6 w-full max-w-3xl border-dark-700 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-dark-700 pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-vault-400" />
                <h3 className="text-sm font-bold text-white">{inspectPayload.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectPayload(null)}
                className="text-dark-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-dark-950 p-4 rounded-xl border border-dark-800 font-mono text-xs text-dark-300">
              <pre>{JSON.stringify(inspectPayload.json, null, 2)}</pre>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-dark-700">
              <span className="text-xs text-dark-400">Standardized Interoperability Format compliant with MoHA guidelines.</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectPayload.json, null, 2));
                    alert('Copied standardized JSON payload to clipboard!');
                  }}
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Copy Payload JSON
                </button>
                <button
                  type="button"
                  onClick={() => setInspectPayload(null)}
                  className="btn-primary text-xs py-1.5 px-4"
                >
                  Close
                </button>
              </div>
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

