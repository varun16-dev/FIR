import React, { useState, useEffect } from 'react';
import { Gavel, CheckCircle, AlertTriangle } from 'lucide-react';
import { evidenceApi } from '../services/api';
interface EvidenceItem {
  id: number;
  evidence_id: string;
  original_filename: string;
  case_id: number;
  court_exhibit_number: string | null;
  court_action: string | null;
  integrity_status: string;
}

export function CourtDashboardPage() {
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEv, setSelectedEv] = useState<EvidenceItem | null>(null);
  const [exhibitNum, setExhibitNum] = useState('');
  const [disposition, setDisposition] = useState('ADMITTED');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchEvidence();
  }, []);

  const fetchEvidence = async () => {
    try {
      const res = await evidenceApi.list();
      setEvidenceList(res.data);
    } catch (err) {
      console.error('Failed to fetch evidence for court', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEv) return;
    
    try {
      await evidenceApi.recordCourtAction(selectedEv.id, {
        exhibit_number: exhibitNum,
        court_action: disposition,
        disposition_notes: notes
      });
      alert("Court metadata updated successfully.");
      setSelectedEv(null);
      fetchEvidence();
    } catch (err) {
      console.error(err);
      alert("Error updating court action.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Gavel className="w-6 h-6 text-indigo-600" />
            Court Evidence Dashboard
          </h1>
          <p className="text-gray-500 mt-1">Manage exhibits and dispositions for legal proceedings.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading evidence...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <th className="p-4 font-medium">Evidence ID</th>
                <th className="p-4 font-medium">Filename</th>
                <th className="p-4 font-medium">Exhibit No.</th>
                <th className="p-4 font-medium">Integrity</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evidenceList.map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono text-sm">{ev.evidence_id}</td>
                  <td className="p-4 text-sm font-medium text-gray-900">{ev.original_filename}</td>
                  <td className="p-4 text-sm text-gray-500">{ev.court_exhibit_number || '-'}</td>
                  <td className="p-4">
                    {ev.integrity_status === 'VERIFIED' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {ev.integrity_status}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-sm text-gray-500">{ev.court_action || 'Pending'}</td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedEv(ev);
                        setExhibitNum(ev.court_exhibit_number || '');
                        setDisposition(ev.court_action || 'ADMITTED');
                      }}
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      Update Docket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedEv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Update Court Metadata</h3>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exhibit Number</label>
                <input
                  type="text"
                  value={exhibitNum}
                  onChange={(e) => setExhibitNum(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disposition</label>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ADMITTED">Admitted</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="SEALED">Sealed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedEv(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Save Docket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
