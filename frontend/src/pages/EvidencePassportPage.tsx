import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { evidenceApi, publicApi } from '../services/api';
import type { EvidencePassport, VerifyResult, NetworkInfo } from '../types';
import {
  Shield, ArrowLeft, CheckCircle, XCircle, RefreshCw, QrCode, Hash, Lock,
  Copy, Check, FileText, User, Calendar, Award, AlertTriangle, Layers,
  ExternalLink
} from 'lucide-react';


export default function EvidencePassportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [passport, setPassport] = useState<EvidencePassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);

  // Load network info to discover LAN IP
  useEffect(() => {
    publicApi.getNetworkInfo()
      .then((res) => setNetworkInfo(res.data))
      .catch((err) => console.log('Network info lookup:', err));
  }, []);

  const loadPassport = (targetHost?: string) => {
    if (!id) return;
    setLoading(true);
    evidenceApi.getPassport(parseInt(id), targetHost)
      .then((r) => setPassport(r.data))
      .catch((err) => {
        console.error(err);
        setErrorMsg(err.response?.data?.detail || 'Failed to load Evidence Passport');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const host = networkInfo?.lan_ip ? `${networkInfo.lan_ip}:5173` : undefined;
    loadPassport(host);
  }, [id, networkInfo?.lan_ip]);

  const handleVerify = async () => {
    if (!id) return;
    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await evidenceApi.verify(parseInt(id));
      setVerifyResult(res.data);
      const host = networkInfo?.lan_ip ? `${networkInfo.lan_ip}:5173` : undefined;
      const updated = await evidenceApi.getPassport(parseInt(id), host);
      setPassport(updated.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Verification request failed');
    } finally {
      setVerifying(false);
    }
  };


  const copyToClipboard = (text: string, type: 'hash' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-vault-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-dark-400 text-sm">Generating Cryptographic Evidence Passport...</p>
      </div>
    );
  }

  if (errorMsg && !passport) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/evidence')} className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Evidence Vault
        </button>
        <div className="glass-card p-8 text-center max-w-md mx-auto">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-2">Passport Unavailable</h2>
          <p className="text-sm text-dark-400">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (!passport) return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(`/evidence/${id}`)} className="flex items-center gap-2 text-dark-400 hover:text-dark-200 text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Evidence Details
        </button>

        <button
          onClick={handleVerify}
          disabled={verifying}
          className="btn-primary flex items-center gap-2 text-sm shadow-lg shadow-vault-600/20"
        >
          {verifying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Shield className="w-4 h-4" />
          )}
          {verifying ? 'Verifying Integrity...' : 'VERIFY INTEGRITY'}
        </button>
      </div>

      {/* Verification Results Banner */}
      {verifyResult && (
        <div className={`p-5 rounded-xl border transition-all ${verifyResult.status === 'VERIFIED'
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : 'bg-red-500/10 border-red-500/30'
          }`}>
          <div className="flex items-start gap-4">
            {verifyResult.status === 'VERIFIED' ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 className={`text-lg font-bold ${verifyResult.status === 'VERIFIED' ? 'text-emerald-400' : 'text-red-400'}`}>
                {verifyResult.status === 'VERIFIED' ? '✓ INTEGRITY VERIFIED' : '⚠ TAMPERING DETECTED'}
              </h3>
              <p className="text-sm text-dark-300 mt-1">{verifyResult.details}</p>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono bg-dark-900/60 p-3 rounded-lg border border-dark-700/50">
                <div>
                  <span className="text-dark-500 block">Stored Hash:</span>
                  <span className="text-vault-400 break-all">{verifyResult.stored_hash}</span>
                </div>
                <div>
                  <span className="text-dark-500 block">Computed Hash:</span>
                  <span className={verifyResult.hash_match ? 'text-emerald-400 break-all' : 'text-red-400 break-all'}>
                    {verifyResult.computed_hash}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Card Design */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-dark-800 via-dark-900 to-black border border-vault-500/30 shadow-2xl p-8">
        {/* Holographic lines decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-vault-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyber-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        {/* Passport Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-dark-700/60 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-vault-600/20 border border-vault-500/40 flex items-center justify-center shadow-lg shadow-vault-600/10">
              <Award className="w-8 h-8 text-vault-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-widest text-vault-400 uppercase">Official Digital Record</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-vault-600/20 text-vault-300 border border-vault-500/30">PASSPORT</span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-0.5">Evidence Passport</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border ${passport.integrity_status === 'VERIFIED'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : passport.integrity_status === 'TAMPERED'
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
              {passport.integrity_status === 'VERIFIED' ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : passport.integrity_status === 'TAMPERED' ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {passport.integrity_status}
            </span>

            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-dark-800 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              v{passport.current_version}
            </span>
          </div>
        </div>

        {/* Passport Grid Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-8">
          {/* Left Column: Essential Identifiers & Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Evidence ID */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium">Evidence ID</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-mono text-lg font-bold text-vault-400">{passport.evidence_id}</span>
                  <button
                    onClick={() => copyToClipboard(passport.evidence_id, 'id')}
                    className="p-1.5 rounded-lg bg-dark-700/50 hover:bg-dark-700 text-dark-300 transition-colors"
                    title="Copy Evidence ID"
                  >
                    {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Case ID / Case Number */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium">Case Number / Case ID</p>
                <p className="font-mono text-lg font-bold text-white mt-1">
                  {passport.case_number} <span className="text-xs text-dark-400 font-normal">(ID: #{passport.case_id})</span>
                </p>
              </div>

              {/* Original Filename */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50 md:col-span-2">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium">Original Filename</p>
                <p className="text-base font-semibold text-white mt-1 truncate flex items-center gap-2">
                  <FileText className="w-4 h-4 text-vault-400 flex-shrink-0" />
                  {passport.original_filename}
                </p>
              </div>

              {/* Document Type */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium">Document Type</p>
                <p className="text-sm font-semibold text-vault-300 mt-1">
                  {passport.document_type || passport.evidence_type}
                </p>
              </div>

              {/* File Size */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium">File Size</p>
                <p className="text-sm font-semibold text-white mt-1">
                  {(passport.file_size / (1024 * 1024)).toFixed(2)} MB ({passport.file_size.toLocaleString()} bytes)
                </p>
              </div>

              {/* Current Custodian */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-dark-400" /> Current Custodian
                </p>
                <p className="text-sm font-semibold text-white mt-1">{passport.current_custodian || 'Unassigned'}</p>
              </div>

              {/* Uploaded By */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-dark-400" /> Uploaded By
                </p>
                <p className="text-sm font-semibold text-white mt-1">{passport.uploaded_by || 'Investigator'}</p>
              </div>

              {/* Created Date */}
              <div className="bg-dark-800/40 p-4 rounded-xl border border-dark-700/50 md:col-span-2">
                <p className="text-xs uppercase tracking-wider text-dark-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-dark-400" /> Created / Registered Date
                </p>
                <p className="text-sm font-medium text-dark-200 mt-1">
                  {new Date(passport.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* SHA-256 Hash Display with Copy Button */}
            <div className="bg-dark-900/80 p-5 rounded-xl border border-vault-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-vault-400 flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-vault-400" /> Cryptographic SHA-256 Hash
                </span>
                <button
                  onClick={() => copyToClipboard(passport.sha256_hash, 'hash')}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-vault-600/20 hover:bg-vault-600/30 text-vault-400 border border-vault-500/40 text-xs transition-colors"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy SHA-256 Hash
                    </>
                  )}
                </button>
              </div>
              <p className="font-mono text-xs text-vault-300 break-all bg-black/40 p-3 rounded-lg border border-dark-700/80 tracking-wide select-all">
                {passport.sha256_hash}
              </p>
            </div>
          </div>

          {/* Right Column: QR Code & Security Stamp */}
          <div className="flex flex-col items-center justify-between bg-dark-800/30 p-6 rounded-xl border border-dark-700/50">
            <div className="text-center w-full">
              <p className="text-xs font-semibold uppercase tracking-wider text-dark-400 mb-3">
                Digital Verification QR Barcode
              </p>

              {/* Universal Network QR Code */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Universal Network QR Code</span>
              </div>

              {/* Scannable QR Code */}
              <div className="bg-white p-4 rounded-xl inline-block shadow-xl border-4 border-vault-600/30 mx-auto transition-transform hover:scale-105">
                {passport.qr_code ? (
                  <img
                    src={`data:image/png;base64,${passport.qr_code}`}
                    alt={`QR Code for ${passport.evidence_id}`}
                    className="w-48 h-48 mx-auto"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-dark-900 rounded-lg">
                    <QrCode className="w-16 h-16 text-dark-600" />
                  </div>
                )}
              </div>

              <p className="font-mono text-xs text-vault-400 mt-3 font-semibold">{passport.evidence_id}</p>

              <p className="text-[11px] text-emerald-400 font-medium mt-1">
                ✓ Scannable by Mobile Phone Camera or Any Device on Network
              </p>

              {/* Interactive Test Scan & Copy Buttons */}
              <div className="flex flex-col gap-2 mt-4 max-w-xs mx-auto">
                {passport.verification_url && (
                  <a
                    href={passport.verification_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-vault-600/20 hover:bg-vault-600/30 text-vault-300 hover:text-white border border-vault-500/40 text-xs font-semibold transition-all shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Test Scan / Open Verification</span>
                  </a>
                )}
                {passport.verification_url && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(passport.verification_url || '');
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 text-dark-300 hover:text-white text-[11px] border border-dark-700 transition-colors"
                  >
                    {copiedUrl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedUrl ? 'Verification URL Copied' : 'Copy Scannable URL'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full mt-6 pt-6 border-t border-dark-700/50 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-dark-500">Blockchain Ledger:</span>
                <span className="text-cyan-400 font-mono font-medium">{passport.blockchain_status || 'ANCHORED'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-dark-500">Custody Transfers:</span>
                <span className="text-white font-medium">{passport.custody_count ?? passport.custody_event_count ?? 1} recorded events</span>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 text-emerald-400 text-xs font-medium">
                <Lock className="w-4 h-4" />
                <span>Fernet Symmetric Encrypted</span>
              </div>
            </div>
          </div>

        </div>

        {/* Passport Footer Stamp */}
        <div className="pt-6 border-t border-dark-700/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-dark-500">
          <p>EvidenceVault Security System • Immutable Chain of Custody Protected</p>
          <p className="font-mono text-dark-600">CERTIFICATE ID: EV-CERT-{passport.evidence_id}</p>
        </div>
      </div>
    </div>
  );
}
