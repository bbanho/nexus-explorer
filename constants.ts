
import { Arrangement, Project, ServiceType, ImpactLevel, Rule, Predicate, ExternalService, Link } from './types';

export const COLORS = {
  container: '#6366f1', 
  service: '#10b981',   
  serviceExperimental: '#f59e0b', 
  
  // Impact Level Colors
  [ImpactLevel.PROHIBITIVE]: '#ef4444', // Red
  [ImpactLevel.UNDESIRABLE]: '#f97316', // Orange
  [ImpactLevel.ACCEPTABLE]: '#10b981',  // Emerald
  [ImpactLevel.NEUTRAL]: '#64748b',     // Slate
  
  predicate: '#8b5cf6',
  rule: '#ec4899'
};

export const PROJECTS: Project[] = [
  { 
    id: 'proj_hospital_base', 
    name: 'Hospital de Base – Infraestrutura Digital', 
    domain: 'Public Health / Critical Infra', 
    description: 'Modernization of a high-volume public hospital. Managing tension between legacy reliability, regulatory sovereignty, and AI innovation.' 
  },
  {
    id: 'proj_ml_audio',
    name: 'Audio Classification Pipeline',
    domain: 'MLOps / Research',
    description: 'End-to-end Machine Learning pipeline for acoustic event detection. Managing trade-offs between feature complexity (Path A vs B) and compute resources.'
  }
];

// --- PREDICATES (The "Laws of Physics" for this domain) ---
const PREDICATES: Predicate[] = [
  // Hospital
  { id: 'p_sov', label: 'Data Residency Preserved', description: 'Patient PII must legally remain within national jurisdiction storage.', category: 'SECURITY' },
  { id: 'p_comp', label: 'Regulatory Compliance Maintained', description: 'Adherence to HIPAA/LGPD standards for all data at rest and in transit.', category: 'SECURITY' },
  { id: 'p_trace', label: 'Clinical Decision Traceable', description: 'Every diagnostic output must be attributable to a licensed professional.', category: 'CLINICAL' },
  { id: 'p_cont', label: '24/7 Operational Continuity', description: 'System must support emergency intake even during internet blackouts.', category: 'OPERATIONAL' },
  { id: 'p_human', label: 'Human Verification Required', description: 'Automated suggestions cannot trigger prescriptions without MD signature.', category: 'HUMAN' },
  { id: 'p_audit', label: 'AI Output Requires Audit', description: 'Stochastic model outputs must be logged and reviewed.', category: 'HUMAN' },
  
  // ML Pipeline
  { id: 'p_data_valid', label: 'Input Data Validity', description: 'Garbage in, garbage out. Raw data must vary sufficiently for training.', category: 'OPERATIONAL' },
  { id: 'p_repro', label: 'Reproducibility', description: 'All transformation steps must be deterministic or seeded.', category: 'CLINICAL' }, 
  { id: 'p_resource', label: 'Resource Budget', description: 'Compute cost must not exceed project allocation.', category: 'FINANCIAL' },
  { id: 'p_arch_cons', label: 'Architectural Consistency', description: 'Components must be mathematically compatible (dimensions, tensors).', category: 'OPERATIONAL' },
  
  // Performance and Cost
  { id: 'p_latency', label: 'Latency Budget Adherence', description: 'Network latency sum across active graph connections must remain under SLAs.', category: 'PERFORMANCE' },
  { id: 'p_cost', label: 'Operational Cost Efficiency', description: 'Cloud API operations and egress costs must be optimized.', category: 'FINANCIAL' }
];

