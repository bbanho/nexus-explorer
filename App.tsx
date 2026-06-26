
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { db } from './db'; // Import DB Singleton
import { ai } from './aiService'; // Import AI Singleton
import { Arrangement, EntityType, ImpactLevel, AlertType, Alert, Rule, Predicate, ExternalService, EvaluatedRule, Project } from './types';
import { GraphCanvas } from './components/GraphCanvas';
import { RulesCanvas } from './components/RulesCanvas';
import { ComparisonView } from './components/ComparisonView';
import { TerminalPanel } from './components/TerminalPanel'; 
import { InspectorPanel } from './components/InspectorPanel'; 
import { ForkTree } from './components/ForkTree';
import { 
  GitBranch, 
  Layers, 
  Box, 
  Maximize2,
  AlertTriangle,
  Network,
  Shield,
  Activity,
  User,
  AlertOctagon,
  Info,
  X,
  Database,
  Server,
  Cpu,
  Globe,
  CheckCircle,
  HelpCircle,
  Edit2,
  Save,
  Plus,
  Trash2,
  MousePointer2,
  ArrowRight,
  Download,
  Upload,
  HardDrive,
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Monitor,
  PanelRightClose,
  PanelRightOpen,
  MoreVertical,
  LayoutTemplate,
  GripHorizontal,
  Pin,
  ArrowLeft,
  Bug,
  Search,
  FolderOpen,
  Pause,
  Play
} from 'lucide-react';

// --- THE AGENT CORE: Derivation Engine ---

