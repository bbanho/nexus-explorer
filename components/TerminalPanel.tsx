
import React, { useState, useEffect, useRef } from 'react';
import { db, TableMetadata } from '../db';
import { ai, RemoteConfig } from '../aiService';
import { Snapshot, Suggestion, Arrangement } from '../types';
import { 
    Terminal, 
    ChevronUp, 
    ChevronDown, 
    Database, 
    Play, 
    Save, 
    Download, 
    Upload, 
    Trash2,
    RefreshCw,
    Bot,
    Activity, 
    Cpu,
    AlertCircle,
    GripVertical,
    FileText,
    Sparkles,
    MoreHorizontal,
    Settings,
    Globe,
    Server,
    MessageSquare,
    TableProperties,
    ChevronRight,
    HardDrive,
    File,
    Lightbulb,
    Code,
    Eraser,
    BrainCircuit,
    ArrowRight,
    Zap,
    Import
} from 'lucide-react';

interface LogEntry {
    id: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
    timestamp: Date;
}

// --- HARDWARE MONITOR ---
const HardwareMonitor = ({ isProcessing, stats, mode }: { isProcessing: boolean, stats: any, mode: string }) => {
    const [computeLoad, setComputeLoad] = useState(0);
    const [memoryUsage, setMemoryUsage] = useState(0);

    useEffect(() => {
        let interval: any;
        const baseMem = mode === 'LOCAL' ? 280 : 45; 

        if (isProcessing) {
            interval = setInterval(() => {
                setComputeLoad(prev => Math.min(prev + Math.random() * 20, 95));
                setMemoryUsage(prev => Math.min(prev + Math.random() * 5, baseMem + 50));
            }, 200);
        } else {
            interval = setInterval(() => {
                setComputeLoad(prev => Math.max(prev - 10, 2));
                setMemoryUsage(prev => Math.max(prev - 10, baseMem)); 
            }, 200);
        }
        return () => clearInterval(interval);
    }, [isProcessing, mode]);

    return (
        <div className="flex gap-2 p-2 bg-slate-950 border-t border-slate-800 items-center w-full text-[10px] font-mono select-none shrink-0 h-8">
            <div className="flex items-center gap-2 w-32">
                <span className={`font-bold flex items-center gap-1 ${isProcessing ? 'text-pink-400 animate-pulse' : 'text-slate-500'}`}>
                    <Activity size={10}/> {isProcessing ? 'COMPUTING' : 'IDLE'}
                </span>
            </div>
            <div className="flex-1 flex items-center gap-2 border-l border-slate-800 pl-2">
                <span className="text-slate-500 flex items-center gap-1"><Cpu size={10}/> LOAD</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 ${computeLoad > 80 ? 'bg-red-500' : computeLoad > 40 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${computeLoad}%` }} />
                </div>
                <span className="w-8 text-right text-slate-400">{Math.round(computeLoad)}%</span>
            </div>
            <div className="flex-1 flex items-center gap-2 border-l border-slate-800 pl-2">
                <span className="text-slate-500 flex items-center gap-1"><Server size={10}/> MEM</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                     <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${Math.min((memoryUsage / 1024) * 100, 100)}%` }} />
                </div>
                <span className="w-12 text-right text-slate-400">{Math.round(memoryUsage)} MB</span>
            </div>
            <div className="flex items-center gap-4 border-l border-slate-800 pl-2 text-slate-500">
                <span title="Total Requests">REQ: {stats.totalRequests}</span>
                <span title="Last Latency" className={stats.lastLatencyMs > 1000 ? 'text-amber-500' : 'text-slate-400'}>{Math.round(stats.lastLatencyMs)}ms</span>
                {stats.failedRequests > 0 && <span className="text-red-500 font-bold flex items-center gap-1"><AlertCircle size={10}/> {stats.failedRequests}</span>}
            </div>
        </div>
    )
}

// --- TABS ---
interface TabItem {
    id: string;
    label: string;
    icon: React.ElementType;
    colorClass: string;
}

interface TerminalPanelProps {
    leftOffset?: number;
    isSidebarResizing?: boolean;
    externalAiRequest?: string;
    currentProjectId?: string;
    onSelectProject?: (id: string) => void;
    forceExpandRegistry?: boolean;
    onRegistryExpanded?: () => void;
    activeArrangement?: Arrangement;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ 
    leftOffset = 0,
    isSidebarResizing = false,
    externalAiRequest = "",
    currentProjectId = "",
    onSelectProject,
    forceExpandRegistry = false,
    onRegistryExpanded,
    activeArrangement
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [panelHeight, setPanelHeight] = useState(360);
    const [isResizingHeight, setIsResizingHeight] = useState(false);