// --- RULES (The Constraints & Tensions) ---
const RULES: Rule[] = [
  // Hospital
  { 
    id: 'r_compliance', 
    name: 'Strict Sovereignty (LGPD)', 
    description: 'If patient data is stored externally, strict regulatory validation is required.', 
    priority: 'MUST',
    matcherKeywords: ['Cloud', 'Off-Prem'], 
    predicateIds: ['p_sov', 'p_comp'],
    operator: 'AND'
  },
  { 
    id: 'r_continuity', 
    name: 'Emergency Continuity', 
    description: 'If system supports Emergency Care, local fallback is mandatory.', 
    priority: 'MUST',
    matcherKeywords: ['Critical', 'Emergency'],
    predicateIds: ['p_cont'],
    operator: 'AND'
  },
  { 
    id: 'r_ai_safe', 
    name: 'AI Clinical Safety', 
    description: 'If AI assists decision, Human-in-the-Loop is mandatory.', 
    priority: 'MUST',
    matcherKeywords: ['AI', 'Stochastic'],
    predicateIds: ['p_human', 'p_audit'],
    operator: 'AND'
  },
  { 
    id: 'r_hybrid', 
    name: 'Hybrid Complexity Cap', 
    description: 'If Legacy and Cloud coexist, synchronization overhead must be managed.', 
    priority: 'SHOULD',
    matcherKeywords: ['Legacy', 'Cloud'], 
    predicateIds: [],
    operator: 'OR'
  },
  { 
    id: 'r_cost', 
    name: 'OpEx/Egress Limit', 
    description: 'If data crosses provider boundaries frequently, cost controls apply.', 
    priority: 'SHOULD',
    matcherKeywords: ['Egress', 'API-Gateway'],
    predicateIds: ['p_cost', 'p_resource'],
    operator: 'OR'
  },
  {
    id: 'r_performance_budget',
    name: 'Strict Latency Constraints',
    description: 'Cloud and heavy compute nodes must be monitored for latency impacts.',
    priority: 'SHOULD',
    matcherKeywords: ['Cloud', 'Heavy-Compute', 'Synchronous', 'Slow'],
    predicateIds: ['p_latency'],
    operator: 'AND'
  },

  // ML Pipeline Rules
  {
    id: 'r_rep_loss',
    name: 'Representation Integrity',
    description: 'Combining high-capacity Models (Transformer) with low-fidelity Preprocessing (Basic SVD) creates an informational bottleneck.',
    priority: 'SHOULD',
    matcherKeywords: ['Transformer', 'SVD'],
    predicateIds: ['p_arch_cons'],
    operator: 'AND'
  },
  {
    id: 'r_norm_safe',
    name: 'Normalization Safety',
    description: 'Training Neural Networks without prior Data Normalization leads to gradient explosions and instability.',
    priority: 'MUST',
    matcherKeywords: ['Training', 'Normalization'],
    predicateIds: ['p_data_valid'],
    operator: 'AND'
  },
  {
    id: 'r_maint_div',
    name: 'Pipeline Divergence',
    description: 'Maintaining divergent preprocessing paths (Path A & Path B) simultaneously creates strategic tech debt.',
    priority: 'SHOULD',
    matcherKeywords: ['Path-A', 'Path-B'],
    predicateIds: ['p_repro'],
    operator: 'AND'
  },
  {
    id: 'r_model_eval',
    name: 'Evaluation Mandatory',
    description: 'A trained model node must have a downstream evaluation node to assess performance metrics.',
    priority: 'MUST',
    matcherKeywords: ['Training', 'Inference'],
    predicateIds: ['p_repro'],
    operator: 'AND'
  }
];

// --- SERVICES (The Blocks) ---

// Hospital Services
const SVC_EMR_CORE: ExternalService = {
  id: 'svc_emr', name: 'Legacy EMR Core (Mainframe)', type: ServiceType.LEGACY,
  attributes: ['On-Prem', 'Legacy', 'Critical', 'SQL-Cluster'], isExperimental: false, group: 'On-Prem Core'
};
const SVC_HL7_ETL: ExternalService = {
  id: 'svc_etl', name: 'HL7 Batch ETL', type: ServiceType.INTERFACE,
  attributes: ['On-Prem', 'Slow', 'Fragile'], isExperimental: false, group: 'Integration'
};
const SVC_VPN: ExternalService = {
  id: 'svc_vpn', name: 'Site-to-Site VPN', type: ServiceType.INFRASTRUCTURE,
  attributes: ['On-Prem', 'Bottleneck', 'Secure'], isExperimental: false, group: 'Network'
};
const SVC_LOCAL_CACHE: ExternalService = {
  id: 'svc_cache', name: 'Emergency Local Cache', type: ServiceType.DATA,
  attributes: ['On-Prem', 'Continuity', 'Sync-Required'], isExperimental: false, group: 'On-Prem Core'
};
const SVC_CLOUD_LAKE: ExternalService = {
  id: 'svc_aws_lake', name: 'Cloud Data Lake (Encrypted)', type: ServiceType.DATA,
  attributes: ['Cloud', 'Off-Prem', 'Scalable', 'Egress'], isExperimental: false, group: 'Cloud Infra'
};
const SVC_AI_TRIAGE: ExternalService = {
  id: 'svc_ai_triage', name: 'GenAI Triage Assistant', type: ServiceType.COMPUTE,
  attributes: ['Cloud', 'AI', 'Stochastic', 'Black-Box'], isExperimental: true, group: 'AI Services'
};
const SVC_SCHEDULING_SAAS: ExternalService = {
  id: 'svc_saas_sched', name: '3rd Party Scheduling SaaS', type: ServiceType.COMPUTE,
  attributes: ['Cloud', 'Off-Prem', 'API-Gateway'], isExperimental: true, group: 'Cloud Infra'
};
const SVC_MD_AUDIT: ExternalService = {
  id: 'svc_human_audit', name: 'Clinical Board Review', type: ServiceType.HUMAN,
  attributes: ['Human-Process', 'Safety-Layer', 'Slow', 'High-Cost'], isExperimental: false, group: 'Governance'
};
const SVC_TECH_OPS: ExternalService = {
  id: 'svc_ops_team', name: '24/7 Ops Center', type: ServiceType.HUMAN,
  attributes: ['Human-Process', 'Operational'], isExperimental: false, group: 'Governance'
};