const generateAlerts = (arrangement: Arrangement): Alert[] => {
  const alerts: Alert[] = [];
  const { services, container } = arrangement;
  const rules = container.activeRules || []; // GUARD: Default to empty array if undefined

  // --- CONTEXT DETECTION ---
  const isMLProject = arrangement.projectId === 'proj_ml_audio';

  if (!isMLProject) {
      // === HOSPITAL DOMAIN LOGIC ===
      const hasCloud = services.some(s => s.attributes.includes('Cloud') || s.attributes.includes('Off-Prem'));
      const hasLegacy = services.some(s => s.type === 'LEGACY_SYSTEM');
      const hasAI = services.some(s => s.attributes.includes('AI'));
      const hasHumanSafety = services.some(s => s.attributes.includes('Safety-Layer'));
      const hasLocalFallback = services.some(s => s.attributes.includes('Continuity') || s.type === 'LEGACY_SYSTEM');

      // 1. PATTERN: Hybrid Complexity
      const ruleHybrid = rules.find(r => r.id === 'r_hybrid');
      if (ruleHybrid && hasCloud && hasLegacy) {
        alerts.push({
            id: 'imp_hybrid_complexity',
            title: 'Hybrid Synchronization Overhead',
            description: ruleHybrid.description,
            type: AlertType.OPERATIONAL_IMPLICATION,
            severity: ImpactLevel.UNDESIRABLE,
            provenance: ['r_hybrid', ...services.filter(s => s.type === 'LEGACY_SYSTEM' || s.attributes.includes('Cloud')).map(s => s.id)],
            impactArea: 'LATENCY'
        });

        alerts.push({
            id: 'imp_egress_fees',
            title: 'Variable Egress Costs',
            description: 'Frequent data transfer between On-Prem Mainframe and Cloud Storage will incur unpredictable operational costs.',
            type: AlertType.OPERATIONAL_IMPLICATION,
            severity: ImpactLevel.UNDESIRABLE,
            provenance: ['r_cost'],
            impactArea: 'COST'
        });
      }

      // 2. PATTERN: AI Safety
      const ruleAiSafe = rules.find(r => r.id === 'r_ai_safe');
      if (ruleAiSafe && hasAI) {
          if (!hasHumanSafety) {
              alerts.push({
                  id: 'risk_ai_autonomous',
                  title: 'Clinical Safety Violation',
                  description: 'AI Service is active without a dedicated "Human-in-the-Loop" verification layer. This violates clinical traceability protocols.',
                  type: AlertType.STRATEGIC_RISK,
                  severity: ImpactLevel.PROHIBITIVE,
                  provenance: ['r_ai_safe', ...services.filter(s => s.attributes.includes('AI')).map(s => s.id)],
                  impactArea: 'REGULATORY'
              });
          } else {
              alerts.push({
                  id: 'imp_human_workload',
                  title: 'Human Workload Increase',
                  description: 'Mandatory human audit of AI outputs increases operational load on clinical staff.',
                  type: AlertType.OPERATIONAL_IMPLICATION,
                  severity: ImpactLevel.UNDESIRABLE, 
                  provenance: ['r_ai_safe', ...services.filter(s => s.attributes.includes('Safety-Layer')).map(s => s.id)],
                  impactArea: 'COST'
              });
          }
      }

      // 3. PATTERN: Sovereignty
      const ruleCompliance = rules.find(r => r.id === 'r_compliance');
      if (ruleCompliance && hasCloud) {
          const hasExperimentalSaaS = services.some(s => s.attributes.includes('API-Gateway') && s.isExperimental);
          if (hasExperimentalSaaS) {
            alerts.push({
                id: 'risk_sovereignty',
                title: 'Data Residency Violation',
                description: 'Use of Experimental 3rd Party SaaS implies uncontrolled data residency.',
                type: AlertType.STRATEGIC_RISK,
                severity: ImpactLevel.PROHIBITIVE,
                provenance: ['r_compliance', 'p_sov'],
                impactArea: 'SECURITY'
            });
          } else {
              alerts.push({
                id: 'risk_cloud_reg',
                title: 'Regulatory Audit Burden',
                description: ruleCompliance.description,
                type: AlertType.OPERATIONAL_IMPLICATION,
                severity: ImpactLevel.UNDESIRABLE,
                provenance: ['r_compliance'],
                impactArea: 'REGULATORY'
              });
          }
      }

      // 4. PATTERN: Continuity
      const ruleContinuity = rules.find(r => r.id === 'r_continuity');
      if (ruleContinuity && !hasLocalFallback && hasCloud) {
          alerts.push({
              id: 'risk_outage',
              title: 'Critical Continuity Failure',
              description: 'Architecture relies on Cloud/Internet connectivity without on-premise fallback.',
              type: AlertType.STRATEGIC_RISK,
              severity: ImpactLevel.PROHIBITIVE,
              provenance: ['r_continuity', 'p_cont'],
              impactArea: 'SECURITY'
          });
      }

  } else {
      // === ML PIPELINE DOMAIN LOGIC ===
      const hasSVD = services.some(s => s.attributes.includes('SVD'));
      const hasTransformer = services.some(s => s.attributes.includes('Transformer'));
      const hasNormalization = services.some(s => s.attributes.includes('Normalization'));
      const hasTraining = services.some(s => s.attributes.includes('Training'));
      const hasEval = services.some(s => s.attributes.includes('Validation'));
      const pathA = services.some(s => s.attributes.includes('Path-A'));
      const pathB = services.some(s => s.attributes.includes('Path-B'));

      // 1. RULE: Representation Loss (SVD + Transformer)
      // If we are using Low-Dim SVD features as input to a High-Dim Transformer, we bottle-neck the capacity.
      const ruleRepLoss = rules.find(r => r.id === 'r_rep_loss');
      if (ruleRepLoss && hasSVD && hasTransformer) {
          alerts.push({
              id: 'imp_rep_loss',
              title: 'Representation Bottleneck',
              description: 'Feeding Low-Dimensional SVD features into a High-Capacity Transformer Encoder creates an information bottleneck, negating the benefits of the Transformer.',
              type: AlertType.OPERATIONAL_IMPLICATION,
              severity: ImpactLevel.UNDESIRABLE,
              provenance: ['r_rep_loss', ...services.filter(s => s.attributes.includes('SVD') || s.attributes.includes('Transformer')).map(s => s.id)],
              impactArea: 'LATENCY' // Using Latency as proxy for Performance/Efficiency
          });
      }

      // 2. RULE: Normalization Safety
      // Training requires Normalization.
      const ruleNorm = rules.find(r => r.id === 'r_norm_safe');
      if (ruleNorm && hasTraining && !hasNormalization) {
          alerts.push({
              id: 'risk_gradient_explosion',
              title: 'Unstable Training Dynamics',
              description: 'Neural Network training is active but Input Normalization node is missing. High risk of gradient explosion or non-convergence.',
              type: AlertType.STRATEGIC_RISK, // Strategic because it kills the model viability
              severity: ImpactLevel.PROHIBITIVE,
              provenance: ['r_norm_safe', ...services.filter(s => s.attributes.includes('Training')).map(s => s.id)],
              impactArea: 'SECURITY' // Using Security as proxy for Stability
          });
      }

      // 3. RULE: Pipeline Divergence (A/B Test complexity)
      const ruleDiv = rules.find(r => r.id === 'r_maint_div');
      if (ruleDiv && pathA && pathB) {
          alerts.push({
              id: 'imp_divergence',
              title: 'Maintenance Divergence',
              description: 'Architecture maintains two distinct feature engineering paths (Path A & Path B). Increases technical debt and testing surface area.',
              type: AlertType.OPERATIONAL_IMPLICATION,
              severity: ImpactLevel.NEUTRAL, // It's an accepted cost for A/B testing
              provenance: ['r_maint_div', ...services.filter(s => s.attributes.includes('Path-A') || s.attributes.includes('Path-B')).map(s => s.id)],
              impactArea: 'COST'
          });
      }

      // 4. RULE: Eval Mandatory
      const ruleEval = rules.find(r => r.id === 'r_model_eval');
      if (ruleEval && hasTraining && !hasEval) {
          alerts.push({
              id: 'risk_blind',
              title: 'Blind Model Deployment',
              description: 'Model is being trained but no Evaluation node exists in the pipeline.',
              type: AlertType.STRATEGIC_RISK,
              severity: ImpactLevel.PROHIBITIVE,
              provenance: ['r_model_eval', ...services.filter(s => s.attributes.includes('Training')).map(s => s.id)],
              impactArea: 'REGULATORY'
          });
      }
  }

  return alerts;
};

