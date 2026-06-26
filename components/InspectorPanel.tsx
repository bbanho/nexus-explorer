
import React, { useState, useEffect, useMemo } from 'react';
import { Arrangement, EntityType, ImpactLevel, Alert, Rule, Predicate, ExternalService } from '../types';
import { 
    Shield, 
    Search, 
    MousePointer2, 
    AlertOctagon, 
    AlertTriangle, 
    Activity, 
    Info, 
    X, 
    Save, 
    Edit2, 
    Plus, 
    ArrowRight, 
    CheckCircle, 
    LayoutTemplate,
    Layers,
    Network
} from 'lucide-react';

// --- SHARED COMPONENTS ---

const AlertCard: React.FC<{ alert: Alert, onClick?: () => void }> = ({ alert, onClick }) => {
  const styles = {
    [ImpactLevel.PROHIBITIVE]: { border: 'border-red-500', bg: 'bg-red-950/20', icon: <AlertOctagon className="text-red-500" size={16} /> },
    [ImpactLevel.UNDESIRABLE]: { border: 'border-amber-500', bg: 'bg-amber-950/20', icon: <AlertTriangle className="text-amber-500" size={16} /> },
    [ImpactLevel.ACCEPTABLE]: { border: 'border-emerald-500', bg: 'bg-emerald-950/20', icon: <Activity className="text-emerald-500" size={16} /> },
    [ImpactLevel.NEUTRAL]: { border: 'border-slate-500', bg: 'bg-slate-800', icon: <Info className="text-slate-400" size={16} /> },
  };

  const style = styles[alert.severity];

  return (
    <div 
      onClick={onClick}
      className={`p-3 rounded border-l-4 ${style.border} ${style.bg} mb-2 cursor-pointer hover:brightness-110 transition-all`}
    >
      <div className="flex justify-between items-start mb-1">
        <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
          {style.icon}
          {alert.title}
        </div>
        <span className="text-[10px] uppercase font-mono text-slate-500">{alert.impactArea}</span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">{alert.description}</p>
    </div>
  );
};

// --- SUB-VIEWS ---

