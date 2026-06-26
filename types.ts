
export enum EntityType {
  CONTAINER = 'CONTAINER',
  SERVICE = 'SERVICE',
  RULE = 'RULE',
  PREDICATE = 'PREDICATE',
  SUGGESTION = 'SUGGESTION'
}

// The Prompt's specific Semantic States
export enum ImpactLevel {
  PROHIBITIVE = 'PROHIBITIVE', // Blocker / Critical Risk
  UNDESIRABLE = 'UNDESIRABLE', // Warning / Tech Debt
  ACCEPTABLE = 'ACCEPTABLE',   // Validated
  NEUTRAL = 'NEUTRAL'          // Informational
}

export enum AlertType {
  STRATEGIC_RISK = 'STRATEGIC_RISK',
  OPERATIONAL_IMPLICATION = 'OPERATIONAL_IMPLICATION'
}

export enum ServiceType {
  INFRASTRUCTURE = 'INFRA',
  DATA = 'DATA_STORE',
  COMPUTE = 'COMPUTE',
  HUMAN = 'HUMAN_PROCESS',
  INTERFACE = 'INTERFACE',
  LEGACY = 'LEGACY_SYSTEM'
}

export interface Predicate {
  id: string;
  label: string;
  description: string;
  category: 'SECURITY' | 'CLINICAL' | 'OPERATIONAL' | 'HUMAN' | 'PERFORMANCE' | 'FINANCIAL';
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  priority: 'MUST' | 'SHOULD';
  matcherKeywords: string[]; // Simple keywords for this prototype to find services
  predicateIds: string[];
  operator?: 'AND' | 'OR'; // Logical grouping for visual graph
}

export interface EvaluatedRule extends Rule {
  status: 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_EVALUATED';
  matchingServices: string[];
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  type: AlertType;
  severity: ImpactLevel;
  provenance: string[]; // IDs of services/rules that caused this
  impactArea: 'REGULATORY' | 'COST' | 'LATENCY' | 'SECURITY';
}

export interface ExternalService {
  id: string;
  name: string;
  type: ServiceType;
  attributes: string[]; // Tags like "AI", "Off-Prem", "High-Cost"
  group?: string; // For visual clustering (e.g. "Path A", "Input Cluster")
  isExperimental: boolean;
  // In a real agent, these would be derived. Here we store intrinsic properties.
  intrinsicRisks?: string[]; 
}

export interface Link {
  source: string;
  target: string;
  label?: string;
  type?: 'DATA' | 'CONTROL' | 'DEPENDENCY';
}

export interface ContainerVersion {
  id: string;
  versionLabel: string; 
  hypothesisName: string;
  description: string;
  activeRules: Rule[];
}

export interface Arrangement {
  id: string;
  projectId: string;
  name: string;
  container: ContainerVersion;
  services: ExternalService[]; 
  links: Link[]; // EXPLICIT TOPOLOGY
  predicates: Predicate[];
  parentId?: string; 
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  description: string;
}

export interface Snapshot {
    id: string;
    timestamp: number;
    description: string;
    data: string; // Serialized JSON of the DB state
    isAuto: boolean;
}

export interface Suggestion {
    id: string;
    projectId: string;
    type: 'RULE' | 'SERVICE' | 'HYPOTHESIS';
    content: string;
    reasoning: string;
    status: 'PENDING' | 'ACCEPTED' | 'ARCHIVED';
    createdAt: number;
}
