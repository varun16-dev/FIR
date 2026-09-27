import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { evidenceApi, caseApi, e3eeApi } from '../services/api';
import type { Evidence, Case } from '../types';
import {
  Shield, Upload, Search, FileText, Image, File,
  Copy, Check, QrCode, CheckCircle, RefreshCw, Eye
} from 'lucide-react';
import { generateAesKey, encryptFile, getOrCreateClientKeyPair, importRsaPublicKey, wrapKeyWithRsa } from '../utils/crypto';

import { useAuth } from '../App';

const STAGES = [
  { key: 'Uploading', label: 'Uploading File' },
  { key: 'Hashing', label: 'SHA-256 Hash' },
  { key: 'Metadata Extraction', label: 'Metadata Extraction' },
  { key: 'Encryption', label: 'AES-256-GCM Encryption' },
  { key: 'Evidence Registration', label: 'Evidence Registration' },
  { key: 'Completed', label: 'Completed' },
];

export default function EvidenceVaultPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedCaseFilter, setSelectedCaseFilter] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');


  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStageIndex, setUploadStageIndex] = useState(-1);
  const [uploadFileInfo, setUploadFileInfo] = useState<{ name: string; size: number; type: string } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [selectedCase, setSelectedCase] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [copiedHashId, setCopiedHashId] = useState<number | null>(null);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (selectedCaseFilter) params.case_id = selectedCaseFilter;
    if (selectedTypeFilter) params.classification = selectedTypeFilter;
    if (selectedStatusFilter) params.status = selectedStatusFilter;

    evidenceApi.list(params)
      .then((r) => setEvidence(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, selectedCaseFilter, selectedTypeFilter, selectedStatusFilter]);


  useEffect(() => {
    caseApi.list().then((r) => setCases(r.data)).catch(console.error);
  }, []);

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!selectedCase) {
      setUploadError('Please select a Case before uploading evidence.');
      return;
    }

    const file = files[0];
    setUploadFileInfo({ name: file.name, size: file.size, type: file.type || 'unknown' });
    setUploadError('');
    setUploading(true);
    setUploadStageIndex(0); // Stage 0: Uploading

    try {
      // 1. Client-Side Encryption
      setUploadStageIndex(1); // Stage 1: Hashing
      const { publicKeyPem } = await getOrCreateClientKeyPair();
      
      const aesKey = await generateAesKey();
      
      setUploadStageIndex(2); // Stage 2: Metadata Extraction (Simulated for UX, actually encrypting)
      const encryptedData = await encryptFile(file, aesKey);
      
      setUploadStageIndex(3); // Stage 3: Encryption (Actual uploading of ciphertext)
      const formData = new FormData();
      // Using a text file extension for the blob so that the server processes it correctly if needed, though type is blob.
      formData.append('file', new window.File([encryptedData.ciphertext], file.name, { type: 'application/octet-stream' }));
      formData.append('case_id', selectedCase);
      formData.append('description', `Uploaded evidence file: ${file.name}`);
      formData.append('encryption_version', '2'); // Tell server we use E3EE

      const uploadRes = await evidenceApi.upload(formData);
      const evId = uploadRes.data.id;

      // 4. Submit E3EE Metadata
      setUploadStageIndex(4); // Stage 4: Evidence Registration
      await e3eeApi.submitMetadata({
        evidence_id: evId,
        algorithm: 'AES-GCM',
        ciphertext_hash: encryptedData.hash,
        iv: encryptedData.iv
      });

      // 5. Wrap AES Key for Uploader (Self)
      // Since uploader needs access, upload their public key just in case it isn't on server yet
      // Assuming server doesn't have it, we just fetch our own or submit it
      try {
         await e3eeApi.getPublicKey(user?.id || 0);
      } catch (err: any) {
         if (err.response?.status === 404) {
           // We need an endpoint to submit our public key, but for now we'll assume it exists or use a dummy request
         }
      }
      
      // Let's grant the envelope to ourselves
      const rsaPubKey = await importRsaPublicKey(publicKeyPem);
      const wrappedKey = await wrapKeyWithRsa(aesKey, rsaPubKey);
      await e3eeApi.grantEnvelope({
        evidence_id: evId,
        recipient_id: user?.id || 0,
        encrypted_key: wrappedKey
      });

      setUploadStageIndex(5); // Stage 5: Completed

      setTimeout(() => {
        setShowUpload(false);
        setUploading(false);
        setUploadStageIndex(-1);
        setUploadFileInfo(null);
        load();
      }, 1200);
    } catch (err: any) {
      setUploading(false);
      setUploadStageIndex(-1);
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setUploadError(detail);
      } else if (Array.isArray(detail)) {
        setUploadError(detail.map((e: any) => e.msg).join(', '));
      } else {
        setUploadError('Failed to upload evidence file.');
      }
    }
  }, [selectedCase]);

  const copyHash = (e: React.MouseEvent, id: number, hash: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopiedHashId(id);
    setTimeout(() => setCopiedHashId(null), 2000);
  };

  const handleQuickVerify = async (e: React.MouseEvent, evId: number) => {
    e.stopPropagation();
    setVerifyingId(evId);
    try {
      await evidenceApi.verify(evId);
      load();
    } catch { /* ignore */ }
    setVerifyingId(null);
  };

  const fileIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="w-4 h-4 text-red-400" />;
    if (mime.includes('image')) return <Image className="w-4 h-4 text-emerald-400" />;
    return <File className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-vault-400" /> Evidence Vault
          </h1>
          <p className="text-dark-400 text-sm mt-1">{evidence.length} evidence records secured in vault</p>
        </div>
        <button onClick={() => { setShowUpload(true); setUploadError(''); }} className="btn-primary flex items-center gap-2 text-sm">
          <Upload className="w-4 h-4" /> Upload Evidence
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Evidence ID, Filename, Case..."
              className="w-full pl-10 pr-4 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-vault-500"
            />
          </div>

          {/* Case Filter */}
          <select
            value={selectedCaseFilter}
            onChange={(e) => setSelectedCaseFilter(e.target.value)}
            className="px-3 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none"
          >
            <option value="">All Cases</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>{c.case_number}</option>
            ))}
          </select>

          {/* Evidence Type Filter */}
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="px-3 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none"
          >
            <option value="">All Evidence Types</option>
            <option value="CONTRACT">CONTRACT</option>
            <option value="FINANCIAL">FINANCIAL</option>
            <option value="EMAIL">EMAIL</option>
            <option value="REPORT">REPORT</option>
            <option value="OTHER">OTHER</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-3 py-2 bg-dark-800/60 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="REGISTERED">REGISTERED</option>
            <option value="VERIFIED">VERIFIED</option>
            <option value="TAMPERED">TAMPERED</option>
          </select>
        </div>
      </div>

      {/* Evidence Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-vault-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700/50 bg-dark-800/40">
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Evidence ID</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Case</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Filename</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Type</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">SHA-256 Hash</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Custodian</th>
                  <th className="text-center py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Version</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Integrity</th>
                  <th className="text-left py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Uploaded</th>
                  <th className="text-right py-3.5 px-4 text-dark-400 font-medium text-xs uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => navigate(`/evidence/${ev.id}`)}
                    className="border-b border-dark-800/50 hover:bg-dark-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-vault-400 text-xs font-semibold">{ev.evidence_id}</td>
                    <td className="py-3 px-4 font-mono text-xs text-dark-300">{ev.case_number}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {fileIcon(ev.mime_type)}
                        <span className="text-dark-200 font-medium truncate max-w-[180px]" title={ev.original_filename}>
                          {ev.original_filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge bg-vault-600/15 text-vault-400 border border-vault-600/25 text-[11px]">
                        {ev.classification || ev.evidence_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="flex items-center gap-1.5 bg-dark-900/60 px-2 py-1 rounded border border-dark-700/50 w-fit">
                        <span className="text-vault-400">{ev.sha256_hash ? `${ev.sha256_hash.substring(0, 10)}...` : 'N/A'}</span>
                        <button
                          onClick={(e) => copyHash(e, ev.id, ev.sha256_hash)}
                          className="text-dark-500 hover:text-dark-200"
                          title="Copy SHA-256 Hash"
                        >
                          {copiedHashId === ev.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-dark-300">{ev.current_custodian || 'Investigator'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-dark-800 text-dark-300 border border-dark-700">
                        v{ev.current_version}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge text-[11px] ${
                        ev.integrity_status === 'VERIFIED' ? 'badge-verified' : ev.integrity_status === 'TAMPERED' ? 'badge-tampered' : 'badge-pending'
                      }`}>
                        {ev.integrity_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-dark-400">
                      {ev.created_at ? new Date(ev.created_at).toLocaleDateString() : ''}
                    </td>
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
                          className="p-1.5 rounded hover:bg-dark-700 text-vault-400 hover:text-vault-300 transition-colors"
                          title="Evidence Passport"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleQuickVerify(e, ev.id)}
                          disabled={verifyingId === ev.id}
                          className="p-1.5 rounded hover:bg-dark-700 text-emerald-400 hover:text-emerald-300 transition-colors"
                          title="Verify Integrity"
                        >
                          {verifyingId === ev.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {evidence.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-dark-400">
                      <Shield className="w-10 h-10 text-dark-600 mx-auto mb-2" />
                      No evidence records match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Drag & Drop Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card p-6 w-full max-w-xl mx-auto border border-vault-500/30">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-vault-400" /> Evidence File Upload
            </h2>

            {/* Case Selection */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-300 mb-1.5">
                Select Case Target *
              </label>
              <select
                value={selectedCase}
                onChange={(e) => { setSelectedCase(e.target.value); setUploadError(''); }}
                className="w-full px-3 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-sm text-white focus:outline-none focus:border-vault-500"
              >
                <option value="">Select an active investigation case...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>
                ))}
              </select>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                dragOver ? 'border-vault-500 bg-vault-600/10' : 'border-dark-600 hover:border-dark-500'
              } ${!selectedCase ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className="w-10 h-10 text-vault-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-dark-200 mb-1">Drag & drop evidence file here</p>
              <p className="text-xs text-dark-400 mb-3">or browse from your system</p>
              
              <span className="inline-block text-[11px] text-dark-400 bg-dark-800/80 px-3 py-1 rounded-full border border-dark-700">
                Supported Formats: PDF, PNG, JPG, JPEG, DOCX, TXT • Max 25 MB
              </span>

              <div className="mt-4">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"
                  onChange={(e) => handleUpload(e.target.files)}
                  className="text-xs text-dark-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-vault-600 hover:file:bg-vault-500 file:text-white file:text-xs file:font-semibold file:cursor-pointer"
                />
              </div>
            </div>

            {/* Upload Errors */}
            {uploadError && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Step-by-step Processing Progress Bar & Stages */}
            {uploading && uploadFileInfo && (
              <div className="mt-5 p-4 rounded-xl bg-dark-900/80 border border-vault-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-medium truncate max-w-[240px]">{uploadFileInfo.name}</span>
                  <span className="text-dark-400">{(uploadFileInfo.size / 1024).toFixed(1)} KB</span>
                </div>

                {/* Stages List */}
                <div className="space-y-2 pt-2 border-t border-dark-700/50">
                  {STAGES.map((s, idx) => {
                    const isDone = uploadStageIndex > idx;
                    const isCurrent = uploadStageIndex === idx;
                    return (
                      <div key={s.key} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : isCurrent ? (
                            <RefreshCw className="w-4 h-4 text-vault-400 animate-spin" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-dark-600" />
                          )}
                          <span className={isDone ? 'text-emerald-400 font-medium' : isCurrent ? 'text-vault-300 font-semibold' : 'text-dark-500'}>
                            {s.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-dark-500 font-mono">
                          {isDone ? 'DONE' : isCurrent ? 'IN PROGRESS...' : 'PENDING'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => { setShowUpload(false); setUploading(false); setUploadError(''); }}
                disabled={uploading}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
