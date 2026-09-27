import { useState } from 'react';
import { Server, Zap, Database, Play, Pause, Network } from 'lucide-react';

export function CAPDemoPage() {
  const [nodeAState, setNodeAState] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [nodeBState, setNodeBState] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [partitionActive, setPartitionActive] = useState(false);
  const [consistencyMode, setConsistencyMode] = useState<'STRONG' | 'EVENTUAL'>('STRONG');
  
  const [writeResult, setWriteResult] = useState<string | null>(null);

  const simulateWrite = () => {
    if (partitionActive) {
      if (consistencyMode === 'STRONG') {
        setWriteResult('WRITE FAILED: Strong consistency requires all nodes to acknowledge, but partition prevents this (Choosing C over A).');
      } else {
        setWriteResult('WRITE SUCCESS: Accepted by Node A, but Node B is stale (Choosing A over C).');
      }
    } else {
      if (nodeAState === 'OFFLINE' && nodeBState === 'OFFLINE') {
         setWriteResult('WRITE FAILED: No nodes available.');
      } else {
         setWriteResult('WRITE SUCCESS: Replicated to available nodes.');
      }
    }
    
    setTimeout(() => setWriteResult(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Network className="w-6 h-6 text-indigo-600" />
          CAP Theorem Interactive Simulation
        </h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed border-l-4 border-indigo-500 pl-3">
          <strong className="text-gray-900">EDUCATIONAL DEMONSTRATION ONLY:</strong> The actual production Evidence Vault architecture currently relies on a single-node FastAPI server and a local SQLite database, which provides Strong Consistency and High Availability but zero Partition Tolerance. This dashboard simulates how the system <em>would</em> behave if deployed across a distributed database cluster (e.g., CockroachDB or Cassandra).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Controls */}
        <div className="col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" /> Simulation Controls
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Network Partition</label>
              <button
                onClick={() => setPartitionActive(!partitionActive)}
                className={`w-full py-2 px-4 rounded-lg font-medium flex justify-center items-center gap-2 transition-colors ${
                  partitionActive 
                    ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {partitionActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {partitionActive ? 'Heal Partition' : 'Trigger Partition'}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Database Strategy</label>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setConsistencyMode('STRONG')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md ${
                    consistencyMode === 'STRONG' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  CP (Strong)
                </button>
                <button
                  onClick={() => setConsistencyMode('EVENTUAL')}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md ${
                    consistencyMode === 'EVENTUAL' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  AP (Eventual)
                </button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={simulateWrite}
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex justify-center items-center gap-2 shadow-sm"
              >
                <Database className="w-4 h-4" />
                Simulate Write Request
              </button>
            </div>
          </div>
        </div>

        {/* Visualizer */}
        <div className="col-span-1 md:col-span-2 bg-slate-900 rounded-xl shadow-inner border border-slate-800 p-8 flex flex-col items-center justify-center relative overflow-hidden">
          
          <div className="w-full flex justify-between items-center px-12 relative z-10">
            {/* Node A */}
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full border-4 transition-colors ${
                nodeAState === 'ONLINE' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-red-500/20 border-red-500'
              }`}>
                <Server className={`w-8 h-8 ${nodeAState === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <span className="text-white font-mono text-sm">Node A (Primary)</span>
              <button 
                onClick={() => setNodeAState(s => s === 'ONLINE' ? 'OFFLINE' : 'ONLINE')}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Toggle State
              </button>
            </div>

            {/* Network Link */}
            <div className="flex-1 flex justify-center items-center px-4">
              <div className={`h-1 w-full transition-colors ${
                partitionActive ? 'bg-red-500 relative' : 'bg-emerald-500'
              }`}>
                {partitionActive && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-500 p-1 rounded-full animate-pulse">
                    <X className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Node B */}
            <div className="flex flex-col items-center gap-3">
              <div className={`p-4 rounded-full border-4 transition-colors ${
                nodeBState === 'ONLINE' ? 'bg-emerald-500/20 border-emerald-500' : 'bg-red-500/20 border-red-500'
              }`}>
                <Server className={`w-8 h-8 ${nodeBState === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <span className="text-white font-mono text-sm">Node B (Replica)</span>
              <button 
                onClick={() => setNodeBState(s => s === 'ONLINE' ? 'OFFLINE' : 'ONLINE')}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Toggle State
              </button>
            </div>
          </div>

          {/* Results Overlay */}
          {writeResult && (
            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg border text-sm font-medium animate-in slide-in-from-bottom-4 ${
              writeResult.includes('SUCCESS') ? 'bg-emerald-900/90 border-emerald-500 text-emerald-100' : 'bg-red-900/90 border-red-500 text-red-100'
            }`}>
              {writeResult}
            </div>
          )}
        </div>
      </div>
      
      {/* Educational Box */}
      <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
        <h3 className="font-bold text-indigo-900 mb-2">CAP Theorem Analysis</h3>
        <p className="text-sm text-indigo-800 mb-4">
          The CAP Theorem states that a distributed data store can only guarantee two of the following three: Consistency (C), Availability (A), and Partition Tolerance (P).
        </p>
        <ul className="text-sm text-indigo-800 space-y-2 list-disc pl-5">
          <li><strong>Current Production:</strong> CA (Consistency + Availability). Since there is no partition tolerance (single node), it fails entirely if the server goes down.</li>
          <li><strong>Simulated CP (Strong Consistency):</strong> Write operations fail if the network partitions, preventing split-brain scenarios but reducing availability.</li>
          <li><strong>Simulated AP (Eventual Consistency):</strong> Write operations succeed on Node A even if Node B cannot be reached, keeping the system available but temporarily sacrificing consistency.</li>
        </ul>
      </div>
    </div>
  );
}

const X = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);
