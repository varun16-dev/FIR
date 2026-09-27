import { useState } from 'react';
import { publicApi } from '../services/api';
import {
  Shield, CheckCircle2, Clock, Phone, AlertCircle, Download,
  ArrowRight, KeyRound, Search, FileText, Lock, Building, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CitizenPortalPage() {
  const [step, setStep] = useState<'request' | 'verify' | 'milestones'>('request');
  const [firNumber, setFirNumber] = useState('CASE-2026-001');
  const [contact, setContact] = useState('9811234567');
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [demoOtpHint, setDemoOtpHint] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firNumber.trim() || !contact.trim()) return;
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await publicApi.requestCitizenOtp(firNumber.trim(), contact.trim());
      setSessionId(res.data.session_id);
      setMaskedContact(res.data.masked_contact);
      setDemoOtpHint(res.data.demo_otp_hint || '123456');
      setStep('verify');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to locate FIR reference. Please check your number.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) return;
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await publicApi.verifyCitizenOtp(sessionId, otp.trim());
      // Fetch tracking data
      const trackRes = await publicApi.trackCitizenFir({ access_token: res.data.access_token });
      setTrackingData(trackRes.data);
      setStep('milestones');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Invalid or expired OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Demo OTP fill
  const handleFillDemoOtp = () => {
    setOtp(demoOtpHint);
  };

  // Step 3: Download FIR Acknowledgment Slip PDF
  const handleDownloadPdf = async () => {
    if (!trackingData?.case_details?.case_id) return;
    try {
      setDownloadingPdf(true);
      const res = await publicApi.downloadCitizenFirPdf(trackingData.case_details.case_id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Citizen_FIR_Receipt_${trackingData.case_details.fir_number}.pdf`;
      link.click();
    } catch (err) {
      console.error('Failed to download FIR slip:', err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100 flex flex-col justify-between selection:bg-vault-500 selection:text-white">
      {/* Top Gov Header */}
      <header className="border-b border-dark-800 bg-dark-900/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-vault-600/20 border border-vault-500/30 flex items-center justify-center text-vault-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-dark-400 font-bold block">
                Ministry of Home Affairs • State Police Services
              </span>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                National Citizen FIR Status Portal
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Lock className="w-3 h-3" />
              BNSS 2023 Sec 173 Verified
            </span>
            <Link
              to="/login"
              className="text-xs font-semibold text-vault-400 hover:text-vault-300 transition-colors"
            >
              Officer Login ➔
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {/* ========================================================================= */}
        {/* STEP 1: Request OTP */}
        {/* ========================================================================= */}
        {step === 'request' && (
          <div className="space-y-6 animate-fade-in">
            {/* Banner */}
            <div className="text-center space-y-2 max-w-xl mx-auto mb-8">
              <div className="inline-flex p-3 rounded-2xl bg-vault-600/15 text-vault-400 border border-vault-500/20 mb-2">
                <Search className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Track Your FIR Status in Real Time
              </h2>
              <p className="text-xs text-dark-400 leading-relaxed">
                Secure, OTP-authenticated status tracking for complainants and victims under Section 173(2) of the Bharatiya Nagarik Suraksha Sanhita, 2023.
              </p>
            </div>

            {/* Tracking Form Card */}
            <div className="glass-card max-w-md mx-auto p-6 space-y-5 border-vault-500/30 shadow-2xl">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-dark-300 block mb-1.5">
                    FIR / Case Reference Number
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. CASE-2026-001"
                      value={firNumber}
                      onChange={(e) => setFirNumber(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-dark-900 border border-dark-700 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-vault-500"
                    />
                    <FileText className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[10px] text-dark-500 mt-1 block">
                    Format: CASE-2026-XXX or National CCTNS number
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-dark-300 block mb-1.5">
                    Registered Mobile Phone or Email
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9811234567 or email@domain.com"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-dark-900 border border-dark-700 rounded-lg text-sm text-dark-100 placeholder-dark-500 focus:outline-none focus:border-vault-500"
                    />
                    <Phone className="w-4 h-4 text-dark-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <span className="text-[10px] text-dark-500 mt-1 block">
                    A secure 6-digit OTP will be dispatched to this contact.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-vault-600 hover:bg-vault-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-vault-600/25"
                >
                  {loading ? 'Validating Registry...' : 'Send Verification OTP'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Quick Demo Pre-fill for Reviewers */}
              <div className="pt-3 border-t border-dark-800 text-center">
                <span className="text-[11px] text-dark-500 block mb-1.5">For Hackathon / Reviewer Evaluation:</span>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setFirNumber('CASE-2026-001'); setContact('9811234567'); }}
                    className="text-[11px] px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-vault-400 border border-dark-700 cursor-pointer"
                  >
                    Load Demo Case 001
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFirNumber('CASE-2026-005'); setContact('9811234567'); }}
                    className="text-[11px] px-2.5 py-1 rounded bg-dark-800 hover:bg-dark-700 text-vault-400 border border-dark-700 cursor-pointer"
                  >
                    Load Demo Case 005
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: Verify OTP */}
        {/* ========================================================================= */}
        {step === 'verify' && (
          <div className="max-w-md mx-auto space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 mb-1">
                <KeyRound className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Enter Verification Code
              </h2>
              <p className="text-xs text-dark-400">
                OTP sent to <b className="text-white">{maskedContact}</b> for Case <b className="text-vault-400">{firNumber}</b>.
              </p>
            </div>

            <div className="glass-card p-6 space-y-5 border-vault-500/30">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-dark-300 block mb-1.5">
                    6-Digit Security OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full text-center tracking-[0.5em] font-mono text-lg font-bold p-3 bg-dark-900 border border-dark-700 rounded-lg text-vault-400 focus:outline-none focus:border-vault-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleFillDemoOtp}
                    className="px-2.5 py-1 bg-vault-600/20 text-vault-400 rounded border border-vault-500/30 hover:bg-vault-600/30 cursor-pointer font-mono"
                  >
                    Quick-Fill Demo OTP: {demoOtpHint}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('request')}
                    className="text-dark-400 hover:text-dark-200 cursor-pointer"
                  >
                    Change Details
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-vault-600 hover:bg-vault-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-lg shadow-vault-600/25"
                >
                  {loading ? 'Verifying OTP...' : 'Unlock FIR Case Milestones'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: Case Milestones Tracker View */}
        {/* ========================================================================= */}
        {step === 'milestones' && trackingData && (
          <div className="space-y-6 animate-fade-in">
            {/* Case Header Card */}
            <div className="glass-card p-6 border-vault-500/40 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-4 border-b border-dark-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-vault-400 bg-vault-600/20 px-2.5 py-0.5 rounded border border-vault-500/30">
                      {trackingData.case_details.fir_number}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {trackingData.case_details.current_status}
                    </span>
                    {trackingData.case_details.is_court_ready && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Court Docket Prepared
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    {trackingData.case_details.sanitized_title}
                  </h2>
                </div>

                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="px-4 py-2 bg-vault-600 hover:bg-vault-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-vault-600/20 self-start sm:self-auto"
                >
                  <Download className={`w-3.5 h-3.5 ${downloadingPdf ? 'animate-bounce' : ''}`} />
                  {downloadingPdf ? 'Generating...' : 'Download FIR Receipt (PDF)'}
                </button>
              </div>

              {/* Summary Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-[10px] text-dark-400 uppercase tracking-wider block">Police Station:</span>
                  <span className="font-medium text-dark-200">{trackingData.case_details.police_station}</span>
                </div>
                <div>
                  <span className="text-[10px] text-dark-400 uppercase tracking-wider block">Investigating Officer:</span>
                  <span className="font-medium text-dark-200">{trackingData.case_details.investigating_officer}</span>
                </div>
                <div>
                  <span className="text-[10px] text-dark-400 uppercase tracking-wider block">Registration Date:</span>
                  <span className="font-medium text-dark-200">{trackingData.case_details.registration_date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-dark-400 uppercase tracking-wider block">National CCTNS Ref:</span>
                  <span className="font-mono text-vault-300 font-semibold">{trackingData.case_details.cctns_national_ref}</span>
                </div>
              </div>
            </div>

            {/* Investigation Milestones Timeline */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-vault-400" />
                    Investigation & Judicial Progress Timeline
                  </h3>
                  <p className="text-xs text-dark-400 mt-0.5">
                    Official milestones under Bharatiya Nagarik Suraksha Sanhita (BNSS 2023)
                  </p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  Live Public Feed
                </span>
              </div>

              <div className="relative border-l-2 border-dark-800 ml-4 space-y-6 pl-6">
                {trackingData.investigation_milestones?.map((m: any, idx: number) => {
                  const isDone = m.status === 'COMPLETED';
                  const isInProgress = m.status === 'IN_PROGRESS';

                  return (
                    <div key={idx} className="relative group">
                      {/* Milestone Icon Dot */}
                      <div
                        className={`absolute -left-[31px] top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isDone
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                            : isInProgress
                            ? 'bg-vault-500 text-white animate-pulse shadow-lg shadow-vault-500/30'
                            : 'bg-dark-800 text-dark-500 border border-dark-700'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                      </div>

                      <div className="p-4 rounded-xl bg-dark-900/60 border border-dark-800/80 hover:border-dark-700 transition-all space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-dark-100 flex items-center gap-2">
                            {m.title}
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isInProgress
                                ? 'bg-vault-500/20 text-vault-400'
                                : 'bg-dark-800 text-dark-500'
                            }`}
                          >
                            {m.status.replace('_', ' ')}
                          </span>
                        </div>

                        <span className="text-[11px] font-mono text-vault-400 block font-semibold">
                          Statute: {m.statute}
                        </span>

                        <p className="text-xs text-dark-300 leading-relaxed">
                          {m.description}
                        </p>

                        {m.completed_at && (
                          <span className="text-[10px] text-dark-500 block pt-1">
                            Updated: {m.completed_at}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Citizen Rights & Helpdesk Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rights Charter */}
              <div className="glass-card p-5 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-vault-400" />
                  Your Legal Rights as a Citizen
                </h4>
                <ul className="space-y-2 text-xs text-dark-300">
                  {trackingData.citizen_rights_advisory?.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-vault-400 mt-0.5 flex-shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Police Helpdesk & Victim Support */}
              <div className="glass-card p-5 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-emerald-400" />
                  Official Police Support Desk
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-dark-900/60 border border-dark-800">
                    <span className="text-[10px] text-dark-400 block">Emergency & Women Helpline:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {trackingData.helpdesk_contact?.helpline}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-dark-900/60 border border-dark-800">
                    <span className="text-[10px] text-dark-400 block">Police Station Control Room:</span>
                    <span className="font-medium text-dark-200">
                      {trackingData.helpdesk_contact?.police_control_room}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-dark-900/60 border border-dark-800">
                    <span className="text-[10px] text-dark-400 block">Digital Verification Support:</span>
                    <span className="font-mono text-vault-300 text-[11px]">
                      {trackingData.helpdesk_contact?.digital_portal_support}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Back Button */}
            <div className="text-center pt-2">
              <button
                onClick={() => setStep('request')}
                className="text-xs font-semibold text-dark-400 hover:text-dark-200 cursor-pointer"
              >
                ← Track Another FIR Reference
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800 py-6 text-center text-xs text-dark-500">
        <p>EvidenceVault National Digital Records Infrastructure • Compliant with BNSS 2023, BSA 2023 & DPDP Act 2023</p>
      </footer>
    </div>
  );
}