const ClusterAnalysis = ({ 
    selectedEntities, 
    arrangement, 
    alerts, 
    onClose,
    onEntityClick
}: { 
    selectedEntities: { type: EntityType, id: string }[], 
    arrangement: Arrangement, 
    alerts: Alert[], 
    onClose: () => void,
    onEntityClick: (t: EntityType, id: string, m: boolean) => void
}) => {
    const clusterAlerts = alerts.filter(a => 
        selectedEntities.some(e => a.provenance.includes(e.id))
    );
    const uniqueAlerts = Array.from(new Set(clusterAlerts.map(a => a.id)))
        .map(id => clusterAlerts.find(a => a.id === id)!);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start">
                <div>
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <MousePointer2 size={12} /> Multi-Selection
                    </div>
                    <h2 className="text-sm font-bold text-slate-100">{selectedEntities.length} Entities</h2>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"><X size={16}/></button>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Selected Items</label>
                    <div className="flex flex-wrap gap-2">
                        {selectedEntities.map(e => {
                            let label = e.id;
                            if (e.type === EntityType.SERVICE) label = arrangement.services.find(s => s.id === e.id)?.name || e.id;
                            if (e.type === EntityType.RULE) label = arrangement.container.activeRules.find(r => r.id === e.id)?.name || e.id;
                            return (
                                <div key={`${e.type}-${e.id}`} className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300">
                                    <span className="truncate max-w-[120px]">{label}</span>
                                    <button onClick={(ev) => { ev.stopPropagation(); onEntityClick(e.type, e.id, true); }} className="hover:text-white text-slate-500">
                                        <X size={12}/>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Combined Impact</label>
                     {uniqueAlerts.length > 0 ? (
                         <div className="space-y-2">
                            {uniqueAlerts.map(alert => (
                                <AlertCard key={alert.id} alert={alert} />
                            ))}
                         </div>
                     ) : (
                         <div className="text-xs text-slate-600 italic p-4 border border-slate-900 rounded bg-slate-900/50 text-center">
                             No derived alerts found for this combination.
                         </div>
                     )}
                </div>
            </div>
        </div>
    )
}

const ServiceDetail = ({ 
    service, 
    rules, 
    alerts, 
    onClose,
    onNavigateToRule 
}: { 
    service: ExternalService, 
    rules: Rule[], 
    alerts: Alert[], 
    onClose: () => void,
    onNavigateToRule: (id: string) => void
}) => {
    const serviceAlerts = alerts.filter(a => a.provenance.includes(service.id));
    const governingRules = rules.filter(r => 
        service.attributes.some(attr => r.matcherKeywords.some(k => attr.includes(k))) ||
        (r.matcherKeywords.includes('Legacy') && service.type === 'LEGACY_SYSTEM')
    );

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start">
            <div>
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Layers size={10} /> Component
                </div>
                <h2 className="text-sm font-bold text-slate-100">{service.name}</h2>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"><X size={16}/></button>
            </div>
            
            <div className="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                
                {/* 1. IMPACTS (PRIORITY 1) */}
                <div>
                     <label className="text-[10px] font-bold text-red-400 uppercase block mb-2 flex items-center gap-2">
                        <AlertOctagon size={12}/> Critical Impacts
                     </label>
                     {serviceAlerts.length > 0 ? (
                         <div className="space-y-2">
                            {serviceAlerts.map(alert => (
                                <AlertCard key={alert.id} alert={alert} />
                            ))}
                         </div>
                     ) : (
                         <div className="text-xs text-emerald-600/80 italic p-3 border border-emerald-900/30 bg-emerald-950/10 rounded flex items-center gap-2">
                             <CheckCircle size={14}/> No negative impacts detected.
                         </div>
                     )}
                </div>

                {/* 2. METADATA */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Type</label>
                        <span className="text-xs text-slate-300 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800 inline-block">{service.type}</span>
                    </div>
                    <div>
                         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status</label>
                         {service.isExperimental ? (
                             <span className="text-[10px] font-bold bg-amber-900/40 text-amber-500 px-2 py-1 rounded border border-amber-900/50">EXPERIMENTAL</span>
                         ) : (
                             <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-1 rounded border border-slate-700">STABLE</span>
                         )}
                    </div>
                </div>

                {/* 3. ATTRIBUTES */}
                <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Attributes</label>
                     <div className="flex flex-wrap gap-2">
                        {service.attributes.map(attr => (
                            <span key={attr} className="px-2 py-1 bg-slate-900 text-slate-400 text-xs rounded border border-slate-800">
                                {attr}
                            </span>
                        ))}
                     </div>
                </div>

                {/* 4. RULES */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Governing Rules</label>
                    <div className="space-y-2">
                        {governingRules.length > 0 ? (
                            governingRules.map(r => (
                                <div 
                                    key={r.id} 
                                    onClick={() => onNavigateToRule(r.id)}
                                    className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded hover:border-slate-600 cursor-pointer group"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                                        <span className="text-xs font-bold text-slate-300 truncate max-w-[180px]">{r.name}</span>
                                    </div>
                                    <ArrowRight size={12} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-slate-600 italic">No specific rules.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const RuleDetail = ({ 
    rule, 
    status, 
    predicates, 
    services, 
    onClose, 
    onUpdate,
    onNavigateToService 
}: { 
    rule: Rule, 
    status: string, 
    predicates: Predicate[], 
    services: ExternalService[],
    onClose: () => void, 
    onUpdate: (r: Rule) => void,
    onNavigateToService: (id: string) => void
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedRule, setEditedRule] = useState<Rule>(rule);
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        setEditedRule(rule);
        setIsEditing(false);
    }, [rule]);

    const impactedServices = services.reduce<{service: ExternalService, reasons: string[]}[]>((acc, s) => {
        const reasons: string[] = [];
        rule.matcherKeywords.forEach(k => {
             if (s.attributes.some(attr => attr.includes(k))) {
                 reasons.push(k);
             }
             if (k === 'Legacy' && s.type === 'LEGACY_SYSTEM') {
                 reasons.push('Legacy Type');
             }
        });
        
        if (reasons.length > 0) {
            acc.push({ service: s, reasons: Array.from(new Set(reasons)) });
        }
        return acc;
    }, []);

    const handleSave = () => {
        onUpdate(editedRule);
        setIsEditing(false);
    };

    const addKeyword = () => {
        if (newKeyword && !editedRule.matcherKeywords.includes(newKeyword)) {
            setEditedRule(prev => ({ ...prev, matcherKeywords: [...prev.matcherKeywords, newKeyword] }));
            setNewKeyword('');
        }
    };

    const removeKeyword = (kw: string) => {
        setEditedRule(prev => ({ ...prev, matcherKeywords: prev.matcherKeywords.filter(k => k !== kw) }));
    };

    const getStatusBadge = () => {
        switch(status) {
            case 'FAILED': return <span className="flex items-center gap-1 bg-red-900/50 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-900"><AlertOctagon size={12}/> BLOCKED</span>;
            case 'WARNING': return <span className="flex items-center gap-1 bg-amber-900/50 text-amber-400 px-2 py-1 rounded text-xs font-bold border border-amber-900"><AlertTriangle size={12}/> AT RISK</span>;
            case 'PASSED': return <span className="flex items-center gap-1 bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded text-xs font-bold border border-emerald-900"><CheckCircle size={12}/> SATISFIED</span>;
            default: return <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded text-xs border border-slate-700">N/A</span>;
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start">
            <div className="flex-1 mr-4">
                <div className="text-[10px] font-bold text-pink-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Network size={10} /> Rule
                </div>
                {isEditing ? (
                    <input 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-slate-100 font-bold"
                        value={editedRule.name}
                        onChange={e => setEditedRule({...editedRule, name: e.target.value})}
                    />
                ) : (
                    <h2 className="text-sm font-bold text-slate-100">{rule.name}</h2>
                )}
            </div>
            <div className="flex gap-2">
                {isEditing ? (
                    <button onClick={handleSave} className="text-emerald-500 hover:text-white p-1 hover:bg-emerald-900 rounded"><Save size={16}/></button>
                ) : (
                    <button onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded"><Edit2 size={16}/></button>
                )}
                <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"><X size={16}/></button>
            </div>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                
                <div className="flex justify-between items-center">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Status</label>
                        {getStatusBadge()}
                     </div>
                     {isEditing && (
                         <div>
                             <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Operator</label>
                             <select 
                                value={editedRule.operator || 'AND'}
                                onChange={e => setEditedRule({...editedRule, operator: e.target.value as any})}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded p-1"
                             >
                                 <option value="AND">AND</option>
                                 <option value="OR">OR</option>
                             </select>
                         </div>
                     )}
                </div>

                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Description</label>
                    {isEditing ? (
                        <textarea 
                            className="w-full h-24 bg-slate-800 border border-slate-700 rounded p-2 text-sm text-slate-300"
                            value={editedRule.description}
                            onChange={e => setEditedRule({...editedRule, description: e.target.value})}
                        />
                    ) : (
                        <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800">
                            {rule.description}
                        </p>
                    )}
                </div>

                {/* PREDICATES EDITING */}
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Linked Predicates</label>
                    {isEditing ? (
                        <div className="bg-slate-900 border border-slate-700 rounded p-2 max-h-32 overflow-y-auto custom-scrollbar space-y-1">
                            {predicates.map(p => (
                                <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 p-1 rounded">
                                    <input 
                                        type="checkbox"
                                        className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0"
                                        checked={editedRule.predicateIds.includes(p.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setEditedRule(prev => ({...prev, predicateIds: [...prev.predicateIds, p.id]}));
                                            } else {
                                                setEditedRule(prev => ({...prev, predicateIds: prev.predicateIds.filter(id => id !== p.id)}));
                                            }
                                        }}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs text-slate-300 font-bold">{p.label}</span>
                                        <span className="text-[9px] text-slate-500 truncate w-40">{p.description}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {rule.predicateIds.length > 0 ? rule.predicateIds.map(pid => {
                                const p = predicates.find(pred => pred.id === pid);
                                if (!p) return null;
                                return (
                                    <div key={pid} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-900/30 text-indigo-300 text-xs rounded border border-indigo-500/30" title={p.description}>
                                        <Shield size={10} />
                                        {p.label}
                                    </div>
                                );
                            }) : <span className="text-xs text-slate-600 italic">No predicates linked.</span>}
                        </div>
                    )}
                </div>
            
                <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Matchers</label>
                    <div className="flex flex-wrap gap-1">
                        {editedRule.matcherKeywords.map(k => (
                            <span key={k} className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded border border-slate-700">
                                {k}
                                {isEditing && <button onClick={() => removeKeyword(k)}><X size={8} /></button>}
                            </span>
                        ))}
                        {isEditing && (
                            <div className="flex items-center gap-1 mt-1">
                                <input 
                                    className="w-16 bg-slate-800 border border-slate-700 rounded text-[10px] p-0.5 text-white"
                                    placeholder="Add..."
                                    value={newKeyword}
                                    onChange={e => setNewKeyword(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && addKeyword()}
                                />
                                <button onClick={addKeyword} className="text-slate-400 hover:text-white"><Plus size={12}/></button>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Impacted Architectures ({impactedServices.length})</label>
                     <div className="space-y-2">
                         {impactedServices.length > 0 ? (
                             impactedServices.map(({ service: s, reasons }) => (
                                 <div 
                                    key={s.id}
                                    onClick={() => onNavigateToService(s.id)}
                                    className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded hover:border-slate-600 cursor-pointer group"
                                 >
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold text-slate-300 truncate max-w-[120px]">{s.name}</span>
                                        </div>
                                    </div>
                                    <ArrowRight size={12} className="text-slate-600 group-hover:text-slate-300 transition-colors" />
                                 </div>
                             ))
                         ) : (
                             <div className="text-xs text-slate-600 italic">No matches.</div>
                         )}
                     </div>
                </div>
            </div>
        </div>
    );
};

const PredicateDetail = ({ predicate, onClose }: { predicate: Predicate, onClose: () => void }) => (
  <div className="flex flex-col h-full">
    <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start">
      <div>
         <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Predicate</div>
         <h2 className="text-sm font-bold text-slate-100">{predicate.label}</h2>
      </div>
      <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"><X size={16}/></button>
    </div>
    <div className="p-4 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
       <div>
         <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Requirement</label>
         <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded border border-slate-800">
            {predicate.description}
         </p>
       </div>
       <div className="p-3 bg-indigo-950/10 border border-indigo-900/30 rounded text-xs text-indigo-400 leading-relaxed flex gap-2">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <span>Predicates are immutable constraints used to validate rules across the graph.</span>
       </div>
    </div>
  </div>
);

// --- MAIN INSPECTOR PANEL ---

interface InspectorPanelProps {
    activeArrangement: Arrangement;
    selectedEntities: { type: EntityType, id: string }[];
    alerts: Alert[];
    onEntityClick: (type: EntityType, id: string, multiSelect: boolean) => void;
    onUpdateRule: (r: Rule) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
    activeArrangement,
    selectedEntities,
    alerts,
    onEntityClick,
    onUpdateRule
}) => {
    const [activeTab, setActiveTab] = useState<'INSPECT' | 'IMPACT'>('INSPECT');

    // Auto-switch to INSPECT when selection changes
    useEffect(() => {
        if (selectedEntities.length > 0) {
            setActiveTab('INSPECT');
        }
    }, [selectedEntities]);

    // Derived Selection Objects
    const singleSelectedEntity = selectedEntities.length === 1 ? selectedEntities[0] : null;
    const selectedRule = useMemo(() => 
        singleSelectedEntity?.type === EntityType.RULE ? activeArrangement.container.activeRules.find(r => r.id === singleSelectedEntity.id) : null,
    [singleSelectedEntity, activeArrangement]);
    const selectedPredicate = useMemo(() => 
        singleSelectedEntity?.type === EntityType.PREDICATE ? activeArrangement.predicates.find(p => p.id === singleSelectedEntity.id) : null,
    [singleSelectedEntity, activeArrangement]);
    const selectedService = useMemo(() => 
        singleSelectedEntity?.type === EntityType.SERVICE ? activeArrangement.services.find(s => s.id === singleSelectedEntity.id) : null,
    [singleSelectedEntity, activeArrangement]);
    
    // Status Calculation for Display
    const selectedRuleStatus = useMemo(() => {
        if (!selectedRule) return 'NOT_EVALUATED';
        const related = alerts.filter(a => a.provenance.includes(selectedRule.id));
        if (related.some(a => a.severity === ImpactLevel.PROHIBITIVE)) return 'FAILED';
        if (related.some(a => a.severity === ImpactLevel.UNDESIRABLE)) return 'WARNING';
        return 'PASSED';
    }, [selectedRule, alerts]);

    return (
        <div className="flex flex-col h-full bg-slate-950 w-full overflow-hidden">
            {/* Header / Tabs */}
            <div className="flex items-center bg-slate-900 border-b border-slate-800 shrink-0">
                <button
                    onClick={() => setActiveTab('INSPECT')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase transition-all
                        ${activeTab === 'INSPECT' ? 'bg-slate-800 text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}
                    `}
                >
                    <Search size={14} /> INSPECT
                </button>
                <button
                    onClick={() => setActiveTab('IMPACT')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase transition-all
                        ${activeTab === 'IMPACT' ? 'bg-slate-800 text-white border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}
                    `}
                >
                    <Shield size={14} /> ALERTS ({alerts.length})
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative bg-slate-950/50">
                {activeTab === 'INSPECT' && (
                    <div className="h-full">
                        {selectedEntities.length > 0 ? (
                            selectedEntities.length > 1 ? (
                                <ClusterAnalysis 
                                    selectedEntities={selectedEntities} 
                                    arrangement={activeArrangement} 
                                    alerts={alerts} 
                                    onClose={() => onEntityClick(EntityType.SERVICE, '', false)} 
                                    onEntityClick={onEntityClick}
                                />
                            ) : selectedRule ? (
                                <RuleDetail 
                                    rule={selectedRule} 
                                    status={selectedRuleStatus} 
                                    predicates={activeArrangement.predicates}
                                    services={activeArrangement.services}
                                    onClose={() => onEntityClick(EntityType.SERVICE, '', false)} 
                                    onUpdate={onUpdateRule}
                                    onNavigateToService={(id) => onEntityClick(EntityType.SERVICE, id, false)}
                                />
                            ) : selectedPredicate ? (
                                <PredicateDetail predicate={selectedPredicate} onClose={() => onEntityClick(EntityType.SERVICE, '', false)} />
                            ) : selectedService ? (
                                <ServiceDetail 
                                    service={selectedService} 
                                    rules={activeArrangement.container.activeRules}
                                    alerts={alerts} 
                                    onClose={() => onEntityClick(EntityType.SERVICE, '', false)}
                                    onNavigateToRule={(id) => onEntityClick(EntityType.RULE, id, false)}
                                />
                            ) : null
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center italic px-4">
                                <LayoutTemplate size={32} className="mb-4 text-slate-800" />
                                <p className="text-xs">Select a component to inspect.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'IMPACT' && (
                    <div className="h-full flex flex-col overflow-y-auto p-4 custom-scrollbar space-y-2">
                        {alerts.length > 0 ? alerts.map(a => (
                            <AlertCard 
                                key={a.id} 
                                alert={a} 
                                onClick={() => {
                                    if(a.provenance.length > 0) {
                                        onEntityClick(EntityType.RULE, a.provenance[0], false);
                                        setActiveTab('INSPECT');
                                    }
                                }}
                            />
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 italic">
                                <CheckCircle size={32} className="mb-2 text-emerald-900/50" />
                                <p className="text-xs">System limits nominal.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
