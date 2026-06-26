
import React, { useMemo } from 'react';
import { Arrangement, ExternalService, ImpactLevel, Alert, AlertType } from '../types';
import { GitCompare, AlertTriangle, CheckCircle, Info, AlertOctagon } from 'lucide-react';
import { COLORS } from '../constants';

interface ComparisonViewProps {
  arrangementA: Arrangement;
  arrangementB: Arrangement | null;
  allArrangements: Arrangement[];
  onSelectB: (id: string) => void;
  onClose: () => void;
  generateAlerts: (a: Arrangement) => Alert[];
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ 
  arrangementA, 
  arrangementB, 
  allArrangements, 
  onSelectB,
  onClose,
  generateAlerts
}) => {

  const alertsA = useMemo(() => generateAlerts(arrangementA), [arrangementA, generateAlerts]);
  const alertsB = useMemo(() => arrangementB ? generateAlerts(arrangementB) : [], [arrangementB, generateAlerts]);

  const getSeverityScore = (alerts: Alert[]) => {
      let score = 0;
      alerts.forEach(a => {
          if (a.severity === ImpactLevel.PROHIBITIVE) score += 100;
          if (a.severity === ImpactLevel.UNDESIRABLE) score += 10;
          if (a.severity === ImpactLevel.ACCEPTABLE) score -= 5;
      });
      return score;
  }

  const scoreA = getSeverityScore(alertsA);
  const scoreB = getSeverityScore(alertsB);

  return (
    <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex flex-col p-6 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitCompare className="text-indigo-400" />
          Consequence Comparison
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2 bg-slate-800 rounded">Close</button>
      </div>

      <div className="grid grid-cols-2 gap-8 h-full overflow-hidden">
        {/* Left Side: A */}
        <HypothesisColumn 
            arrangement={arrangementA} 
            alerts={alertsA} 
            score={scoreA}
            isBase={true} 
        />

        {/* Right Side: B */}
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <select 
                    className="bg-slate-900 border border-slate-600 text-white rounded p-3 w-full text-lg font-semibold"
                    value={arrangementB?.id || ''}
                    onChange={(e) => onSelectB(e.target.value)}
                >
                    <option value="" disabled>Select comparison target...</option>
                    {allArrangements.filter(a => a.id !== arrangementA.id).map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({a.container.versionLabel})</option>
                    ))}
                </select>
            </div>
            
            {arrangementB ? (
                <HypothesisColumn 
                    arrangement={arrangementB} 
                    alerts={alertsB} 
                    score={scoreB}
                    isBase={false} 
                />
            ) : (
                <div className="flex-1 border border-slate-700 rounded-lg p-6 bg-slate-800/50 flex items-center justify-center text-slate-500">
                    Select a hypothesis to compare impacts.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const HypothesisColumn: React.FC<{ arrangement: Arrangement, alerts: Alert[], score: number, isBase: boolean }> = ({ arrangement, alerts, score, isBase }) => {
    
    // Sort alerts: Prohibitive first
    const sortedAlerts = [...alerts].sort((a, b) => {
        const priority = { [ImpactLevel.PROHIBITIVE]: 3, [ImpactLevel.UNDESIRABLE]: 2, [ImpactLevel.NEUTRAL]: 1, [ImpactLevel.ACCEPTABLE]: 0 };
        return priority[b.severity] - priority[a.severity];
    });

    return (
        <div className="border border-slate-700 rounded-lg p-6 bg-slate-800/50 flex flex-col h-full overflow-hidden">
             <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-700">
                <div>
                    <h3 className="text-xl font-semibold text-indigo-300">{arrangement.name}</h3>
                    <p className="text-sm text-slate-400 mt-1 italic">"{arrangement.container.hypothesisName}"</p>
                </div>
                <div className={`px-3 py-1 rounded text-xs font-bold ${score > 50 ? 'bg-red-900 text-red-400' : score > 10 ? 'bg-amber-900 text-amber-400' : 'bg-emerald-900 text-emerald-400'}`}>
                    Risk Score: {score}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
                {sortedAlerts.length === 0 && <div className="text-slate-500 italic text-center p-4">No critical impacts detected.</div>}
                
                {sortedAlerts.map(alert => (
                    <div key={alert.id} className={`p-3 rounded border-l-4 ${
                        alert.severity === ImpactLevel.PROHIBITIVE ? 'border-red-500 bg-red-950/20' :
                        alert.severity === ImpactLevel.UNDESIRABLE ? 'border-amber-500 bg-amber-950/20' :
                        alert.severity === ImpactLevel.ACCEPTABLE ? 'border-emerald-500 bg-emerald-950/20' :
                        'border-slate-500 bg-slate-900'
                    }`}>
                         <div className="flex items-center gap-2 mb-1">
                             {alert.severity === ImpactLevel.PROHIBITIVE && <AlertOctagon size={14} className="text-red-500" />}
                             {alert.severity === ImpactLevel.UNDESIRABLE && <AlertTriangle size={14} className="text-amber-500" />}
                             <span className="text-sm font-bold text-slate-200">{alert.title}</span>
                         </div>
                         <p className="text-xs text-slate-400">{alert.description}</p>
                    </div>
                ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Service Stack</h4>
                <div className="flex flex-wrap gap-2">
                    {arrangement.services.map(s => (
                        <span key={s.id} className="px-2 py-1 bg-slate-900 rounded text-xs text-slate-400 border border-slate-800">
                            {s.name} {s.isExperimental && '(EXP)'}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    )
}