// --- Components ---

const EmptyState = ({ onOpenRegistry }: { onOpenRegistry: () => void }) => (
    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
        <FolderOpen size={64} className="text-slate-700" />
        <h2 className="text-xl font-bold text-slate-300">No Project Loaded</h2>
        <p className="max-w-md text-center text-sm">
            The workspace is currently empty. You can start by importing a template project or creating a new one.
        </p>
        <button 
            onClick={onOpenRegistry}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold shadow-lg transition-all flex items-center gap-2"
        >
            <HardDrive size={16} /> Open Registry & Load Template
        </button>
    </div>
);

// --- Main Application ---

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [arrangements, setArrangements] = useState<Arrangement[]>([]);
  const [activeArrangementId, setActiveArrangementId] = useState<string>('');
  
  // View States
  const [viewMode, setViewMode] = useState<'TOPOLOGY' | 'LOGIC'>('TOPOLOGY');
  const [showComparison, setShowComparison] = useState(false);
  const [compareId, setCompareId] = useState<string | null>(null);

  // Layout States (Left Sidebar)
  const [leftWidth, setLeftWidth] = useState(340);
  const [leftOpen, setLeftOpen] = useState(true);
  
  // Layout States (Right Sidebar)
  const [rightOpen, setRightOpen] = useState(false); // Default collapsed
  const [rightPinned, setRightPinned] = useState(false); // NEW: Pin state
  const [rightWidth, setRightWidth] = useState(320);
  
  const [isResizing, setIsResizing] = useState<'LEFT' | 'RIGHT' | null>(null);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // SPLIT STATE
  const [leftSplit, setLeftSplit] = useState(0.55); // 55% top, 45% bottom
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const leftSidebarRef = useRef<HTMLDivElement>(null);

  // CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; id: string | null; type: EntityType | null }>({
      visible: false, x: 0, y: 0, id: null, type: null
  });

  // AI REQUEST STATE (Bridge between Graph and Terminal)
  const [aiPromptRequest, setAiPromptRequest] = useState<string>("");

  // Sidebar Tab State
  const [activeLeftTab, setActiveLeftTab] = useState<'ARCHITECTURE' | 'RULES'>('ARCHITECTURE');

  // Trigger for Terminal to expand automatically
  const [expandRegistry, setExpandRegistry] = useState(false);

  // Background Agent State
  const [isAgentPaused, setIsAgentPaused] = useState(false);

  // Sync Tabs with ViewMode
  useEffect(() => {
    if (viewMode === 'TOPOLOGY') {
        setActiveLeftTab('ARCHITECTURE');
    } else {
        setActiveLeftTab('RULES');
    }
  }, [viewMode]);

  // Close Context Menu on Global Click
  useEffect(() => {
      const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  // MULTI-SELECTION STATE
  const [selectedEntities, setSelectedEntities] = useState<{ type: EntityType, id: string }[]>([]);

  // Update arrangement selection when Project changes
  useEffect(() => {
    // Poll for DB Init
    const initDB = async () => {
        if(!db.isReady) {
            await db.init();
        }
        try {
            const dbProjs = await db.getProjects();
            setProjects(dbProjs);
            
            // If we have projects and no current selection, pick the first
            if (dbProjs.length > 0 && !currentProjectId) {
                setCurrentProjectId(dbProjs[0].id);
            }
        } catch (e) {
            console.log("DB not ready or empty");
        }
    };
    initDB();

    // Event Subscription
    const unsubscribe = db.subscribe(async () => {
        try {
            const dbProjs = await db.getProjects();
            setProjects(dbProjs);
            
            // If user has no project selected but projects exist now (e.g. after import), select one
            if (dbProjs.length > 0 && !currentProjectId) {
                setCurrentProjectId(dbProjs[0].id);
            } else if (currentProjectId) {
                // If current project was deleted or we need refresh
                const dbArrs = await db.getArrangements(currentProjectId);
                setArrangements(dbArrs);
            }
        } catch(e) { console.error("Update failed", e); }
    });

    return () => unsubscribe();
  }, [currentProjectId]);

  // Fetch Arrangements when Current Project Changes
  useEffect(() => {
      if (currentProjectId) {
          db.getArrangements(currentProjectId).then(arrs => {
              setArrangements(arrs);
              if (arrs.length > 0) setActiveArrangementId(arrs[0].id);
          });
      }
  }, [currentProjectId]);

  // Window Resize Listener
  useEffect(() => {
      const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sidebar Horizontal Resize Logic
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (isResizing === 'LEFT') {
              const newWidth = Math.max(280, Math.min(e.clientX, 800)); // Constraints
              setLeftWidth(newWidth);
          }
          if (isResizing === 'RIGHT') {
              const newWidth = Math.max(240, Math.min(window.innerWidth - e.clientX, 600));
              setRightWidth(newWidth);
          }
          if (isResizingSplit && leftSidebarRef.current) {
              const rect = leftSidebarRef.current.getBoundingClientRect();
              const relativeY = e.clientY - rect.top;
              const percentage = relativeY / rect.height;
              // Clamp between 20% and 80%
              setLeftSplit(Math.max(0.2, Math.min(percentage, 0.8)));
          }
      };
      
      const handleMouseUp = () => {
          setIsResizing(null);
          setIsResizingSplit(false);
          document.body.style.cursor = 'default';
          document.body.style.userSelect = 'auto';
      };

      if (isResizing || isResizingSplit) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = isResizing ? 'col-resize' : 'row-resize';
          document.body.style.userSelect = 'none';
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          document.body.style.cursor = 'default';
          document.body.style.userSelect = 'auto';
      };
  }, [isResizing, isResizingSplit]);


  const activeArrangement = useMemo(() => 
    arrangements.find(a => a.id === activeArrangementId), 
  [arrangements, activeArrangementId]);

  const activeProject = useMemo(() => projects.find(p => p.id === currentProjectId), [projects, currentProjectId]);

  // Run the Agent Logic
  const alerts = useMemo(() => activeArrangement ? generateAlerts(activeArrangement) : [], [activeArrangement]);

  // Derived Objects from Selection (For single item view)
  const singleSelectedEntity = selectedEntities.length === 1 ? selectedEntities[0] : null;

  const selectedRule = useMemo(() => 
    singleSelectedEntity?.type === EntityType.RULE && activeArrangement
      ? activeArrangement.container.activeRules?.find(r => r.id === singleSelectedEntity.id)
      : null,
  [singleSelectedEntity, activeArrangement]);

  const selectedPredicate = useMemo(() => 
    singleSelectedEntity?.type === EntityType.PREDICATE && activeArrangement
      ? activeArrangement.predicates.find(p => p.id === singleSelectedEntity.id)
      : null,
  [singleSelectedEntity, activeArrangement]);

  const selectedService = useMemo(() => 
    singleSelectedEntity?.type === EntityType.SERVICE && activeArrangement
      ? activeArrangement.services.find(s => s.id === singleSelectedEntity.id)
      : null,
  [singleSelectedEntity, activeArrangement]);

  // DERIVE RULE STATUSES
  const evaluatedRules: EvaluatedRule[] = useMemo(() => {
    if (!activeArrangement) return [];
    return (activeArrangement.container.activeRules || []).map(rule => {
        const relevantAlerts = alerts.filter(a => a.provenance.includes(rule.id));
        let status: 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_EVALUATED' = 'PASSED';
        if (relevantAlerts.some(a => a.severity === ImpactLevel.PROHIBITIVE)) status = 'FAILED';
        else if (relevantAlerts.some(a => a.severity === ImpactLevel.UNDESIRABLE)) status = 'WARNING';
        else {
             const isActive = activeArrangement.services.some(s => 
                s.attributes.some(attr => rule.matcherKeywords.some(k => attr.includes(k))) ||
                (rule.matcherKeywords.includes('Legacy') && s.type === 'LEGACY_SYSTEM')
             );
             if (!isActive) status = 'NOT_EVALUATED';
        }
        return { ...rule, status, matchingServices: [] };
    });
  }, [activeArrangement, alerts]);

  // DYNAMIC HIGHLIGHT LOGIC (Synchronized Selection)
  // Which services are relevant based on ALL currently selected entities?
  const highlightedServiceIds = useMemo(() => {
    if (!activeArrangement) return [];
    // Collect alerts relevant to ANY selected entity
    const relevantAlerts = alerts.filter(a => 
        selectedEntities.some(e => a.provenance.includes(e.id))
    );
    
    // Services directly selected
    const directServices = selectedEntities
        .filter(e => e.type === EntityType.SERVICE)
        .map(e => e.id);

    // Services mentioned in relevant alerts
    const alertServices = relevantAlerts.flatMap(a => a.provenance);

    // Services matched by selected Rules
    const matchedServices = activeArrangement.services.filter(s => {
        return selectedEntities.some(e => {
            if(e.type !== EntityType.RULE) return false;
            const r = activeArrangement.container.activeRules?.find(rule => rule.id === e.id);
            if(!r) return false;
             return s.attributes.some(attr => r.matcherKeywords.some(kw => attr.includes(kw))) ||
                   (r.matcherKeywords.includes('Legacy') && s.type === 'LEGACY_SYSTEM') ||
                   (r.matcherKeywords.includes('AI') && s.attributes.includes('AI'));
        })
    }).map(s => s.id);

    return Array.from(new Set([...directServices, ...alertServices, ...matchedServices]));
  }, [alerts, selectedEntities, activeArrangement]);

  // Actions
  const handleFork = () => {
    if(!activeArrangement) return;
    const newId = `hyp-${Date.now()}`;
    const fork: Arrangement = {
      ...activeArrangement,
      id: newId,
      name: `${activeArrangement.name} (Fork)`,
      services: activeArrangement.services.map(s => ({...s})),
      container: {
        ...activeArrangement.container,
        id: `cont-${Date.now()}`,
        versionLabel: 'V2.x Draft',
        hypothesisName: 'Experimental Branch',
        description: 'Testing new service configurations.'
      },
      predicates: [...(activeArrangement.predicates || [])],
      parentId: activeArrangement.id,
      createdAt: Date.now(),
    };
    
    // Optimistic UI Update
    setArrangements(prev => [...prev, fork]);
    setActiveArrangementId(newId);
    
    // Persist to DB
    db.saveFork(fork).catch(e => console.error("Failed to save fork", e));
  };

  const handleEntityClick = (type: EntityType, id: string, multiSelect: boolean) => {
    if (!id) {
        // Clear selection
        setSelectedEntities([]);
        return;
    }
    setSelectedEntities(prev => {
        const exists = prev.find(e => e.id === id && e.type === type);
        let newSelection;
        if (multiSelect) {
            // Toggle
            if (exists) newSelection = prev.filter(e => !(e.id === id && e.type === type));
            else newSelection = [...prev, { type, id }];
        } else {
            // Replace or Toggle Off if same single
            if (exists && prev.length === 1) newSelection = [];
            else newSelection = [{ type, id }];
        }
        return newSelection;
    });
  };

  const handleUpdateRule = (updatedRule: Rule) => {
      setArrangements(prev => prev.map(a => {
          if (a.id !== activeArrangement!.id) return a;
          const rules = a.container.activeRules || [];
          return {
              ...a,
              container: {
                  ...a.container,
                  activeRules: rules.map(r => r.id === updatedRule.id ? updatedRule : r)
              }
          };
      }));
  };

  // BACKGROUND AGENT LOOP
  useEffect(() => {
    if (isAgentPaused) return;

    const backgroundAgentLoop = setInterval(async () => {
        const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.API_KEY);
        // Only run if AI is loaded (local), Gemini is available, and DB ready
        if ((ai.isLoaded || hasGemini) && db.isReady && activeProject && activeArrangement) {
            
            const entityNames = activeArrangement.services.map(s => s.name);
            const domain = activeProject.domain;
            
            // Pass hasGemini toggle
            const suggestionText = await ai.generateCreativeSuggestion(domain, entityNames, hasGemini);
            
            if (suggestionText && suggestionText.length > 5) {
                // Heuristic Parsing
                const type = suggestionText.toLowerCase().includes('rule') ? 'RULE' : 
                             suggestionText.toLowerCase().includes('service') ? 'SERVICE' : 'HYPOTHESIS';
                
                await db.saveSuggestion({
                    id: `sug-${Date.now()}`,
                    projectId: activeProject.id,
                    type,
                    content: suggestionText,
                    reasoning: hasGemini ? 'Generated by Gemini-3.1-Pro boundary agent' : 'Generated by Local Background Agent (Flan-T5)',
                    status: 'PENDING',
                    createdAt: Date.now()
                });
            }
        }
    }, 15000); // Run every 15 seconds (Faster for demo)

    return () => clearInterval(backgroundAgentLoop);
  }, [ai.isLoaded, db.isReady, activeProject, activeArrangement, isAgentPaused]);


  // Context Menu Handlers
  const handleNodeContextMenu = (event: React.MouseEvent, type: EntityType, id: string) => {
      setContextMenu({
          visible: true,
          x: event.pageX,
          y: event.pageY,
          id,
          type
      });
  };

  const handleContextAction = (action: 'DETAILS' | 'DEBUG') => {
      if (!contextMenu.id || !contextMenu.type) return;
      
      const targetId = contextMenu.id;
      const targetType = contextMenu.type;

      if (action === 'DETAILS') {
          handleEntityClick(targetType, targetId, false);
      } else if (action === 'DEBUG') {
          // Generate Prompt Context for SQL fix interventions
          let promptContext = `Generate a DuckDB SQL fix intervention command to resolve the architectural issue with component ${targetId}. `;
          
          if (targetType === EntityType.SERVICE) {
              const svc = activeArrangement?.services.find(s => s.id === targetId);
              if (svc) promptContext += `Service Name: "${svc.name}", Type: ${svc.type}, Attributes: [${svc.attributes.join(', ')}]. Provide an INSERT or UPDATE statement (e.g. to insert an auditing or safety continuity service node) matching the schema representation to solve any vulnerability.`;
          } else if (targetType === EntityType.RULE) {
              const rule = activeArrangement?.container.activeRules?.find(r => r.id === targetId);
              if (rule) promptContext += `Rule Name: "${rule.name}", Priority: ${rule.priority}. Matchers: [${rule.matcherKeywords.join(', ')}]. Provide a SQL state change or update to rules definitions if applicable.`;
          }

          setAiPromptRequest(promptContext); // Send to Terminal Panel
      }
      setContextMenu({ ...contextMenu, visible: false });
  };

  // Canvas size calculation
  // If rightPinned is TRUE, we subtract its width to shift layout. 
  // If FALSE, it overlays, so we don't subtract.
  const canvasWidth = windowSize.w - (leftOpen ? leftWidth : 0); // Removed pinned subtraction logic to make it float

  if (!db.isReady) return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-white">Initializing Engine...</div>;

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
      
      {/* LEFT Sidebar: Components & Details */}
      <div 
        ref={leftSidebarRef}
        className="border-r border-slate-800 flex flex-col bg-slate-950 flex-shrink-0 z-20 shadow-xl relative overflow-hidden"
        style={{ width: leftOpen ? leftWidth : 0, transition: isResizing ? 'none' : 'width 300ms ease-in-out' }}
      >
        {/* Fixed Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-start shrink-0 h-14">
            <div>
                <div className="flex items-center gap-2 text-indigo-400 font-bold tracking-tight mb-2">
                <Box size={18} /> HYPOTHESIS EXPLORER
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setIsAgentPaused(!isAgentPaused)} 
                    className={`flex items-center justify-center p-1 rounded text-xs font-bold transition-colors ${
                        isAgentPaused ? 'text-amber-500 bg-amber-950 hover:bg-amber-900' : 'text-emerald-500 bg-emerald-950 hover:bg-emerald-900'
                    }`}
                    title={isAgentPaused ? "Resume Background Agent" : "Pause Background Agent"}
                >
                    {isAgentPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button 
                    onClick={() => setLeftOpen(false)} 
                    className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800"
                    title="Collapse Sidebar"
                >
                    <ChevronsLeft size={16} />
                </button>
            </div>
        </div>

        {/* Fixed Tab Bar (Top Pane Control) */}
        <div className="flex border-b border-slate-800 bg-slate-900 shrink-0">
            <button 
                onClick={() => { setActiveLeftTab('ARCHITECTURE'); setViewMode('TOPOLOGY'); }}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeLeftTab === 'ARCHITECTURE' ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Layers size={14} /> Stack
            </button>
            <button 
                onClick={() => { setActiveLeftTab('RULES'); setViewMode('LOGIC'); }}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeLeftTab === 'RULES' ? 'text-pink-400 border-b-2 border-pink-500 bg-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Network size={14} /> Logic
            </button>
        </div>

        {/* SPLIT CONTAINER */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {/* TOP PANE: Scrollable List (Architecture or Rules) */}
            <div 
                style={{ flexBasis: `${leftSplit * 100}%` }} 
                className="flex flex-col min-h-0 shrink-0"
            >
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
                    {/* 1. Architecture View */}
                    {activeLeftTab === 'ARCHITECTURE' && activeArrangement && (
                        <div className="p-4 space-y-1">
                            {activeArrangement.services.map(svc => {
                                const isSelected = selectedEntities.some(e => e.id === svc.id && e.type === EntityType.SERVICE);
                                return (
                                <div 
                                    key={svc.id} 
                                    onClick={(e) => handleEntityClick(EntityType.SERVICE, svc.id, e.ctrlKey || e.metaKey)}
                                    className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg z-10'
                                            : highlightedServiceIds.includes(svc.id) 
                                                ? 'bg-indigo-900/40 border-indigo-500/50 text-white shadow' 
                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <span className="truncate">{svc.name}</span>
                                    {svc.isExperimental && <span className="text-[9px] bg-amber-900 text-amber-500 px-1 rounded flex-shrink-0">EXP</span>}
                                </div>
                            )})}
                        </div>
                    )}

                    {/* 2. Rules View */}
                    {activeLeftTab === 'RULES' && activeArrangement && (
                        <div className="p-4 space-y-1">
                            {evaluatedRules.map(r => {
                                const isSelected = selectedEntities.some(e => e.id === r.id && e.type === EntityType.RULE);
                                let statusColor = "bg-slate-700";
                                if (r.status === 'FAILED') statusColor = "bg-red-500";
                                if (r.status === 'WARNING') statusColor = "bg-amber-500";
                                if (r.status === 'PASSED') statusColor = "bg-emerald-500";

                                return (
                                    <div 
                                        key={r.id} 
                                        onClick={(e) => handleEntityClick(EntityType.RULE, r.id, e.ctrlKey || e.metaKey)}
                                        className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-all ${
                                            isSelected
                                                ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg z-10'
                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} flex-shrink-0`} />
                                            <span className="truncate">{r.name}</span>
                                        </div>
                                        <span className="text-[9px] font-bold opacity-50 flex-shrink-0">{r.priority[0]}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* HORIZONTAL RESIZER */}
            <div 
                className="h-1 bg-slate-800 hover:bg-indigo-500 cursor-row-resize flex-shrink-0 z-30 flex items-center justify-center group transition-colors"
                onMouseDown={() => setIsResizingSplit(true)}
            >
                <div className="w-8 h-1 rounded-full bg-slate-600 group-hover:bg-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* BOTTOM PANE: INSPECTOR / IMPACT PANEL (LEFT) */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-950/30 border-t border-slate-800">
                {activeArrangement ? (
                    <InspectorPanel 
                        activeArrangement={activeArrangement}
                        selectedEntities={selectedEntities}
                        alerts={alerts}
                        onEntityClick={handleEntityClick}
                        onUpdateRule={handleUpdateRule}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-600 text-xs italic">
                        No active configuration.
                    </div>
                )}
            </div>
        </div>

        {/* Sidebar Vertical Drag Handle (Width) */}
        <div 
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-500 transition-colors z-30 group flex items-center justify-center"
            onMouseDown={() => setIsResizing('LEFT')}
        >
             <div className="h-8 w-4 bg-slate-800 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center shadow absolute -right-2 pointer-events-none">
                <GripVertical size={12} className="text-slate-400" />
             </div>
        </div>
      </div>
      
      {/* Re-Open Left Sidebar Button */}
      {!leftOpen && (
        <div className="absolute left-2 top-20 z-40">
             <button 
                onClick={() => setLeftOpen(true)}
                className="p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded shadow-lg"
                title="Expand Sidebar"
             >
                 <ChevronsRight size={16} />
             </button>
        </div>
      )}

      {/* Main Visual Canvas Area */}
      <div className="flex-1 flex flex-col relative bg-slate-900 pb-10 min-w-0 transition-all duration-300">
        
        {/* Top Bar */}
        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/80 backdrop-blur z-10 transition-all">
            <div className="flex bg-slate-800 rounded p-1">
                <button 
                    onClick={() => { setViewMode('TOPOLOGY'); setActiveLeftTab('ARCHITECTURE'); }}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all ${viewMode === 'TOPOLOGY' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Layers size={14} /> ARCHITECTURE MAP
                </button>
                <button 
                    onClick={() => { setViewMode('LOGIC'); setActiveLeftTab('RULES'); }}
                    className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all ${viewMode === 'LOGIC' ? 'bg-indigo-900/80 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Network size={14} /> LOGIC & RULES
                </button>
            </div>

            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setShowComparison(true)}
                    className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                    disabled={!activeArrangement}
                >
                    <Maximize2 size={14} /> Compare
                </button>
            </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative bg-slate-950 overflow-hidden">
            {activeArrangement ? (
                viewMode === 'TOPOLOGY' ? (
                    <GraphCanvas 
                        key={`topo-${activeArrangement.id}`}
                        arrangement={activeArrangement}
                        width={canvasWidth} 
                        height={windowSize.h - 60} 
                        onNodeClick={handleEntityClick}
                        onNodeContextMenu={handleNodeContextMenu}
                        highlightedServiceIds={highlightedServiceIds}
                        selectedEntityIds={selectedEntities.map(e => e.id)}
                        alerts={alerts}
                    />
                ) : (
                    <RulesCanvas 
                        key={`logic-${activeArrangement.id}`}
                        arrangement={activeArrangement}
                        evaluatedRules={evaluatedRules} 
                        width={canvasWidth}
                        height={windowSize.h - 60}
                        onNodeClick={handleEntityClick}
                        selectedEntityIds={selectedEntities.map(e => e.id)}
                    />
                )
            ) : (
                <EmptyState onOpenRegistry={() => setExpandRegistry(true)} />
            )}
        </div>
      </div>

       {/* RIGHT Sidebar: Hypothesis Selector & Fork - NOW A FLOATING PANEL */}
       <div 
        className={`fixed right-4 top-16 bottom-4 bg-slate-950/95 backdrop-blur z-[60] shadow-2xl rounded-xl border border-slate-700 transition-transform duration-300 flex flex-col overflow-hidden ${rightOpen || rightPinned ? 'translate-x-0' : 'translate-x-[110%]'}`}
        style={{ width: rightWidth }}
      >
        {/* Toggle / Pin Tab (Inside Panel for cleaner look) */}
        <div className="absolute top-4 right-4 z-50 flex gap-2">
             <button
                onClick={() => setRightPinned(!rightPinned)}
                className={`p-1.5 rounded transition-colors ${rightPinned ? 'text-indigo-400 bg-indigo-900/20' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                title="Pin Panel"
             >
                 <Pin size={14} className={rightPinned ? "fill-indigo-400" : ""} />
             </button>
             {!rightPinned && (
                 <button onClick={() => setRightOpen(false)} className="text-slate-500 hover:text-white p-1.5 rounded hover:bg-slate-800">
                     <PanelRightClose size={14}/>
                 </button>
             )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden w-full relative">
            
             {/* Resize Handle */}
             <div 
                className="absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-indigo-500 transition-colors z-40 group flex items-center justify-center"
                onMouseDown={() => setIsResizing('RIGHT')}
            >
                 <div className="h-8 w-1 bg-slate-600 rounded opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0 h-14">
                <div className="flex items-center gap-2 text-indigo-400 font-bold tracking-tight">
                   <GitBranch size={18} /> HYPOTHESIS CONTROL
                </div>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                 {/* MOVED: Hypothesis Details */}
                 {activeArrangement && (
                    <div className="bg-slate-900 p-4 rounded border border-slate-800 shadow-sm">
                        <h2 className="text-lg font-bold text-white mb-1">{activeArrangement.container.versionLabel}</h2>
                        <p className="text-sm text-indigo-300 font-medium mb-2">"{activeArrangement.container.hypothesisName}"</p>
                        <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-slate-700 pl-3">
                            {activeArrangement.container.description}
                        </p>
                    </div>
                 )}

                 {/* Project Selection */}
                 <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase block mb-3 flex items-center gap-2">
                        <Box size={12}/> Active Project
                     </label>
                     <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden">
                        {projects.length > 0 ? projects.map(p => (
                             <div 
                                key={p.id}
                                onClick={() => setCurrentProjectId(p.id)}
                                className={`p-3 cursor-pointer border-b border-slate-800 last:border-0 hover:bg-slate-800 transition-colors ${currentProjectId === p.id ? 'bg-indigo-900/20 border-l-2 border-l-indigo-500' : 'text-slate-400'}`}
                             >
                                 <div className="text-xs font-bold text-slate-200">{p.name}</div>
                                 <div className="text-[10px] text-slate-500 mt-1">{p.domain}</div>
                             </div>
                        )) : (
                            <div className="p-4 text-center text-xs text-slate-500 italic">No projects loaded.</div>
                        )}
                     </div>
                 </div>

                 {/* Hypothesis Selection */}
                 {activeArrangement && (
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-3 flex items-center gap-2">
                            <Layers size={12}/> Exploration Branches
                        </label>
                        <ForkTree 
                            arrangements={arrangements} 
                            activeId={activeArrangementId} 
                            onSelect={setActiveArrangementId} 
                        />
                        <div className="space-y-2">
                            {arrangements.map(h => (
                                <div 
                                    key={h.id}
                                    onClick={() => setActiveArrangementId(h.id)}
                                    className={`p-3 rounded border cursor-pointer transition-all group ${activeArrangementId === h.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="text-xs font-bold">{h.name}</div>
                                        {activeArrangementId === h.id && <CheckCircle size={12} className="text-indigo-200"/>}
                                    </div>
                                    <div className={`text-[10px] font-mono mb-2 ${activeArrangementId === h.id ? 'text-indigo-200' : 'text-slate-500'}`}>
                                        {h.container.versionLabel}
                                    </div>
                                    {h.parentId && (
                                        <div className={`text-[9px] flex items-center gap-1 ${activeArrangementId === h.id ? 'text-indigo-300' : 'text-slate-600'}`}>
                                            <GitBranch size={10}/>
                                            <span>Forked from parent</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                 )}

                 {/* Actions */}
                 <div className="pt-6 border-t border-slate-800">
                     <button 
                        onClick={handleFork}
                        disabled={!activeArrangement}
                        className={`w-full flex items-center justify-center gap-2 py-3 font-bold rounded shadow-lg transition-all ${activeArrangement ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                    >
                        <GitBranch size={16} />
                        FORK CURRENT STATE
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-3">
                        Creates a new experimental branch preserving the current configuration.
                    </p>
                 </div>
            </div>

        </div>
      </div>

      {/* Floating Trigger for Right Panel (if closed) */}
      {!rightOpen && !rightPinned && activeArrangement && (
          <button 
            onClick={() => setRightOpen(true)}
            className="fixed right-4 top-20 p-2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded shadow-lg z-40 transition-transform hover:scale-110"
            title="Open Control Panel"
          >
              <PanelRightOpen size={20} />
          </button>
      )}

      {/* Comparison Overlay */}
      {showComparison && activeArrangement && (
            <ComparisonView 
                arrangementA={activeArrangement}
                arrangementB={arrangements.find(a => a.id === compareId) || null}
                allArrangements={arrangements}
                onSelectB={setCompareId}
                onClose={() => setShowComparison(false)}
                generateAlerts={generateAlerts}
            />
        )}
      
      {/* GLOBAL TERMINAL PANEL (Bottom System Bar) */}
      <TerminalPanel 
          leftOffset={leftOpen ? leftWidth : 0}
          isSidebarResizing={isResizing === 'LEFT'}
          externalAiRequest={aiPromptRequest}
          currentProjectId={currentProjectId}
          onSelectProject={setCurrentProjectId}
          forceExpandRegistry={expandRegistry}
          onRegistryExpanded={() => setExpandRegistry(false)}
          activeArrangement={activeArrangement}
      />

      {/* CONTEXT MENU */}
      {contextMenu.visible && (
          <div 
            className="fixed bg-slate-800 border border-slate-700 shadow-2xl rounded z-[100] py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
              <div className="px-3 py-1.5 border-b border-slate-700 mb-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Context Action</div>
                  <div className="text-xs text-slate-300 font-mono truncate max-w-[140px]">{contextMenu.id}</div>
              </div>
              
              <button 
                onClick={() => handleContextAction('DETAILS')}
                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
              >
                  <Search size={14} className="text-indigo-400" />
                  Ver Detalhes
              </button>
              
              <button 
                onClick={() => handleContextAction('DEBUG')}
                className="w-full text-left px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2 transition-colors"
              >
                  <Bug size={14} className="text-pink-500" />
                  Corrigir Bug (AI)
              </button>
          </div>
      )}
    </div>
  );
}
