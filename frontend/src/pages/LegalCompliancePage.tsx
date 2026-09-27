import { useState, useEffect } from 'react';
import { legalApi, caseApi, evidenceApi } from '../services/api';
import {
  Scale, FileText, ShieldAlert, Download, Search, CheckCircle2,
  Copy, Check, Lock, ArrowRight, BookOpen, RefreshCw
} from 'lucide-react';

export default function LegalCompliancePage() {
  const [activeTab, setActiveTab] = useState<'mapper' | 'scanner' | 'bsa' | 'dpdp'>('mapper');

  // Tab 1: Mapper State
  const [searchQuery, setSearchQuery] = useState('');
  const [lawType, setLawType] = useState('all');
  const [mappingData, setMappingData] = useState<any>(null);
  const [loadingMapper, setLoadingMapper] = useState(false);

  // Tab 2: Scanner State
  const [scannerText, setScannerText] = useState(
    'The accused Manoj Tyagi and accomplice were named under Section 302, 307, 34 and 420 for conspiracy, cheating and lethal attack using dangerous weapons near the market complex.'
  );
  const [scannerResults, setScannerResults] = useState<any>(null);
  const [loadingScanner, setLoadingScanner] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Tab 3: Section 63 Certificate State
  const [cases, setCases] = useState<any[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>('');
  const [bsaCertData, setBsaCertData] = useState<any>(null);
  const [loadingCert, setLoadingCert] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [downloadingDossier, setDownloadingDossier] = useState(false);

  // Tab 4: DPDP Redactor State
  const [dpdpInputText, setDpdpInputText] = useState(
    'Complainant Sunita Sharma (Aadhaar: 4921 8291 0023, Mobile: 9811234567, Email: sunita.sharma@gov.in, PAN: ABCDE1234F) reported that her jewelry was stolen from her residence at Flat 204, Rohini.'
  );
  const [victimNamesInput, setVictimNamesInput] = useState('Sunita Sharma');
  const [dpdpResult, setDpdpResult] = useState<any>(null);
  const [loadingDpdp, setLoadingDpdp] = useState(false);
  const [downloadingDpdpCase, setDownloadingDpdpCase] = useState(false);

  // Fetch initial mapping
  const fetchMapping = async (q = '', type = 'all') => {
    try {
      setLoadingMapper(true);
      const res = await legalApi.searchBns(q, type);
      setMappingData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMapper(false);
    }
  };

  useEffect(() => {
    fetchMapping(searchQuery, lawType);
  }, [lawType]);

  // Load cases for Certificate tab
  useEffect(() => {
    caseApi.list().then((res) => {
      const caseItems = res.data.cases || res.data || [];
      setCases(caseItems);
      if (caseItems.length > 0) {
        setSelectedCaseId(caseItems[0].id);
      }
    }).catch(console.error);
  }, []);

  // When selected case changes, fetch its evidence
  useEffect(() => {
    if (!selectedCaseId) return;
    evidenceApi.getCaseEvidence(selectedCaseId).then((res) => {
      const items = res.data.evidence || res.data || [];
      setEvidenceList(items);
      if (items.length > 0) {
        setSelectedEvidenceId(items[0].evidence_id);
      } else {
        setSelectedEvidenceId('');
        setBsaCertData(null);
      }
    }).catch(console.error);
  }, [selectedCaseId]);

  // When selected evidence changes, fetch BSA Section 63 cert preview
  useEffect(() => {
    if (!selectedEvidenceId) return;
    setLoadingCert(true);
    legalApi.getBsaCert(selectedEvidenceId).then((res) => {
      setBsaCertData(res.data);
    }).catch(() => {
      setBsaCertData(null);
    }).finally(() => {
      setLoadingCert(false);
    });
  }, [selectedEvidenceId]);

  // Scan text for criminal sections
  const handleAnalyzeCharges = async () => {
    if (!scannerText.trim()) return;
    try {
      setLoadingScanner(true);
      const res = await legalApi.analyzeCharges(scannerText);
      setScannerResults(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingScanner(false);
    }
  };

  // Run initial charge analysis
  useEffect(() => {
    handleAnalyzeCharges();
  }, []);

  // Download BSA certificate PDF
  const handleDownloadBsaCertPdf = async () => {
    if (!selectedEvidenceId) return;
    try {
      setDownloadingCert(true);
      const res = await legalApi.downloadBsaCertPdf(selectedEvidenceId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BSA_Section_63_Cert_${selectedEvidenceId}.pdf`;
      link.click();
    } catch (e) {
      console.error('Failed to download BSA PDF:', e);
    } finally {
      setDownloadingCert(false);
    }
  };

  // Download full case Section 63 dossier PDF
  const handleDownloadCaseDossier = async () => {
    if (!selectedCaseId) return;
    try {
      setDownloadingDossier(true);
      const res = await legalApi.downloadCaseBsaDossierPdf(selectedCaseId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Case_${selectedCaseId}_BSA_Section_63_Dossier.pdf`;
      link.click();
    } catch (e) {
      console.error('Failed to download case dossier:', e);
    } finally {
      setDownloadingDossier(false);
    }
  };

  // Run DPDP redaction
  const handleRedactDpdp = async () => {
    if (!dpdpInputText.trim()) return;
    try {
      setLoadingDpdp(true);
      const victimList = victimNamesInput.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await legalApi.redactTextDpdp(dpdpInputText, victimList, 'PARTIAL');
      setDpdpResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDpdp(false);
    }
  };

  useEffect(() => {
    handleRedactDpdp();
  }, []);

  // Download sanitized case PDF
  const handleDownloadSanitizedCasePdf = async () => {
    if (!selectedCaseId) return;
    try {
      setDownloadingDpdpCase(true);
      const res = await legalApi.downloadSanitizedCasePdf(selectedCaseId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DPDP_Sanitized_Public_FIR_Case_${selectedCaseId}.pdf`;
      link.click();
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingDpdpCase(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-dark-700/60">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-vault-600/20 text-vault-400 rounded-xl border border-vault-500/30">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">New Criminal Laws & Statutory Compliance</h1>
              <p className="text-xs text-dark-400 mt-0.5">
                Bharatiya Sakshya Adhiniyam (BSA 2023 Sec. 63) • Bharatiya Nyaya Sanhita (BNS) • DPDP Act 2023 PII Redaction
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Badges */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            BSA 2023 Effective: 1 July 2024
          </span>
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            DPDP Act Compliant
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-dark-700/60 gap-2">
        <button
          onClick={() => setActiveTab('mapper')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'mapper'
              ? 'border-vault-500 text-vault-400 bg-vault-500/10 rounded-t-lg'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          BNS / BNSS / BSA Legal Mapper
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'scanner'
              ? 'border-vault-500 text-vault-400 bg-vault-500/10 rounded-t-lg'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <Search className="w-4 h-4" />
          FIR / Charge Sheet Section Scanner
        </button>
        <button
          onClick={() => setActiveTab('bsa')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'bsa'
              ? 'border-vault-500 text-vault-400 bg-vault-500/10 rounded-t-lg'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Section 63 BSA Certificates (Replaces 65B)
        </button>
        <button
          onClick={() => setActiveTab('dpdp')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'dpdp'
              ? 'border-vault-500 text-vault-400 bg-vault-500/10 rounded-t-lg'
              : 'border-transparent text-dark-400 hover:text-dark-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Automated PII Redaction (DPDP Act)
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BNS / BNSS / BSA Legal Mapper */}
      {/* ========================================================================= */}
      {activeTab === 'mapper' && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="glass-card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
              <input
                type="text"
                placeholder="Search by IPC section (e.g. 302), BNS section (e.g. 103), or offense name (e.g. Murder, Theft)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchMapping(e.target.value, lawType);
                }}
                className="w-full pl-9 pr-4 py-2 bg-dark-900/60 border border-dark-700 rounded-lg text-sm text-dark-200 placeholder-dark-500 focus:outline-none focus:border-vault-600"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              {[
                { id: 'all', label: 'All Modern Laws' },
                { id: 'bns', label: 'IPC ➔ BNS (Penal)' },
                { id: 'bnss', label: 'CrPC ➔ BNSS (Procedure)' },
                { id: 'bsa', label: 'IEA ➔ BSA (Evidence)' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLawType(f.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    lawType === f.id
                      ? 'bg-vault-600 text-white'
                      : 'bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-dark-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Results Grid */}
          {loadingMapper ? (
            <div className="text-center py-12 text-vault-400">Loading statutory databases...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* BNS Matches */}
              {mappingData?.bns_matches?.map((m: any, idx: number) => (
                <div key={idx} className="glass-card p-4 hover:border-vault-500/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {m.category}
                      </span>
                      <div className="flex gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.cognizable ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {m.cognizable ? 'Cognizable' : 'Non-Cognizable'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${m.bailable ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                          {m.bailable ? 'Bailable' : 'Non-Bailable'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-dark-100 mb-3">{m.title}</h3>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-dark-900/60 border border-dark-700/60 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Repealed Law</span>
                        <span className="text-sm font-mono font-bold text-red-400">IPC {m.ipc}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-dark-500" />
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-vault-400 font-semibold block">Modern Enactment</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">BNS {m.bns}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(`Section ${m.bns} Bharatiya Nyaya Sanhita, 2023`, `bns-${idx}`)}
                    className="w-full py-1.5 px-2 bg-dark-800 hover:bg-dark-700 text-xs font-medium text-dark-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSection === `bns-${idx}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy BNS Section for Chargesheet</span>
                      </>
                    )}
                  </button>
                </div>
              ))}

              {/* BNSS Matches */}
              {mappingData?.bnss_matches?.map((m: any, idx: number) => (
                <div key={idx} className="glass-card p-4 hover:border-purple-500/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {m.scope}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-dark-800 text-dark-300 font-mono">
                        BNSS 2023
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-dark-100 mb-3">{m.title}</h3>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-dark-900/60 border border-dark-700/60 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Repealed CrPC</span>
                        <span className="text-sm font-mono font-bold text-red-400">CrPC {m.crpc}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-dark-500" />
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block">Modern BNSS</span>
                        <span className="text-sm font-mono font-bold text-purple-300">BNSS {m.bnss}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(`Section ${m.bnss} Bharatiya Nagarik Suraksha Sanhita, 2023`, `bnss-${idx}`)}
                    className="w-full py-1.5 px-2 bg-dark-800 hover:bg-dark-700 text-xs font-medium text-dark-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSection === `bnss-${idx}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy BNSS Citation</span>
                      </>
                    )}
                  </button>
                </div>
              ))}

              {/* BSA Matches */}
              {mappingData?.bsa_matches?.map((m: any, idx: number) => (
                <div key={idx} className="glass-card p-4 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {m.schedule}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-dark-800 text-dark-300 font-mono">
                        BSA 2023
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-dark-100 mb-3">{m.title}</h3>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-dark-900/60 border border-dark-700/60 mb-3">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-dark-400 block">Repealed IEA 1872</span>
                        <span className="text-sm font-mono font-bold text-red-400">IEA {m.iea}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-dark-500" />
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-semibold block">Modern BSA 2023</span>
                        <span className="text-sm font-mono font-bold text-emerald-300">BSA {m.bsa}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(`Section ${m.bsa} Bharatiya Sakshya Adhiniyam, 2023`, `bsa-${idx}`)}
                    className="w-full py-1.5 px-2 bg-dark-800 hover:bg-dark-700 text-xs font-medium text-dark-300 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedSection === `bsa-${idx}` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy BSA Citation</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FIR & Charge Sheet Section Scanner */}
      {/* ========================================================================= */}
      {activeTab === 'scanner' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-dark-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-vault-400" />
                FIR Narrative / Police Report Section Scanner
              </h2>
              <span className="text-xs text-dark-400 font-mono">BNS Transition Scanner</span>
            </div>

            <p className="text-xs text-dark-400">
              Paste witness statements, case diary excerpts, or preliminary FIR draft text below. The AI scanner automatically detects cited Indian Penal Code sections and maps them to their mandatory modern Bharatiya Nyaya Sanhita equivalents.
            </p>

            <textarea
              rows={8}
              value={scannerText}
              onChange={(e) => setScannerText(e.target.value)}
              className="w-full p-3 bg-dark-900/60 border border-dark-700 rounded-lg text-xs text-dark-200 font-mono focus:outline-none focus:border-vault-500 leading-relaxed"
              placeholder="Paste text containing references like Sec 302, 307, 420..."
            />

            <button
              onClick={handleAnalyzeCharges}
              disabled={loadingScanner}
              className="w-full py-2.5 bg-vault-600 hover:bg-vault-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-vault-600/20"
            >
              <RefreshCw className={`w-4 h-4 ${loadingScanner ? 'animate-spin' : ''}`} />
              {loadingScanner ? 'Analyzing Criminal Sections...' : 'Scan & Auto-Map to BNS 2023'}
            </button>
          </div>

          {/* Results Panel */}
          <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-dark-100">
                  Detected Criminal Charges ({scannerResults?.detected_count || 0})
                </h3>
                <span className="text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Ready for Charge Sheet
                </span>
              </div>

              {scannerResults?.conversions?.length === 0 ? (
                <div className="text-center py-12 text-dark-400 text-xs">
                  No recognized IPC sections detected in pasted text.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {scannerResults?.conversions?.map((c: any, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-dark-900/60 border border-dark-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono line-through text-red-400">{c.detected_ipc_section}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-dark-500" />
                          <span className="text-xs font-mono font-bold text-emerald-400">{c.new_bns_section}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${c.cognizable ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {c.cognizable ? 'Cognizable' : 'Non-Cognizable'}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${c.bailable ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                            {c.bailable ? 'Bailable' : 'Non-Bailable'}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-dark-200">{c.offense_title}</p>
                      <p className="text-[11px] text-dark-400 italic">{c.advisory}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {scannerResults && (
              <div className="p-3 rounded-lg bg-vault-600/10 border border-vault-500/20 text-xs text-vault-300">
                <span className="font-bold block mb-1">Court Submission Advisory:</span>
                Under BNSS Section 193, judicial magistrates require formal transition references. Ensure your police final report quotes both the historical reference and primary BNS section.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: Section 63 BSA Certificates (Replaces 65B) */}
      {/* ========================================================================= */}
      {activeTab === 'bsa' && (
        <div className="space-y-6">
          {/* Case & Evidence Selector Bar */}
          <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
              <div className="w-full sm:w-64">
                <label className="text-[10px] uppercase font-bold tracking-wider text-dark-400 block mb-1">
                  Select Investigation Case:
                </label>
                <select
                  value={selectedCaseId || ''}
                  onChange={(e) => setSelectedCaseId(Number(e.target.value))}
                  className="w-full p-2 bg-dark-900 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-vault-500"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.case_number} — {c.title.slice(0, 32)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-64">
                <label className="text-[10px] uppercase font-bold tracking-wider text-dark-400 block mb-1">
                  Select Electronic Exhibit:
                </label>
                <select
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  disabled={evidenceList.length === 0}
                  className="w-full p-2 bg-dark-900 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-vault-500 disabled:opacity-50"
                >
                  {evidenceList.map((ev) => (
                    <option key={ev.id} value={ev.evidence_id}>
                      {ev.evidence_id} — {ev.original_filename.slice(0, 24)}
                    </option>
                  ))}
                  {evidenceList.length === 0 && (
                    <option value="">No evidence items uploaded</option>
                  )}
                </select>
              </div>
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2 w-full md:w-auto justify-end">
              <button
                onClick={handleDownloadBsaCertPdf}
                disabled={!selectedEvidenceId || downloadingCert}
                className="px-4 py-2 bg-vault-600 hover:bg-vault-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-vault-600/20"
              >
                <Download className={`w-3.5 h-3.5 ${downloadingCert ? 'animate-bounce' : ''}`} />
                {downloadingCert ? 'Generating...' : 'Download Section 63 PDF'}
              </button>
              <button
                onClick={handleDownloadCaseDossier}
                disabled={!selectedCaseId || downloadingDossier}
                className="px-4 py-2 bg-dark-800 hover:bg-dark-700 border border-dark-600 text-dark-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingDossier ? 'Building Dossier...' : 'Download Case Dossier PDF'}
              </button>
            </div>
          </div>

          {/* Certificate Live Preview */}
          {loadingCert ? (
            <div className="text-center py-12 text-vault-400">Loading statutory Section 63 certificate...</div>
          ) : bsaCertData ? (
            <div className="glass-card p-6 space-y-6 max-w-4xl mx-auto border-vault-500/40 shadow-2xl">
              {/* Emblem / Court Header */}
              <div className="text-center space-y-1 pb-4 border-b border-dark-700">
                <span className="text-[10px] font-mono uppercase tracking-widest text-dark-400 block font-bold">
                  Government of India • Directorate of Forensic Services
                </span>
                <h2 className="text-base font-bold text-white tracking-wide">
                  CERTIFICATE UNDER SECTION 63(4) OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023
                </h2>
                <p className="text-xs text-vault-400">
                  Mandatory Statutory Certificate for Admissibility of Electronic Records in Judicial Proceedings
                </p>
                <p className="text-[11px] text-dark-500 font-mono">
                  (Repeals and Replaces Section 65B of Indian Evidence Act, 1872)
                </p>
              </div>

              {/* Identification Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 rounded-lg bg-dark-900/60 border border-dark-700 text-xs">
                <div>
                  <span className="text-dark-400 text-[10px] block">Certificate Ref:</span>
                  <span className="font-mono font-bold text-vault-300">{bsaCertData.certificate_id}</span>
                </div>
                <div>
                  <span className="text-dark-400 text-[10px] block">Case Number:</span>
                  <span className="font-mono font-bold text-dark-200">{bsaCertData.case.case_number}</span>
                </div>
                <div>
                  <span className="text-dark-400 text-[10px] block">Issued At:</span>
                  <span className="text-dark-200">{bsaCertData.generated_at}</span>
                </div>
                <div>
                  <span className="text-dark-400 text-[10px] block">Admissibility:</span>
                  <span className="text-emerald-400 font-semibold">VERIFIED & COMPLIANT</span>
                </div>
              </div>

              {/* Part 1: Artifact & Hash Identification */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-vault-400">
                  Part I: Identification of Electronic Record & Cryptographic Hash
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg bg-dark-900/40 border border-dark-700/60 text-xs">
                  <div>
                    <span className="text-dark-400 block text-[10px]">Evidence Item:</span>
                    <span className="font-mono text-dark-200 font-bold">{bsaCertData.evidence.evidence_id} ({bsaCertData.evidence.original_filename})</span>
                  </div>
                  <div>
                    <span className="text-dark-400 block text-[10px]">File Size:</span>
                    <span className="text-dark-200">{bsaCertData.evidence.file_size_bytes} bytes ({bsaCertData.evidence.file_type})</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-dark-400 block text-[10px]">Cryptographic SHA-256 Digest:</span>
                    <span className="font-mono text-[11px] text-emerald-400 bg-dark-950 px-2 py-1 rounded block overflow-x-auto">
                      {bsaCertData.evidence.sha256_hash}
                    </span>
                  </div>
                  <div>
                    <span className="text-dark-400 block text-[10px]">Blockchain Ledger Anchor:</span>
                    <span className="text-dark-200 font-mono">Block #{bsaCertData.cryptographic_anchoring.block_index} (Immutable)</span>
                  </div>
                  <div>
                    <span className="text-dark-400 block text-[10px]">Chain Block Digest:</span>
                    <span className="text-dark-400 font-mono text-[10px]">{bsaCertData.cryptographic_anchoring.block_hash.slice(0, 28)}...</span>
                  </div>
                </div>
              </div>

              {/* Part 2: Statutory Declaration */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-vault-400">
                  Part II: Solemn Declaration of Lawful Control (Section 63(4))
                </h4>
                <div className="p-3.5 rounded-lg bg-dark-900/80 border border-dark-700 text-xs leading-relaxed text-dark-300 font-serif italic">
                  "{bsaCertData.statutory_declaration}"
                </div>
              </div>

              {/* Part 3: Signatures */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3 rounded-lg border border-dark-700 bg-dark-900/40 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider block">Certifying Officer:</span>
                  <p className="font-bold text-dark-100">{bsaCertData.certifying_officer.name}</p>
                  <p className="text-dark-400">{bsaCertData.certifying_officer.role}</p>
                  <p className="text-dark-400">Badge: {bsaCertData.certifying_officer.badge_number}</p>
                </div>
                <div className="p-3 rounded-lg border border-vault-500/30 bg-vault-600/5 text-xs space-y-1 text-right">
                  <span className="text-[10px] font-bold text-vault-400 uppercase tracking-wider block">Court Admissibility Seal:</span>
                  <p className="font-bold text-white">CRYPTOGRAPHICALLY SIGNED</p>
                  <p className="text-dark-400">Ref: {bsaCertData.certificate_id}</p>
                  <p className="text-emerald-400 text-[10px]">Valid under Bharatiya Sakshya Adhiniyam, 2023</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center text-dark-400 text-xs">
              Select a case and electronic exhibit above to preview court-mandated Section 63 Certificate.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: Automated PII Redaction (DPDP Act) */}
      {/* ========================================================================= */}
      {activeTab === 'dpdp' && (
        <div className="space-y-6">
          <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-400" />
                Digital Personal Data Protection Act (DPDP Act 2023) Auto-Masking
              </h3>
              <p className="text-xs text-dark-400 mt-0.5">
                Automatically masks victim identities, Aadhaar numbers, phone numbers, and addresses before public or media release.
              </p>
            </div>
            <button
              onClick={handleDownloadSanitizedCasePdf}
              disabled={!selectedCaseId || downloadingDpdpCase}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Download className={`w-3.5 h-3.5 ${downloadingDpdpCase ? 'animate-bounce' : ''}`} />
              {downloadingDpdpCase ? 'Sanitizing Case...' : 'Download Public Media FIR (PDF)'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Side */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-dark-200 uppercase tracking-wider">
                  Raw Incident Record / Text
                </h4>
                <span className="text-[10px] text-dark-400">Unredacted Police Copy</span>
              </div>

              <div>
                <label className="text-[10px] text-dark-400 uppercase tracking-wider block mb-1">
                  Protected Victim / Minor Names (Comma Separated):
                </label>
                <input
                  type="text"
                  value={victimNamesInput}
                  onChange={(e) => setVictimNamesInput(e.target.value)}
                  className="w-full p-2 bg-dark-900 border border-dark-700 rounded-lg text-xs text-dark-200 focus:outline-none focus:border-emerald-500"
                  placeholder="e.g. Sunita Sharma, Minor Child"
                />
              </div>

              <div>
                <label className="text-[10px] text-dark-400 uppercase tracking-wider block mb-1">
                  Incident Narrative / Witness Statement:
                </label>
                <textarea
                  rows={8}
                  value={dpdpInputText}
                  onChange={(e) => setDpdpInputText(e.target.value)}
                  className="w-full p-3 bg-dark-900 border border-dark-700 rounded-lg text-xs text-dark-200 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <button
                onClick={handleRedactDpdp}
                disabled={loadingDpdp}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingDpdp ? 'animate-spin' : ''}`} />
                {loadingDpdp ? 'Applying DPDP Redaction...' : 'Apply DPDP PII Auto-Masking'}
              </button>
            </div>

            {/* Sanitized Output Side */}
            <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    DPDP Sanitized Public & Media Copy
                  </h4>
                  {dpdpResult && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {dpdpResult.stats?.total_redacted} PII Tokens Masked
                    </span>
                  )}
                </div>

                {dpdpResult?.stats && (
                  <div className="grid grid-cols-4 gap-2 mb-3 text-center">
                    <div className="p-2 rounded bg-dark-900/60 border border-dark-700/60">
                      <span className="text-[10px] text-dark-400 block">Aadhaar</span>
                      <span className="text-xs font-bold text-dark-200">{dpdpResult.stats.aadhaar}</span>
                    </div>
                    <div className="p-2 rounded bg-dark-900/60 border border-dark-700/60">
                      <span className="text-[10px] text-dark-400 block">Phone</span>
                      <span className="text-xs font-bold text-dark-200">{dpdpResult.stats.phone}</span>
                    </div>
                    <div className="p-2 rounded bg-dark-900/60 border border-dark-700/60">
                      <span className="text-[10px] text-dark-400 block">Email / PAN</span>
                      <span className="text-xs font-bold text-dark-200">
                        {dpdpResult.stats.email + dpdpResult.stats.pan}
                      </span>
                    </div>
                    <div className="p-2 rounded bg-dark-900/60 border border-dark-700/60">
                      <span className="text-[10px] text-dark-400 block">Victim IDs</span>
                      <span className="text-xs font-bold text-dark-200">{dpdpResult.stats.victim_name}</span>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-dark-900/90 border border-emerald-500/30 rounded-lg text-xs font-mono text-dark-200 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {dpdpResult?.redacted_text || 'Click button to generate redacted version.'}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                <span className="font-bold block mb-0.5">Statutory Protection Status:</span>
                Under Section 72 of Bharatiya Nyaya Sanhita, 2023, disclosing the identity of victims of certain offenses is an offense. This redaction prevents unauthorized leaks to media channels.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