// ML Pipeline Nodes (Mapped to Services)
// Flow: raw_wavs -> ingest -> pre -> feat -> enc -> builder -> train -> eval -> plot

const NODE_RAW: ExternalService = {
  id: 'node_raw_wavs', name: 'raw_wavs', type: ServiceType.DATA,
  attributes: ['Input', 'SVD-Dataset', 'wav_files'], isExperimental: false, group: 'Input Cluster'
};
const NODE_INGEST: ExternalService = {
  id: 'node_ingest', name: 'ingest', type: ServiceType.INTERFACE,
  attributes: ['IO', 'SVD-Dataset'], isExperimental: false, group: 'Input Cluster'
};
const NODE_PRE: ExternalService = {
  id: 'node_pre', name: 'pre (Normalize)', type: ServiceType.COMPUTE,
  attributes: ['Preprocessing', 'Normalization', 'SVD-Dataset'], isExperimental: false, group: 'Input Cluster'
};

// Path A: Baseline SVD
const NODE_FEAT: ExternalService = {
  id: 'node_feat', name: 'feat (SVD/MFCC)', type: ServiceType.COMPUTE,
  attributes: ['Feature-Eng', 'Path-A', 'SVD', 'Low-Dim', 'features.csv'], isExperimental: false, group: 'Path A (Baseline)'
};

// Path B: Transformer
const NODE_ENC: ExternalService = {
  id: 'node_enc', name: 'enc (Transformer)', type: ServiceType.COMPUTE,
  attributes: ['Transformer', 'Path-B', 'GPU', 'High-Dim', 'Experimental', 'embeddings.csv'], isExperimental: true, group: 'Path B (Transformer)'
};

// Common Downstream
const NODE_BUILDER: ExternalService = {
  id: 'node_builder', name: 'builder (TFRecord)', type: ServiceType.DATA,
  attributes: ['Aggregation', 'TFRecord'], isExperimental: false, group: 'Output Cluster'
};
const NODE_TRAIN: ExternalService = {
  id: 'node_train', name: 'train (Model)', type: ServiceType.COMPUTE,
  attributes: ['Training', 'Stochastic', 'checkpoints'], isExperimental: false, group: 'Output Cluster'
};
const NODE_EVAL: ExternalService = {
  id: 'node_eval', name: 'eval (Metrics)', type: ServiceType.HUMAN, 
  attributes: ['Validation', 'Interpretation', 'metrics.json'], isExperimental: false, group: 'Output Cluster'
};
const NODE_PLOT: ExternalService = {
  id: 'node_plot', name: 'plot (Viz)', type: ServiceType.INTERFACE,
  attributes: ['Reporting', 'confusion.png'], isExperimental: false, group: 'Output Cluster'
};

// --- HYPOTHESES (The Arrangements) ---