    // UNIFIED TABS
    const [tabs, setTabs] = useState<TabItem[]>([
        { id: 'DATA', label: 'DATA EXPLORER', icon: Database, colorClass: 'bg-sky-900/50 text-sky-200 border-sky-800' },
        { id: 'INTELLIGENCE', label: 'INTELLIGENCE', icon: BrainCircuit, colorClass: 'bg-purple-900/50 text-purple-200 border-purple-800' },
        { id: 'REGISTRY', label: 'REGISTRY', icon: HardDrive, colorClass: 'bg-indigo-900/50 text-indigo-200 border-indigo-800' },
        { id: 'LOGS', label: 'SYSTEM LOGS', icon: Activity, colorClass: 'bg-slate-800 text-slate-400 border-slate-700' }
    ]);
    const [activeTab, setActiveTab] = useState<string>('DATA');
    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

    // --- CONSOLE & SCHEMA STATE ---
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<{type: 'IN'|'OUT'|'ERR', text: string}[]>([
        { type: 'OUT', text: 'DuckDB-Wasm Ready. Type SQL commands...' }
    ]);
    const [schemaMetadata, setSchemaMetadata] = useState<TableMetadata[]>([]);
    const [expandedTables, setExpandedTables] = useState<string[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // --- REGISTRY STATE (Snapshots + Storage) ---
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [storageUsage, setStorageUsage] = useState({ usage: 0, quota: 0 });
    const [virtualFiles, setVirtualFiles] = useState<string[]>([]);
    const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

    // --- INTELLIGENCE STATE (AI + Agents) ---
    const [aiMode, setAiMode] = useState<'LOCAL' | 'REMOTE' | 'GEMINI'>('GEMINI');
    const [isAiModeSelected, setIsAiModeSelected] = useState(false);
    const [showAiSettings, setShowAiSettings] = useState(false); 
    const [generateSqlMode, setGenerateSqlMode] = useState(false); 
    const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>({ baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-3.5-turbo' });
    const [aiLoading, setAiLoading] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [aiOutput, setAiOutput] = useState('');
    const [aiStats, setAiStats] = useState(ai.stats);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

    // --- LOGS STATE ---
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logFilter, setLogFilter] = useState<'ALL'|'ERROR'|'WARN'>('ALL');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // --- EFFECTS ---

    // Data Loaders based on Tab
    useEffect(() => {
        if (activeTab === 'DATA') {
            const fetchSchema = async () => {
                const meta = await db.getDatabaseMetadata();
                setSchemaMetadata(meta);
            };
            fetchSchema();
        }
        if (activeTab === 'REGISTRY') {
            refreshStorageInfo();
        }
        if (activeTab === 'INTELLIGENCE' && currentProjectId) {
            fetchSuggestions();
        }
    }, [activeTab, currentProjectId]);

    // Live Polling for Agents
    useEffect(() => {
        let interval: any;
        if (activeTab === 'INTELLIGENCE' && currentProjectId) {
            // Initial fetch
            fetchSuggestions();
            // Poll every 3s to show activity
            interval = setInterval(fetchSuggestions, 3000);
        }
        return () => clearInterval(interval);
    }, [activeTab, currentProjectId]);

    // External AI Request Handler
    useEffect(() => {
        if (externalAiRequest) {
            setAiInput(externalAiRequest);
            setActiveTab('INTELLIGENCE');
            if (!isExpanded) setIsExpanded(true);
            if (!isAiModeSelected) setIsAiModeSelected(true);
            if (externalAiRequest.toLowerCase().includes('sql') || externalAiRequest.toLowerCase().includes('duckdb') || externalAiRequest.toLowerCase().includes('fix intervention')) {
                setGenerateSqlMode(true);
            } else {
                setGenerateSqlMode(false);
            }
        }
    }, [externalAiRequest]);

    // Force Expand Registry Handler
    useEffect(() => {
        if (forceExpandRegistry) {
            setActiveTab('REGISTRY');
            setIsExpanded(true);
            if(onRegistryExpanded) onRegistryExpanded();
        }
    }, [forceExpandRegistry]);

    // LOGS CAPTURE
    useEffect(() => {
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const addLog = (level: 'INFO'|'WARN'|'ERROR', args: any[]) => {
            const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
            setLogs(prev => {
                const newLog = { 
                    id: Math.random().toString(36).substr(2, 9),
                    level,
                    message,
                    timestamp: new Date()
                };
                return [...prev.slice(-299), newLog]; 
            });
        };

        console.log = (...args) => { addLog('INFO', args); originalLog(...args); };
        console.warn = (...args) => { addLog('WARN', args); originalWarn(...args); };
        console.error = (...args) => { addLog('ERROR', args); originalError(...args); };

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
        };
    }, []);

    // Auto-scroll logs
    useEffect(() => { 
        if (logsEndRef.current && activeTab === 'LOGS') {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, activeTab, logFilter]);

    // Console Auto-scroll
    useEffect(() => { 
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; 
    }, [history]);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingHeight) {
                const newHeight = window.innerHeight - e.clientY;
                setPanelHeight(Math.max(200, Math.min(newHeight, window.innerHeight - 100)));
            }
        };
        const handleMouseUp = () => { setIsResizingHeight(false); document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; };
        if (isResizingHeight) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };
    }, [isResizingHeight]);

    // --- ACTIONS ---

    const fetchSuggestions = async () => {
        if(currentProjectId) {
            const list = await db.getSuggestions(currentProjectId);
            setSuggestions(list);
        }
    };

    const refreshStorageInfo = async () => {
        const est = await db.getStorageEstimate();
        setStorageUsage(est);
        const files = await db.getVirtualFiles();
        setVirtualFiles(files);
        try {
            const snaps = await db.getSnapshots();
            setSnapshots(snaps);
        } catch (e) {
            console.warn("Failed to load snapshots", e);
        }
    };

    const executeCommand = async () => {
        if (!input.trim()) return;
        setHistory(prev => [...prev, { type: 'IN', text: input }]);
        setInput('');
        try {
            const res = await db.execute(input);
            setHistory(prev => [...prev, { type: 'OUT', text: res.length ? JSON.stringify(res, null, 2) : 'Success (No rows)' }]);
            if (input.toLowerCase().includes('create') || input.toLowerCase().includes('drop')) {
                const meta = await db.getDatabaseMetadata();
                setSchemaMetadata(meta);
            }
        } catch (e: any) {
            setHistory(prev => [...prev, { type: 'ERR', text: e.message }]);
        }
    };

    const takeSnapshot = async (desc: string = "Manual Snapshot", isAuto: boolean = false) => {
        try {
            const data = await db.createFullSnapshot();
            const snap: Snapshot = { id: `snap_${Date.now()}`, timestamp: Date.now(), description: desc, data: data, isAuto };
            await db.saveSnapshot(snap);
            setSnapshots(prev => [snap, ...prev]);
            if(!isAuto) setHistory(prev => [...prev, { type: 'OUT', text: `Snapshot created: ${snap.id}` }]);
        } catch (e: any) {
            setHistory(prev => [...prev, { type: 'ERR', text: `Snapshot failed: ${e.message}` }]);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                await db.registerFile(e.target.files[0]);
                await refreshStorageInfo();
                setHistory(prev => [...prev, { type: 'OUT', text: `Uploaded file: ${e.target.files![0].name}` }]);
            } catch (err: any) {
                setHistory(prev => [...prev, { type: 'ERR', text: `Upload failed: ${err.message}` }]);
            }
        }
    };

    const handleDeleteFile = async (name: string) => {
        setConfirmAction({
            message: `Delete virtual file "${name}"? This action is irreversible.`,
            onConfirm: async () => {
                 try {
                     await db.dropFile(name);
                     await refreshStorageInfo();
                 } catch (err: any) { console.error(err); }
            }
        });
    };

    const handleImportFile = async (filename: string) => {
        setConfirmAction({
            message: `Import project from "${filename}"? This will populate the workspace with the selected template configuration.`,
            onConfirm: async () => {
                 try {
                     const content = await db.readFileText(filename);
                     await db.importProject(content);
                     setHistory(prev => [...prev, { type: 'OUT', text: `Successfully imported project from ${filename}` }]);
                     
                     // Try to auto-select the imported project ID
                     try {
                         const parsed = JSON.parse(content);
                         const proj = parsed.project || (parsed.projects && parsed.projects[0]);
                         if (proj && proj.id && onSelectProject) {
                             onSelectProject(proj.id);
                         } else {
                             window.location.reload();
                         }
                     } catch (err) {
                         window.location.reload();
                     }
                 } catch (e: any) {
                     setHistory(prev => [...prev, { type: 'ERR', text: `Import failed: ${e.message}` }]);
                 }
            }
        });
    };

    const restoreSnapshot = async (snap: Snapshot) => {
        setConfirmAction({
            message: `Restore snapshot "${snap.description}"? The current database records will be replaced.`,
            onConfirm: async () => {
                 try {
                     await db.restoreSnapshot(snap.data);
                     window.location.reload();
                 } catch (e: any) {
                     setHistory(prev => [...prev, { type: 'ERR', text: `Restore failed: ${e.message}` }]);
                 }
            }
        });
    };

    const downloadSqlBackup = async () => {
        try {
            const sql = await db.exportDatabaseAsSql();
            const blob = new Blob([sql], { type: 'application/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setHistory(prev => [...prev, { type: 'ERR', text: `Backup failed: ${e.message}` }]);
        }
    };

    const downloadBinaryBackup = async () => {
        try {
            const buffer = await db.exportBinaryBackup();
            if (!buffer) throw new Error("Could not generate binary backup");
            const blob = new Blob([buffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nexus_export_${new Date().toISOString().split('T')[0]}.duckdb`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setHistory(prev => [...prev, { type: 'ERR', text: `Binary backup failed: ${e.message}` }]);
        }
    };

    // AI Logic
    const loadLocalAI = async () => {
        setAiLoading(true);
        try { await ai.load(); setAiStats({...ai.stats}); } 
        catch(e) { console.error(e); }
        finally { setAiLoading(false); }
    };

    const processAI = async () => {
        if (!aiInput.trim()) return;
        setAiLoading(true);
        setAiOutput("Thinking...");
        
        try {
            let res = '';
            let context = '';

            const dbSchemaContext = `
Available DB Tables and Columns for DuckDB:
1. "projects"
   Columns: id (VARCHAR PRIMARY KEY), name (VARCHAR), domain (VARCHAR), description (VARCHAR)
   Example INSERT: INSERT INTO projects VALUES ('proj_1', 'Project A', 'Domain X', 'Desc A');

2. "pipelines"
   Columns: id (VARCHAR PRIMARY KEY), project_id (VARCHAR), name (VARCHAR), parent_id (VARCHAR NULL), created_at (BIGINT), container_json (VARCHAR), predicates_json (VARCHAR), links_json (VARCHAR)
   Note: links_json is a JSON string of external links.

3. "nodes"
   Columns: id (VARCHAR), pipeline_id (VARCHAR), name (VARCHAR), type (VARCHAR), group_name (VARCHAR NULL), is_experimental (BOOLEAN), attributes_json (VARCHAR), PRIMARY KEY(id, pipeline_id)
   Note: attributes_json is a JSON array string of flags/attributes, e.g., '["AI", "Off-Prem"]'.
   Example INSERT: INSERT INTO nodes VALUES ('svc_ai', 'hyp_b_hybrid', 'GenAI Assistant', 'COMPUTE', 'AI Services', TRUE, '["Cloud", "AI"]');

4. "suggestions"
   Columns: id (VARCHAR PRIMARY KEY), project_id (VARCHAR), type (VARCHAR), content (VARCHAR), reasoning (VARCHAR), status (VARCHAR), created_at (BIGINT)
   
5. "snapshots"
   Columns: id (VARCHAR PRIMARY KEY), timestamp (BIGINT), description (VARCHAR), data (VARCHAR), is_auto (BOOLEAN)
`;

            // CONTEXT GATHERING
            if (!generateSqlMode) {
                if (activeArrangement) {
                    context = JSON.stringify({
                        activeArrangement: {
                            id: activeArrangement.id,
                            name: activeArrangement.name,
                            description: activeArrangement.container.description,
                            versionLabel: activeArrangement.container.versionLabel,
                            hypothesisName: activeArrangement.container.hypothesisName,
                            services: activeArrangement.services.map(s => ({
                                id: s.id,
                                name: s.name,
                                type: s.type,
                                attributes: s.attributes,
                                group: s.group,
                                isExperimental: s.isExperimental
                            })),
                            links: activeArrangement.links,
                            activeRules: activeArrangement.container.activeRules.map(r => ({
                                id: r.id,
                                name: r.name,
                                description: r.description,
                                priority: r.priority,
                                matcherKeywords: r.matcherKeywords,
                                predicateIds: r.predicateIds
                            })),
                            predicates: activeArrangement.predicates.map(p => ({
                                id: p.id,
                                label: p.label,
                                description: p.description,
                                category: p.category
                            }))
                        }
                    }, null, 2);
                } else {
                    try {
                        const nodes = await db.execute("SELECT id, name, type, group_name, attributes_json FROM nodes LIMIT 50");
                        const pipelines = await db.execute("SELECT * FROM pipelines LIMIT 1"); 
                        context = JSON.stringify({
                            conceptualNodes: nodes.map(n => ({
                                name: n.name,
                                type: n.type,
                                group: n.group_name,
                                tags: JSON.parse(n.attributes_json)
                            })),
                            predicates: pipelines.length > 0 ? JSON.parse(pipelines[0].predicates_json) : []
                        }, null, 2);
                    } catch (e) {
                        console.warn("Failed to fetch graph context for AI", e);
                    }
                }
            }

            let prompt = aiInput;
            
            if (generateSqlMode) {
                prompt = `You are a strict SQL translation assistant. Translate this natural language request into a valid DuckDB SQL statement: "${aiInput}". Output ONLY the raw SQL query. Do NOT write markdown blocks, explanations or other text.`;
                context = dbSchemaContext; 
            }

            if (aiMode === 'LOCAL') {
                if (!ai.isLoaded) await loadLocalAI();
                if (!generateSqlMode && !prompt.toLowerCase().includes('sql') && !prompt.toLowerCase().includes('translate')) {
                    prompt = `Answer this question: ${prompt}`;
                }
                res = await ai.generate(prompt, context);
            }
            else if (aiMode === 'REMOTE') res = await ai.generateRemote(prompt, remoteConfig, context);
            else if (aiMode === 'GEMINI') res = await ai.generateGemini(prompt, context);
            
            if (generateSqlMode) {
                res = res.replace(/```sql/g, '').replace(/```/g, '').trim();
            }
            setAiOutput(res);
        } catch (e: any) { setAiOutput(`Error: ${e.message}`); } 
        finally { setAiLoading(false); setAiStats({...ai.stats}); }
    };

    const toggleTableCollapse = (tableName: string) => {
        setExpandedTables(prev => 
            prev.includes(tableName) ? prev.filter(t => t !== tableName) : [...prev, tableName]
        );
    };

    // Drag Tabs
    const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedTabId(id); e.dataTransfer.effectAllowed = 'move'; };
    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        if (draggedTabId === id) return;
        const sourceIndex = tabs.findIndex(t => t.id === draggedTabId);
        const targetIndex = tabs.findIndex(t => t.id === id);
        if (sourceIndex === -1 || targetIndex === -1) return;
        const newTabs = [...tabs];
        const [movedTab] = newTabs.splice(sourceIndex, 1);
        newTabs.splice(targetIndex, 0, movedTab);
        setTabs(newTabs);
    };

    return (
        <div 
            className={`fixed bottom-0 right-0 bg-slate-900 border-t border-slate-700 shadow-2xl flex flex-col z-50`}
            style={{ 
                height: isExpanded ? panelHeight : 40,
                left: leftOffset,
                transition: (isSidebarResizing || isResizingHeight) ? 'none' : 'all 300ms ease-in-out'
            }}
        >
            {isExpanded && (
                <div 
                    className="absolute top-0 left-0 right-0 h-1 cursor-row-resize z-50 hover:bg-indigo-500/50 flex justify-center group"
                    onMouseDown={() => setIsResizingHeight(true)}
                >
                     <div className="w-16 h-full bg-slate-700 rounded-b opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <MoreHorizontal size={12} className="text-slate-400"/>
                     </div>
                </div>
            )}

            <div className="h-10 bg-slate-800 flex items-center justify-between shrink-0" onClick={(e) => e.stopPropagation()}>
                <div 
                    className="flex items-center gap-2 px-3 h-full bg-slate-900 border-r border-slate-700 cursor-pointer text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
                </div>

                <div className="flex items-center px-4 gap-2 h-full border-r border-slate-700 mr-2 flex-shrink-0">
                    <Terminal size={14} className="text-indigo-400"/>
                    <span className="text-xs font-bold text-slate-300 tracking-wider">SYSTEM TOOLS</span>
                </div>

                <div className="flex-1 flex items-center gap-0.5 px-2 overflow-x-auto h-full scrollbar-hide">
                    {isExpanded && tabs.map((tab) => (
                        <div
                            key={tab.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, tab.id)}
                            onDragOver={(e) => handleDragOver(e, tab.id)}
                            onDrop={() => setDraggedTabId(null)}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase font-bold cursor-move select-none transition-colors border border-b-0 rounded-t
                                ${activeTab === tab.id ? tab.colorClass : 'bg-slate-900 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800'}
                                ${draggedTabId === tab.id ? 'opacity-50' : ''}
                            `}
                        >
                            <GripVertical size={8} className="text-slate-600" />
                            <tab.icon size={12} />
                            {tab.label}
                        </div>
                    ))}
                </div>
                <div className="px-4 text-[9px] font-mono text-slate-500">v1.1.0</div>
            </div>

            {isExpanded && (
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 relative min-h-0">
                    
                    {/* --- DATA EXPLORER --- */}
                    {activeTab === 'DATA' && (
                        <div className="flex-1 flex w-full min-h-0">
                            {/* Left: Schema Sidebar */}
                            <div className="w-64 border-r border-slate-800 bg-slate-900 flex flex-col min-w-0">
                                <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-bold text-sky-400 flex items-center gap-2"><TableProperties size={14}/> DB Schema</span>
                                    <span className="text-[10px] text-slate-500">{schemaMetadata.length} Tables</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                    {schemaMetadata.length === 0 ? (
                                        <div className="text-center text-slate-600 italic py-4 text-xs">No tables found.</div>
                                    ) : (
                                        <div className="space-y-1">
                                            {schemaMetadata.map((tbl) => {
                                                const isExp = expandedTables.includes(tbl.name);
                                                return (
                                                    <div key={tbl.name} className="border border-slate-800 rounded bg-slate-800/30">
                                                        <div 
                                                            className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-800 transition-colors"
                                                            onClick={() => toggleTableCollapse(tbl.name)}
                                                        >
                                                            <ChevronRight size={12} className={`text-slate-500 transition-transform ${isExp ? 'rotate-90' : ''}`} />
                                                            <span className="text-xs font-mono text-slate-300 truncate">{tbl.name}</span>
                                                        </div>
                                                        {isExp && (
                                                            <div className="pl-6 pr-2 pb-2 text-[10px] font-mono text-slate-500 space-y-0.5">
                                                                {tbl.columns.map(col => (
                                                                    <div key={col.name} className="flex justify-between hover:text-slate-300">
                                                                        <span>{col.name}</span>
                                                                        <span className="text-sky-600">{col.type}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Console */}
                            <div className="flex-1 flex flex-col min-w-0 bg-black/40">
                                <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-1 font-mono text-sm custom-scrollbar">
                                    {history.map((h, i) => (
                                        <div key={i} className={`${h.type === 'IN' ? 'text-slate-400 mt-2' : h.type === 'ERR' ? 'text-red-400' : 'text-emerald-300 whitespace-pre-wrap'}`}>
                                            {h.type === 'IN' ? '> ' : ''}{h.text}
                                        </div>
                                    ))}
                                </div>
                                <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
                                    <span className="text-emerald-500 font-bold">{'>'}</span>
                                    <input 
                                        className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder-slate-600 font-mono text-sm"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && executeCommand()}
                                        placeholder="SELECT * FROM tables..."
                                        autoFocus
                                    />
                                    <button onClick={executeCommand} className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded"><Play size={14}/></button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- UNIFIED INTELLIGENCE --- */}
                    {activeTab === 'INTELLIGENCE' && (
                        <div className="flex-1 flex w-full min-h-0">
                            {/* Left: Chat Interface */}
                            <div className="flex-1 flex flex-col border-r border-slate-800 bg-slate-900 min-w-0 h-full">
                                {!isAiModeSelected ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center h-full">
                                        <Bot size={48} className="text-purple-500 mb-4" />
                                        <h2 className="text-xl font-bold text-white mb-6">Choose AI Backend</h2>
                                        <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
                                            {[
                                                { id: 'GEMINI', icon: Sparkles, color: 'text-sky-500', title: 'Google Gemini', desc: 'Best reasoning & speed.' },
                                                { id: 'LOCAL', icon: Cpu, color: 'text-pink-500', title: 'Local LLM', desc: 'Privacy-first (WASM).' },
                                                { id: 'REMOTE', icon: Globe, color: 'text-emerald-500', title: 'Remote API', desc: 'OpenAI/Claude endpoints.' }
                                            ].map(m => (
                                                <button key={m.id} onClick={() => { setAiMode(m.id as any); setIsAiModeSelected(true); }} className="bg-slate-800 border border-slate-700 p-4 rounded hover:bg-slate-700 hover:border-indigo-500 transition-all flex flex-col items-center gap-2">
                                                    <m.icon className={m.color} size={32} />
                                                    <span className="font-bold text-white">{m.title}</span>
                                                    <span className="text-[10px] text-slate-400">{m.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full">
                                        {/* Chat Header */}
                                        <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-950/50 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${aiMode==='LOCAL'?'text-pink-400 border-pink-900 bg-pink-950/30':aiMode==='GEMINI'?'text-sky-400 border-sky-900 bg-sky-950/30':'text-emerald-400 border-emerald-900 bg-emerald-950/30'}`}>{aiMode}</span>
                                                <button onClick={() => setIsAiModeSelected(false)} className="text-[10px] text-slate-500 hover:text-white underline">Change</button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* SQL Toggle */}
                                                <button 
                                                    onClick={() => setGenerateSqlMode(!generateSqlMode)}
                                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold border transition-all ${generateSqlMode ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                                                    title={generateSqlMode ? "Mode: SQL Generator" : "Mode: Supervisor / Architect"}
                                                >
                                                    <Code size={12} /> {generateSqlMode ? 'SQL GEN' : 'SUPERVISOR'}
                                                </button>
                                                {/* Settings button only for Remote mode now to comply with Gemini SDK guidelines */}
                                                {(aiMode === 'REMOTE') && (
                                                    <button onClick={() => setShowAiSettings(!showAiSettings)} className={`p-1.5 rounded ${showAiSettings ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><Settings size={14} /></button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Settings Overlay (Remote/OpenAI Only) */}
                                        {showAiSettings && aiMode === 'REMOTE' && (
                                            <div className="bg-slate-900/95 border-b border-slate-700 p-4 absolute top-10 left-0 right-0 z-20 shadow-xl">
                                                <div className="mb-2 text-xs font-bold text-slate-400 uppercase">Configuration</div>
                                                <div className="flex gap-2">
                                                    <input className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-xs py-1" placeholder="Base URL" value={remoteConfig.baseUrl} onChange={e => setRemoteConfig({...remoteConfig, baseUrl: e.target.value})} />
                                                    <input type="password" className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 text-xs py-1" placeholder="API Key" value={remoteConfig.apiKey} onChange={e => setRemoteConfig({...remoteConfig, apiKey: e.target.value})} />
                                                    <input className="w-32 bg-slate-800 border border-slate-700 rounded px-2 text-xs py-1" placeholder="Model" value={remoteConfig.model} onChange={e => setRemoteConfig({...remoteConfig, model: e.target.value})} />
                                                </div>
                                                <div className="mt-2 flex justify-end"><button onClick={() => setShowAiSettings(false)} className="text-[10px] text-slate-500 hover:text-white underline">Close</button></div>
                                            </div>
                                        )}

                                        {/* Input/Output */}
                                        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-h-0">
                                            <div className="flex-1 flex flex-col gap-2 relative min-h-0">
                                                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 shrink-0">
                                                    <MessageSquare size={12}/> Input Prompt
                                                </label>
                                                <textarea 
                                                    className="flex-1 bg-slate-800 border border-slate-700 rounded p-3 text-sm text-slate-200 resize-none outline-none focus:border-indigo-500 font-mono"
                                                    placeholder={generateSqlMode ? "Describe the data you want..." : "Analyze the current hypothesis..."}
                                                    value={aiInput}
                                                    onChange={e => setAiInput(e.target.value)}
                                                    onKeyDown={(e) => { if(e.key === 'Enter' && (e.ctrlKey || e.metaKey)) processAI(); }}
                                                />
                                                <button 
                                                    onClick={processAI} 
                                                    disabled={aiLoading}
                                                    className={`absolute bottom-3 right-3 p-2 rounded-full ${aiLoading ? 'bg-slate-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white shadow-lg transition-all`}
                                                >
                                                    {aiLoading ? <RefreshCw className="animate-spin" size={16}/> : <ArrowRight size={16}/>}
                                                </button>
                                            </div>
                                            <div className="flex-1 flex flex-col gap-2 min-h-0">
                                                <div className="flex justify-between items-center shrink-0">
                                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2"><Bot size={12}/> Response</label>
                                                    {aiOutput && generateSqlMode && (
                                                        <button 
                                                            onClick={() => { setInput(aiOutput); setActiveTab('DATA'); }} 
                                                            className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900 hover:bg-emerald-900 transition-colors flex items-center gap-1"
                                                        >
                                                            <Play size={10} /> Run SQL
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex-1 bg-black/30 border border-slate-700 rounded p-3 relative overflow-y-auto custom-scrollbar">
                                                    <div className={`text-xs font-mono whitespace-pre-wrap ${generateSqlMode ? 'text-emerald-400' : 'text-slate-300'}`}>
                                                        {aiOutput || <span className="text-slate-600 italic">...</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Agents/Suggestions */}
                            <div className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col h-full min-h-0">
                                <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center shrink-0">
                                    <span className="text-xs font-bold text-amber-400 flex items-center gap-2"><Lightbulb size={14}/> Background Agents</span>
                                    <button onClick={fetchSuggestions} className="text-slate-500 hover:text-white"><RefreshCw size={12}/></button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-black/20">
                                    {suggestions.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-600 italic text-xs gap-2">
                                            <Zap size={20} className="text-slate-700" />
                                            <span>Waiting for agent output...</span>
                                        </div>
                                    ) : (
                                        suggestions.map(s => (
                                            <div key={s.id} className="bg-slate-900 p-3 rounded border border-slate-800 shadow-sm hover:border-amber-500/30 transition-all group animate-in slide-in-from-right-2 duration-300">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide
                                                        ${s.type === 'RULE' ? 'bg-pink-950 text-pink-500 border border-pink-900' :
                                                          s.type === 'SERVICE' ? 'bg-emerald-950 text-emerald-500 border border-emerald-900' :
                                                          'bg-indigo-950 text-indigo-500 border border-indigo-900'}`}>
                                                        {s.type}
                                                    </span>
                                                    <span className="text-[9px] text-slate-600 font-mono">{new Date(s.createdAt).toLocaleTimeString()}</span>
                                                </div>
                                                <div className="text-xs text-slate-200 mb-2 leading-relaxed">
                                                    {s.content}
                                                </div>
                                                <div className="flex items-center gap-2 pt-2 border-t border-slate-800/50">
                                                    <Bot size={10} className="text-slate-600" />
                                                    <span className="text-[9px] text-slate-500 italic">
                                                        {s.reasoning}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- UNIFIED REGISTRY --- */}
                    {activeTab === 'REGISTRY' && (
                        <div className="flex-1 flex w-full min-h-0">
                            {/* Left: Storage & Files */}
                            <div className="flex-1 p-6 border-r border-slate-800 bg-slate-900 flex flex-col gap-6">
                                <div>
                                    <h3 className="font-bold text-purple-400 flex items-center gap-2 mb-4"><HardDrive size={16}/> OPFS Storage</h3>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-xs font-bold text-slate-400">
                                            <span>Usage</span>
                                            <span>{storageUsage.quota > 0 ? Math.round((storageUsage.usage / storageUsage.quota) * 100) : 0}%</span>
                                        </div>
                                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-600 transition-all duration-500" style={{ width: `${storageUsage.quota > 0 ? (storageUsage.usage / storageUsage.quota) * 100 : 0}%` }} />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                                            <span>{(storageUsage.usage / (1024*1024)).toFixed(2)} MB</span>
                                            <span>{(storageUsage.quota / (1024*1024)).toFixed(0)} MB Quota</span>
                                        </div>
                                    </div>
                                    <button onClick={() => refreshStorageInfo()} className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs font-bold text-slate-300 border border-slate-700">
                                        <RefreshCw size={14}/> REFRESH
                                    </button>
                                </div>

                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-slate-300 flex items-center gap-2"><File size={16}/> Virtual Files</h3>
                                        <label className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-[10px] font-bold text-white cursor-pointer">
                                            <Upload size={12} /> UPLOAD
                                            <input type="file" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded overflow-y-auto p-2 custom-scrollbar">
                                        {virtualFiles.length === 0 ? (
                                            <div className="text-center text-slate-600 italic py-10">No files in DuckDB FS.</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {virtualFiles.map(file => (
                                                    <div key={file} className="flex items-center justify-between p-2 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 group">
                                                        <div className="flex items-center gap-2">
                                                            <FileText size={14} className="text-slate-400"/>
                                                            <span className="text-xs font-mono text-slate-300 truncate max-w-[150px]">{file}</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {file.endsWith('.json') && (
                                                                <button onClick={() => handleImportFile(file)} className="text-emerald-500 hover:text-white" title="Import Template">
                                                                    <Import size={12}/>
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleDeleteFile(file)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12}/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Snapshots */}
                            <div className="w-96 bg-slate-950 flex flex-col p-6">
                                <h3 className="font-bold text-indigo-400 flex items-center gap-2 mb-4"><Database size={16}/> State Registry</h3>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    <button onClick={() => takeSnapshot("Manual Backup")} className="flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white"><Save size={14}/> SNAPSHOT</button>
                                    <button onClick={downloadSqlBackup} className="flex items-center justify-center gap-2 py-2 bg-sky-700 hover:bg-sky-600 rounded text-xs font-bold text-white"><Download size={14}/> EXPORT SQL</button>
                                </div>
                                <div className="grid grid-cols-1 mb-6">
                                    <button onClick={downloadBinaryBackup} className="flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-xs font-bold text-emerald-400"><Download size={14}/> EXPORT DUCKDB BINARY</button>
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Timeline</h4>
                                    <div className="space-y-2">
                                        {snapshots.map(snap => (
                                            <div key={snap.id} className="bg-slate-900 p-3 rounded border border-slate-800 flex justify-between items-center group hover:border-indigo-500/50 transition-colors">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-200 text-xs">{snap.description}</span>
                                                        {snap.isAuto && <span className="text-[9px] bg-slate-800 px-1 rounded text-slate-500">AUTO</span>}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 font-mono">{new Date(snap.timestamp).toLocaleString()}</div>
                                                </div>
                                                <button onClick={() => restoreSnapshot(snap)} className="p-1.5 bg-emerald-900/30 text-emerald-400 rounded hover:bg-emerald-900/50 opacity-0 group-hover:opacity-100 transition-all"><RefreshCw size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SYSTEM LOGS --- */}
                    {activeTab === 'LOGS' && (
                        <div className="flex-1 flex flex-col bg-slate-950 min-h-0">
                            <div className="h-10 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Activity size={14} className="text-slate-400" />
                                    <span className="text-xs font-bold text-slate-300">SYSTEM LOG STREAM</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setLogs([])} className="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800" title="Clear Logs"><Eraser size={14}/></button>
                                    <div className="h-4 w-px bg-slate-700 mx-2"/>
                                    {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map(f => (
                                        <button 
                                            key={f} 
                                            onClick={() => setLogFilter(f as any)}
                                            className={`text-[9px] font-bold px-2 py-0.5 rounded transition-colors ${logFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 font-mono text-[10px] space-y-0.5 bg-black/80">
                                {logs.filter(l => logFilter === 'ALL' || l.level === logFilter).map((log) => (
                                    <div key={log.id} className="flex gap-2 hover:bg-white/5 px-2 py-0.5 rounded">
                                        <span className="text-slate-600 shrink-0 w-16">{log.timestamp.toLocaleTimeString().split(' ')[0]}</span>
                                        <span className={`font-bold shrink-0 w-12 ${log.level === 'INFO' ? 'text-sky-500' : log.level === 'WARN' ? 'text-amber-500' : 'text-red-500'}`}>{log.level}</span>
                                        <span className="text-slate-300 break-all">{log.message}</span>
                                    </div>
                                ))}
                                <div ref={logsEndRef} />
                            </div>
                        </div>
                    )}

                    {/* Footer: Hardware Monitor */}
                    <HardwareMonitor isProcessing={aiLoading} stats={aiStats} mode={aiMode} />

                    {confirmAction && (
                        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center z-[60] p-4">
                            <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                                <h3 className="text-sm font-bold text-slate-100 mb-2">Confirmation Required</h3>
                                <p className="text-xs text-slate-400 mb-5 leading-relaxed">{confirmAction.message}</p>
                                <div className="flex justify-end gap-3">
                                    <button 
                                        onClick={() => setConfirmAction(null)} 
                                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded text-xs font-semibold transition-colors border border-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => {
                                            confirmAction.onConfirm();
                                            setConfirmAction(null);
                                        }} 
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold shadow-lg transition-colors border border-indigo-500"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