export const INITIAL_ARRANGEMENTS: Arrangement[] = [
  // HOSPITAL HYPOTHESES
  {
    id: 'hyp_a_conservative', 
    projectId: 'proj_hospital_base', 
    name: 'A. Modernização Conservadora', 
    createdAt: 1,
    container: { 
      id: 'cont_v1', 
      versionLabel: 'V1.0 - Ironclad', 
      hypothesisName: 'Legacy Extension Strategy',
      description: 'Maximize stability. Keep all PII on-prem. Use VPN for remote access. No AI integration to avoid regulatory risk.',
      activeRules: RULES.filter(r => r.matcherKeywords.includes('Legacy') || r.matcherKeywords.includes('Cloud'))
    },
    services: [SVC_EMR_CORE, SVC_HL7_ETL, SVC_VPN, SVC_TECH_OPS],
    links: [
        { source: 'svc_vpn', target: 'svc_emr', type: 'CONTROL' },
        { source: 'svc_emr', target: 'svc_etl', type: 'DATA' },
        { source: 'svc_etl', target: 'svc_emr', type: 'DATA' },
        { source: 'svc_tech_ops', target: 'svc_emr', type: 'CONTROL' }
    ],
    predicates: PREDICATES.filter(p => p.category !== 'OPERATIONAL' || p.id === 'p_cont')
  },
  {
    id: 'hyp_b_hybrid', 
    projectId: 'proj_hospital_base', 
    name: 'B. Cloud Híbrida + IA Assistiva', 
    createdAt: 2, 
    parentId: 'hyp_a_conservative',
    container: { 
      id: 'cont_v2', 
      versionLabel: 'V2.1 - Intelligent Hybrid', 
      hypothesisName: 'Operational Efficiency via AI',
      description: 'Move historical data to Cloud Lake. Use AI for triage assistance, but enforce strict Human Audit. High integration complexity.',
      activeRules: RULES.filter(r => r.matcherKeywords.includes('Legacy') || r.matcherKeywords.includes('Cloud') || r.matcherKeywords.includes('AI'))
    },
    services: [SVC_EMR_CORE, SVC_CLOUD_LAKE, SVC_AI_TRIAGE, SVC_MD_AUDIT, SVC_LOCAL_CACHE],
    links: [
        { source: 'svc_emr', target: 'svc_aws_lake', type: 'DATA' },
        { source: 'svc_aws_lake', target: 'svc_ai_triage', type: 'DATA' },
        { source: 'svc_ai_triage', target: 'svc_human_audit', type: 'DATA' },
        { source: 'svc_human_audit', target: 'svc_emr', type: 'CONTROL' },
        { source: 'svc_emr', target: 'svc_cache', type: 'DATA' }
    ],
    predicates: PREDICATES.filter(p => p.category !== 'OPERATIONAL' || p.id === 'p_cont')
  },

  // ML PIPELINE HYPOTHESES
  {
    id: 'hyp_ml_baseline',
    projectId: 'proj_ml_audio',
    name: 'Path A: Baseline SVD',
    createdAt: 4,
    container: {
      id: 'cont_ml_v1',
      versionLabel: 'V1.0 - Baseline',
      hypothesisName: 'Classical SVD Feature Extraction',
      description: 'Standard production path. Uses simple deterministic feature extraction (SVD). Low compute cost, highly interpretable.',
      activeRules: RULES.filter(r => r.id.startsWith('r_rep_loss') || r.id.startsWith('r_norm_safe') || r.id.startsWith('r_model_eval'))
    },
    services: [NODE_RAW, NODE_INGEST, NODE_PRE, NODE_FEAT, NODE_BUILDER, NODE_TRAIN, NODE_EVAL, NODE_PLOT],
    links: [
        { source: 'node_raw_wavs', target: 'node_ingest', type: 'DATA' },
        { source: 'node_ingest', target: 'node_pre', type: 'DATA' },
        { source: 'node_pre', target: 'node_feat', type: 'DATA' },
        { source: 'node_feat', target: 'node_builder', type: 'DATA' },
        { source: 'node_builder', target: 'node_train', type: 'DATA' },
        { source: 'node_train', target: 'node_eval', type: 'DATA' },
        { source: 'node_eval', target: 'node_plot', type: 'DATA' }
    ],
    predicates: PREDICATES.filter(p => p.id === 'p_data_valid' || p.id === 'p_repro' || p.id === 'p_arch_cons')
  },
  {
    id: 'hyp_ml_transformer',
    projectId: 'proj_ml_audio',
    name: 'Path B: Transformer',
    createdAt: 5,
    parentId: 'hyp_ml_baseline',
    container: {
      id: 'cont_ml_v2',
      versionLabel: 'V2.0 - Transformer',
      hypothesisName: 'Deep Learning Embedding Injection',
      description: 'Injects "Path B" (Transformer Encoder). Higher accuracy expected but creates dependency on GPU resources.',
      activeRules: RULES.filter(r => r.id.startsWith('r_rep_loss') || r.id.startsWith('r_norm_safe') || r.id.startsWith('r_model_eval'))
    },
    services: [NODE_RAW, NODE_INGEST, NODE_PRE, NODE_ENC, NODE_BUILDER, NODE_TRAIN, NODE_EVAL, NODE_PLOT],
    links: [
        { source: 'node_raw_wavs', target: 'node_ingest', type: 'DATA' },
        { source: 'node_ingest', target: 'node_pre', type: 'DATA' },
        { source: 'node_pre', target: 'node_enc', type: 'DATA' },
        { source: 'node_enc', target: 'node_builder', type: 'DATA' },
        { source: 'node_builder', target: 'node_train', type: 'DATA' },
        { source: 'node_train', target: 'node_eval', type: 'DATA' },
        { source: 'node_eval', target: 'node_plot', type: 'DATA' }
    ],
    predicates: PREDICATES.filter(p => p.id === 'p_data_valid' || p.id === 'p_repro' || p.id === 'p_arch_cons')
  },
  {
    id: 'hyp_ml_conflict',
    projectId: 'proj_ml_audio',
    name: 'Conflict: SVD + Transformer',
    createdAt: 6,
    parentId: 'hyp_ml_transformer',
    container: {
      id: 'cont_ml_v3',
      versionLabel: 'V2.1 - Conflict Draft',
      hypothesisName: 'Architectural Mismatch',
      description: 'Testing what happens if we feed Low-Dim SVD features into the Transformer. Also skipped normalization to save time.',
      activeRules: RULES.filter(r => r.id.startsWith('r_rep_loss') || r.id.startsWith('r_norm_safe') || r.id.startsWith('r_model_eval'))
    },
    // Missing NODE_PRE (No Norm), Has both FEAT (SVD) and ENC (Trans)
    services: [NODE_RAW, NODE_INGEST, NODE_FEAT, NODE_ENC, NODE_BUILDER, NODE_TRAIN, NODE_EVAL], 
    links: [
        { source: 'node_raw_wavs', target: 'node_ingest', type: 'DATA' },
        { source: 'node_ingest', target: 'node_feat', type: 'DATA' }, // Missing PRE
        { source: 'node_feat', target: 'node_enc', type: 'DATA' }, // SVD -> Transformer (Error!)
        { source: 'node_enc', target: 'node_builder', type: 'DATA' },
        { source: 'node_builder', target: 'node_train', type: 'DATA' },
        { source: 'node_train', target: 'node_eval', type: 'DATA' }
    ],
    predicates: PREDICATES.filter(p => p.id === 'p_data_valid' || p.id === 'p_repro' || p.id === 'p_arch_cons')
  },
  {
      id: 'hyp_ml_ab',
      projectId: 'proj_ml_audio',
      name: 'Combined A/B Test',
      createdAt: 7,
      container: {
          id: 'cont_ml_ab',
          versionLabel: 'V3.0 - A/B Suite',
          hypothesisName: 'Simultaneous Execution',
          description: 'Running both paths simultaneously for evaluation. High complexity.',
          activeRules: RULES.filter(r => r.id.startsWith('r_maint_div') || r.id.startsWith('r_model_eval'))
      },
      services: [NODE_RAW, NODE_INGEST, NODE_PRE, NODE_FEAT, NODE_ENC, NODE_BUILDER, NODE_TRAIN, NODE_EVAL, NODE_PLOT],
      links: [
          { source: 'node_raw_wavs', target: 'node_ingest', type: 'DATA' },
          { source: 'node_ingest', target: 'node_pre', type: 'DATA' },
          // Fork
          { source: 'node_pre', target: 'node_feat', type: 'DATA' },
          { source: 'node_pre', target: 'node_enc', type: 'DATA' },
          // Join
          { source: 'node_feat', target: 'node_builder', type: 'DATA' },
          { source: 'node_enc', target: 'node_builder', type: 'DATA' },
          
          { source: 'node_builder', target: 'node_train', type: 'DATA' },
          { source: 'node_train', target: 'node_eval', type: 'DATA' },
          { source: 'node_eval', target: 'node_plot', type: 'DATA' }
      ],
      predicates: PREDICATES.filter(p => p.id === 'p_repro' || p.id === 'p_resource')
  }
];
