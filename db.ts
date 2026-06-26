import * as duckdb from '@duckdb/duckdb-wasm';
import { INITIAL_ARRANGEMENTS, PROJECTS } from './constants';
import { Arrangement, ExternalService, Project, Rule, Predicate, Suggestion } from './types';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

type Listener = () => void;

export interface TableMetadata {
    name: string;
    rowCount: number;
    columns: { name: string; type: string }[];
}

// --- Fallback Storage Data Structures and Accessors ---
interface FallbackProject {
    id: string;
    name: string;
    domain: string;
    description: string;
}

interface FallbackPipeline {
    id: string;
    project_id: string;
    name: string;
    parent_id: string | null;
    created_at: number;
    container_json: string;
    predicates_json: string;
    links_json: string;
}

interface FallbackNode {
    id: string;
    pipeline_id: string;
    name: string;
    type: string;
    group_name: string | null;
    is_experimental: boolean;
    attributes_json: string;
}

interface FallbackSuggestion {
    id: string;
    project_id: string;
    type: string;
    content: string;
    reasoning: string;
    status: string;
    created_at: number;
}

interface FallbackVirtualFile {
    name: string;
    registered_at: number;
    content: string;
}

const getFallbackProjects = (): FallbackProject[] => {
    const raw = localStorage.getItem('hyp_projects');
    return raw ? JSON.parse(raw) : [];
};
const setFallbackProjects = (projects: FallbackProject[]) => {
    localStorage.setItem('hyp_projects', JSON.stringify(projects));
};

const getFallbackPipelines = (): FallbackPipeline[] => {
    const raw = localStorage.getItem('hyp_pipelines');
    return raw ? JSON.parse(raw) : [];
};
const setFallbackPipelines = (pipelines: FallbackPipeline[]) => {
    localStorage.setItem('hyp_pipelines', JSON.stringify(pipelines));
};

const getFallbackNodes = (): FallbackNode[] => {
    const raw = localStorage.getItem('hyp_nodes');
    return raw ? JSON.parse(raw) : [];
};
const setFallbackNodes = (nodes: FallbackNode[]) => {
    localStorage.setItem('hyp_nodes', JSON.stringify(nodes));
};

const getFallbackSuggestions = (): FallbackSuggestion[] => {
    const raw = localStorage.getItem('hyp_suggestions');
    return raw ? JSON.parse(raw) : [];
};
const setFallbackSuggestions = (sugs: FallbackSuggestion[]) => {
    localStorage.setItem('hyp_suggestions', JSON.stringify(sugs));
};

const getFallbackVirtualFiles = (): FallbackVirtualFile[] => {
    const raw = localStorage.getItem('hyp_virtual_files');
    return raw ? JSON.parse(raw) : [];
};
const setFallbackVirtualFiles = (files: FallbackVirtualFile[]) => {
    localStorage.setItem('hyp_virtual_files', JSON.stringify(files));
};

interface FallbackSnapshot {
    id: string;
    timestamp: number;
    description: string;
    data: string;
    isAuto: boolean;
}

const getFallbackSnapshots = (): FallbackSnapshot[] => {
    const raw = localStorage.getItem('hyp_snapshots');
    return raw ? JSON.parse(raw) : [];
};
const setFallbackSnapshots = (snapshots: FallbackSnapshot[]) => {
    localStorage.setItem('hyp_snapshots', JSON.stringify(snapshots));
};


export class DBManager {
  private static instance: DBManager;
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  public isReady: boolean = false;
  public isFallback: boolean = false;
  
  // Cache Store: ProjectID -> Arrangement[]
  private cache: Map<string, Arrangement[]> = new Map();
  
  // Event Listeners
  private listeners: Listener[] = [];

  private constructor() {}

  static getInstance(): DBManager {
    if (!DBManager.instance) {
      DBManager.instance = new DBManager();
    }
    return DBManager.instance;
  }

  // --- Subscription Pattern ---
  public subscribe(listener: Listener): () => void {
      this.listeners.push(listener);
      return () => {
          this.listeners = this.listeners.filter(l => l !== listener);
      };
  }

  private notify() {
      this.listeners.forEach(l => l());
  }

  async init() {
    if (this.db || this.isFallback) return;

    try {
        console.log("Initializing DuckDB-Wasm...");
        // Select bundle
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
        
        const worker = await duckdb.createWorker(bundle.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        
        this.db = new duckdb.AsyncDuckDB(logger, worker);
        await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        this.conn = await this.db.connect();
        
        await this.createSchema();
        await this.seedTemplatesToFS();
        await this.seedDatabase(); // Ensures tables are auto-seeded with standard projects
        
        this.isReady = true;
        this.isFallback = false;
        console.log("DuckDB Initialized successfully");
    } catch (err) {
        console.warn("DuckDB-Wasm initialization failed, falling back to client-side localStorage state engine:", err);
        this.isFallback = true;
        await this.initFallbackSchema();
        this.isReady = true;
    }
    this.notify(); // Notify ready state
  }

  private async createSchema() {
    if (!this.conn) return;

    // 1. Projects Table
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT,
        domain TEXT,
        description TEXT
      );
    `);

    // 2. Pipelines (Arrangements) Table
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        name TEXT,
        parent_id TEXT,
        created_at BIGINT,
        container_json TEXT, -- Stores versionLabel, description, activeRules
        predicates_json TEXT,
        links_json TEXT 
      );
    `);

    // 3. Nodes (Services) Table
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT,
        pipeline_id TEXT,
        name TEXT,
        type TEXT,
        group_name TEXT,
        is_experimental BOOLEAN,
        attributes_json TEXT, -- JSON Array
        PRIMARY KEY (id, pipeline_id)
      );
    `);

    // 4. Suggestions Table (Agent Memory)
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS suggestions (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        type TEXT,
        content TEXT,
        reasoning TEXT,
        status TEXT,
        created_at BIGINT
      );
    `);

    // 5. Virtual Files Tracking Table (to bypass erratic glob functionality)
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS virtual_files (
        name TEXT PRIMARY KEY,
        registered_at BIGINT
      );
    `);

    // 6. Snapshots Table
    await this.conn.query(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        timestamp BIGINT,
        description TEXT,
        data TEXT,
        is_auto BOOLEAN
      );
    `);
  }

  private async seedDatabase() {
    if (!this.conn) return;

    try {
        const projCheck = await this.conn.query(`SELECT count(*) as count FROM projects`);
        const count = Number(projCheck.toArray()[0].count);
        
        if (count === 0) {
            console.log("Pre-seeding project templates into DuckDB tables...");
            
            // Seed Projects
            for (const p of PROJECTS) {
                await this.conn.query(`
                    INSERT INTO projects VALUES (
                        '${p.id}', 
                        '${p.name.replace(/'/g, "''")}', 
                        '${p.domain.replace(/'/g, "''")}', 
                        '${(p.description || '').replace(/'/g, "''")}'
                    )
                `);
            }
            
            // Seed Arrangements
            for (const a of INITIAL_ARRANGEMENTS) {
                const containerJson = JSON.stringify(a.container).replace(/'/g, "''");
                const predicatesJson = JSON.stringify(a.predicates).replace(/'/g, "''");
                const linksJson = JSON.stringify(a.links || []).replace(/'/g, "''");
                const parentId = a.parentId ? `'${a.parentId}'` : 'NULL';
                
                await this.conn.query(`
                    INSERT INTO pipelines VALUES (
                        '${a.id}', 
                        '${a.projectId}', 
                        '${a.name.replace(/'/g, "''")}', 
                        ${parentId}, 
                        ${a.createdAt}, 
                        '${containerJson}', 
                        '${predicatesJson}',
                        '${linksJson}'
                    )
                `);
                
                // Seed Nodes
                for (const s of a.services) {
                    const attrs = JSON.stringify(s.attributes).replace(/'/g, "''");
                    const group = s.group ? `'${s.group.replace(/'/g, "''")}'` : 'NULL';
                    
                    await this.conn.query(`
                        INSERT INTO nodes VALUES (
                            '${s.id}',
                            '${a.id}',
                            '${s.name.replace(/'/g, "''")}',
                            '${s.type}',
                            ${group},
                            ${s.isExperimental},
                            '${attrs}'
                        )
                    `);
                }
            }
            this.invalidateCache();
            console.log("Pre-seeding complete!");
        }
    } catch (e) {
        console.error("Failed to pre-seed database:", e);
    }
  }

  private async seedTemplatesToFS() {
    if (!this.db) return;

    console.log("Creating Template Files in Virtual FS...");

    // 1. Hospital Template
    const hospitalProject = PROJECTS.find(p => p.id === 'proj_hospital_base');
    const hospitalArrangements = INITIAL_ARRANGEMENTS.filter(a => a.projectId === 'proj_hospital_base');
    
    if (hospitalProject && hospitalArrangements.length > 0) {
        const templateData = {
            project: hospitalProject,
            arrangements: hospitalArrangements
        };
        await this.registerFileText('template_hospital.json', JSON.stringify(templateData, null, 2));
    }

    // 2. ML Pipeline Template
    const mlProject = PROJECTS.find(p => p.id === 'proj_ml_audio');
    const mlArrangements = INITIAL_ARRANGEMENTS.filter(a => a.projectId === 'proj_ml_audio');

    if (mlProject && mlArrangements.length > 0) {
        const templateData = {
            project: mlProject,
            arrangements: mlArrangements
        };
        await this.registerFileText('template_ml_pipeline.json', JSON.stringify(templateData, null, 2));
    }
  }

  private async initFallbackSchema() {
      const projs = getFallbackProjects();
      if (projs.length === 0) {
          console.log("Initializing local storage fallback database and seeding sample projects...");
          
          const fProjs: FallbackProject[] = PROJECTS.map(p => ({
              id: p.id,
              name: p.name,
              domain: p.domain,
              description: p.description
          }));
          setFallbackProjects(fProjs);
          
          const fPipes: FallbackPipeline[] = [];
          const fNodes: FallbackNode[] = [];
          
          for (const a of INITIAL_ARRANGEMENTS) {
              fPipes.push({
                  id: a.id,
                  project_id: a.projectId,
                  name: a.name,
                  parent_id: a.parentId || null,
                  created_at: a.createdAt,
                  container_json: JSON.stringify(a.container),
                  predicates_json: JSON.stringify(a.predicates),
                  links_json: JSON.stringify(a.links || [])
              });
              
              for (const s of a.services) {
                  fNodes.push({
                      id: s.id,
                      pipeline_id: a.id,
                      name: s.name,
                      type: s.type,
                      group_name: s.group || null,
                      is_experimental: s.isExperimental,
                      attributes_json: JSON.stringify(s.attributes)
                  });
              }
          }
          setFallbackPipelines(fPipes);
          setFallbackNodes(fNodes);
          
          const fFiles: FallbackVirtualFile[] = [
              {
                  name: 'template_hospital.json',
                  registered_at: Date.now(),
                  content: JSON.stringify({
                      project: PROJECTS[0],
                      arrangements: INITIAL_ARRANGEMENTS.filter(a => a.projectId === PROJECTS[0].id)
                  }, null, 2)
              },
              {
                  name: 'template_ml_pipeline.json',
                  registered_at: Date.now(),
                  content: JSON.stringify({
                      project: PROJECTS[1],
                      arrangements: INITIAL_ARRANGEMENTS.filter(a => a.projectId === PROJECTS[1].id)
                  }, null, 2)
              }
          ];
          setFallbackVirtualFiles(fFiles);
          console.log("In-memory pre-seeding complete!");
      }
  }

  private invalidateCache(projectId?: string) {
    if (projectId) {
        this.cache.delete(projectId);
    } else {
        this.cache.clear();
    }
    this.notify(); // Trigger updates
  }

  // --- Data Access Methods ---
  
  // RAW SQL EXECUTION
  async execute(query: string): Promise<any[]> {
      if (this.isFallback) {
          const lower = query.trim().toLowerCase();
          if (lower.startsWith('select')) {
              if (lower.includes('from projects')) {
                  return getFallbackProjects();
              }
              if (lower.includes('from pipelines') || lower.includes('from arrangements')) {
                  return getFallbackPipelines();
              }
              if (lower.includes('from nodes')) {
                  return getFallbackNodes();
              }
              if (lower.includes('from suggestions')) {
                  return getFallbackSuggestions();
              }
              if (lower.includes('from virtual_files')) {
                  return getFallbackVirtualFiles().map(f => ({ name: f.name, registered_at: f.registered_at }));
              }
          }
          return []; // Safe fallback result for update/insert statements
      }

      if (!this.conn) throw new Error("DB not initialized");
      try {
          const res = await this.conn.query(query);
          // Naive check for modification queries
          const uQuery = query.trim().toUpperCase();
          if (uQuery.startsWith('INSERT') || 
              uQuery.startsWith('UPDATE') || 
              uQuery.startsWith('DELETE') ||
              uQuery.startsWith('DROP') ||
              uQuery.startsWith('ALTER')) {
              this.invalidateCache();
          }

          return res.toArray().map(row => JSON.parse(JSON.stringify(row, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value 
          )));
      } catch (e: any) {
          throw new Error(e.message);
      }
  }

  // METADATA REFLECTION
  async getDatabaseMetadata(): Promise<TableMetadata[]> {
        if (this.isFallback) {
            return [
                {
                    name: 'projects',
                    rowCount: getFallbackProjects().length,
                    columns: [
                        { name: 'id', type: 'TEXT' },
                        { name: 'name', type: 'TEXT' },
                        { name: 'domain', type: 'TEXT' },
                        { name: 'description', type: 'TEXT' }
                    ]
                },
                {
                    name: 'pipelines',
                    rowCount: getFallbackPipelines().length,
                    columns: [
                        { name: 'id', type: 'TEXT' },
                        { name: 'project_id', type: 'TEXT' },
                        { name: 'name', type: 'TEXT' },
                        { name: 'parent_id', type: 'TEXT' },
                        { name: 'created_at', type: 'BIGINT' },
                        { name: 'container_json', type: 'TEXT' },
                        { name: 'predicates_json', type: 'TEXT' },
                        { name: 'links_json', type: 'TEXT' }
                    ]
                },
                {
                    name: 'nodes',
                    rowCount: getFallbackNodes().length,
                    columns: [
                        { name: 'id', type: 'TEXT' },
                        { name: 'pipeline_id', type: 'TEXT' },
                        { name: 'name', type: 'TEXT' },
                        { name: 'type', type: 'TEXT' },
                        { name: 'group_name', type: 'TEXT' },
                        { name: 'is_experimental', type: 'BOOLEAN' },
                        { name: 'attributes_json', type: 'TEXT' }
                    ]
                },
                {
                    name: 'suggestions',
                    rowCount: getFallbackSuggestions().length,
                    columns: [
                        { name: 'id', type: 'TEXT' },
                        { name: 'project_id', type: 'TEXT' },
                        { name: 'type', type: 'TEXT' },
                        { name: 'content', type: 'TEXT' },
                        { name: 'reasoning', type: 'TEXT' },
                        { name: 'status', type: 'TEXT' },
                        { name: 'created_at', type: 'BIGINT' }
                    ]
                }
            ];
        }

        if (!this.conn) return [];
        try {
            const tablesRes = await this.conn.query(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
            const tables = tablesRes.toArray().map((r: any) => r.name);
            const metadata: TableMetadata[] = [];

            for (const t of tables) {
                // Skip internal metadata table
                if (t === 'virtual_files') continue;
                
                // Get Count
                const countRes = await this.conn.query(`SELECT count(*) as c FROM ${t}`);
                const count = Number(countRes.toArray()[0].c);

                // Get Schema
                const colRes = await this.conn.query(`PRAGMA table_info('${t}')`);
                const columns = colRes.toArray().map((c: any) => ({ name: c.name, type: c.type }));

                metadata.push({ name: t, rowCount: count, columns });
            }
            return metadata;
        } catch (e) {
            console.error("Failed to fetch schema", e);
            return [];
        }
  }

  // BACKUP
  async exportDatabaseAsSql(): Promise<string> {
    if (this.isFallback) {
        throw new Error("SQL export is not supported in client-only fallback mode.");
    }
    if (!this.conn) throw new Error("DB not initialized");
    
    let sql = `-- Hypothesis Explorer Backup\n-- Generated: ${new Date().toISOString()}\n\n`;

    // 1. Projects
    sql += "DROP TABLE IF EXISTS projects;\n";
    sql += "CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT, domain TEXT, description TEXT);\n";
    const projects = await this.execute("SELECT * FROM projects");
    for (const r of projects) {
        const name = r.name ? r.name.replace(/'/g, "''") : '';
        const domain = r.domain ? r.domain.replace(/'/g, "''") : '';
        const desc = r.description ? r.description.replace(/'/g, "''") : '';
        sql += `INSERT INTO projects VALUES ('${r.id}', '${name}', '${domain}', '${desc}');\n`;
    }
    sql += "\n";

    // 2. Pipelines
    sql += "DROP TABLE IF EXISTS pipelines;\n";
    sql += "CREATE TABLE pipelines (id TEXT PRIMARY KEY, project_id TEXT, name TEXT, parent_id TEXT, created_at BIGINT, container_json TEXT, predicates_json TEXT, links_json TEXT);\n";
    const pipelines = await this.execute("SELECT * FROM pipelines");
    for (const r of pipelines) {
        const parentId = r.parent_id ? `'${r.parent_id}'` : 'NULL';
        const createdAt = r.created_at;
        const name = r.name ? r.name.replace(/'/g, "''") : '';
        const containerJson = r.container_json ? r.container_json.replace(/'/g, "''") : '{}';
        const predicatesJson = r.predicates_json ? r.predicates_json.replace(/'/g, "''") : '[]';
        const linksJson = r.links_json ? r.links_json.replace(/'/g, "''") : '[]';

        sql += `INSERT INTO pipelines VALUES ('${r.id}', '${r.project_id}', '${name}', ${parentId}, ${createdAt}, '${containerJson}', '${predicatesJson}', '${linksJson}');\n`;
    }
    sql += "\n";

    // 3. Nodes
    sql += "DROP TABLE IF EXISTS nodes;\n";
    sql += "CREATE TABLE nodes (id TEXT, pipeline_id TEXT, name TEXT, type TEXT, group_name TEXT, is_experimental BOOLEAN, attributes_json TEXT, PRIMARY KEY (id, pipeline_id));\n";
    const nodes = await this.execute("SELECT * FROM nodes");
    for (const r of nodes) {
        const group = r.group_name ? `'${r.group_name.replace(/'/g, "''")}'` : 'NULL';
        const isExp = r.is_experimental ? 'TRUE' : 'FALSE';
        const name = r.name ? r.name.replace(/'/g, "''") : '';
        const attrs = r.attributes_json ? r.attributes_json.replace(/'/g, "''") : '[]';

        sql += `INSERT INTO nodes VALUES ('${r.id}', '${r.pipeline_id}', '${name}', '${r.type}', ${group}, ${isExp}, '${attrs}');\n`;
    }

    return sql;
  }

  async getProjects(): Promise<Project[]> {
    if (this.isFallback) {
        return getFallbackProjects();
    }
    if (!this.conn) throw new Error("DB not initialized");
    const res = await this.conn.query(`SELECT * FROM projects`);
    return res.toArray().map((r: any) => ({
      id: r.id,
      name: r.name,
      domain: r.domain,
      description: r.description
    }));
  }

  async getArrangements(projectId: string): Promise<Arrangement[]> {
    if (this.isFallback) {
         const pipes = getFallbackPipelines().filter(p => p.project_id === projectId);
         const nodes = getFallbackNodes();
         const arrangements: Arrangement[] = [];
         
         for (const p of pipes) {
              const pNodes = nodes.filter(n => n.pipeline_id === p.id).map(n => ({
                  id: n.id,
                  name: n.name,
                  type: n.type as any,
                  group: n.group_name || undefined,
                  isExperimental: n.is_experimental,
                  attributes: JSON.parse(n.attributes_json)
              }));
              
              arrangements.push({
                  id: p.id,
                  projectId: p.project_id,
                  name: p.name,
                  parentId: p.parent_id || undefined,
                  createdAt: p.created_at,
                  container: JSON.parse(p.container_json),
                  predicates: JSON.parse(p.predicates_json),
                  links: p.links_json ? JSON.parse(p.links_json) : [],
                  services: pNodes
              });
         }
         return arrangements;
    }

    if (!this.conn) throw new Error("DB not initialized");
    
    // 1. Check Cache
    if (this.cache.has(projectId)) {
        return this.cache.get(projectId)!;
    }

    // 2. Fetch from DB
    // Get Pipelines
    const pipeRes = await this.conn.query(`
        SELECT * FROM pipelines WHERE project_id = '${projectId}' ORDER BY created_at ASC
    `);
    const pipelines = pipeRes.toArray();

    const arrangements: Arrangement[] = [];

    for (const p of pipelines) {
        // Get Nodes for this pipeline
        const nodeRes = await this.conn.query(`
            SELECT * FROM nodes WHERE pipeline_id = '${p.id}'
        `);
        
        const services: ExternalService[] = nodeRes.toArray().map((n: any) => ({
            id: n.id,
            name: n.name,
            type: n.type,
            group: n.group_name,
            isExperimental: n.is_experimental,
            attributes: JSON.parse(n.attributes_json)
        }));

        arrangements.push({
            id: p.id,
            projectId: p.project_id,
            name: p.name,
            parentId: p.parent_id,
            createdAt: Number(p.created_at),
            container: JSON.parse(p.container_json),
            predicates: JSON.parse(p.predicates_json),
            links: p.links_json ? JSON.parse(p.links_json) : [],
            services: services
        });
    }

    // 3. Set Cache
    this.cache.set(projectId, arrangements);

    return arrangements;
  }

  // --- Suggestion / Agent Methods ---
  
  async saveSuggestion(suggestion: Suggestion): Promise<void> {
      if (this.isFallback) {
          const sugs = getFallbackSuggestions();
          sugs.push({
              id: suggestion.id,
              project_id: suggestion.projectId,
              type: suggestion.type,
              content: suggestion.content,
              reasoning: suggestion.reasoning,
              status: suggestion.status,
              created_at: suggestion.createdAt
          });
          setFallbackSuggestions(sugs);
          this.notify();
          return;
      }

      if(!this.conn) return;
      const content = suggestion.content.replace(/'/g, "''");
      const reasoning = suggestion.reasoning.replace(/'/g, "''");
      
      await this.conn.query(`
          INSERT INTO suggestions VALUES (
            '${suggestion.id}',
            '${suggestion.projectId}',
            '${suggestion.type}',
            '${content}',
            '${reasoning}',
            '${suggestion.status}',
            ${suggestion.createdAt}
          )
      `);
      this.notify();
  }

  async getSuggestions(projectId: string): Promise<Suggestion[]> {
      if (this.isFallback) {
          return getFallbackSuggestions()
              .filter(s => s.project_id === projectId)
              .map(s => ({
                  id: s.id,
                  projectId: s.project_id,
                  type: s.type as any,
                  content: s.content,
                  reasoning: s.reasoning,
                  status: s.status as any,
                  createdAt: s.created_at
              }))
              .sort((a,b) => b.createdAt - a.createdAt);
      }

      if (!this.conn) return [];
      try {
          const res = await this.conn.query(`SELECT * FROM suggestions WHERE project_id = '${projectId}' ORDER BY created_at DESC`);
          return res.toArray().map((r: any) => ({
              id: r.id,
              projectId: r.project_id,
              type: r.type,
              content: r.content,
              reasoning: r.reasoning,
              status: r.status,
              createdAt: Number(r.created_at)
          }));
      } catch (e) { return []; }
  }

  // --- Import / Export ---

  // Export Specific Project
  async exportProject(projectId: string): Promise<string> {
      const projects = await this.getProjects();
      const project = projects.find(p => p.id === projectId);
      const arrangements = await this.getArrangements(projectId);
      
      return JSON.stringify({
          project,
          arrangements
      }, null, 2);
  }

  // Export ENTIRE Database state (for Snapshots)
  async createFullSnapshot(): Promise<string> {
      const projects = await this.getProjects();
      const allData: any = { projects: projects, arrangements: [] };
      
      for(const p of projects) {
          const arrs = await this.getArrangements(p.id);
          allData.arrangements.push(...arrs);
      }
      return JSON.stringify(allData);
  }

  async importProject(jsonString: string): Promise<void> {
      if (this.isFallback) {
          try {
              const data = JSON.parse(jsonString);
              const projects = data.projects ? data.projects : [data.project];
              const arrangements = data.arrangements;
              
              const currentProjs = getFallbackProjects();
              for (const p of projects) {
                  if (!currentProjs.some(cp => cp.id === p.id)) {
                      currentProjs.push(p);
                  }
              }
              setFallbackProjects(currentProjs);
              
              const currentPipes = getFallbackPipelines();
              const currentNodes = getFallbackNodes();
              
              for (const a of arrangements) {
                  if (currentPipes.some(cp => cp.id === a.id)) continue;
                  
                  currentPipes.push({
                      id: a.id,
                      project_id: a.projectId,
                      name: a.name,
                      parent_id: a.parentId || null,
                      created_at: a.createdAt,
                      container_json: JSON.stringify(a.container),
                      predicates_json: JSON.stringify(a.predicates),
                      links_json: JSON.stringify(a.links || [])
                  });
                  
                  for (const s of a.services) {
                      currentNodes.push({
                          id: s.id,
                          pipeline_id: a.id,
                          name: s.name,
                          type: s.type,
                          group_name: s.group || null,
                          is_experimental: s.isExperimental,
                          attributes_json: JSON.stringify(s.attributes)
                      });
                  }
              }
              setFallbackPipelines(currentPipes);
              setFallbackNodes(currentNodes);
              
              this.invalidateCache();
              console.log("Fallback Import successful");
          } catch (e) {
              console.error("Fallback Import failed", e);
              throw new Error("Invalid Import JSON");
          }
          return;
      }

      if (!this.conn) return;
      
      try {
          const data = JSON.parse(jsonString);
          // Handle both single Project export structure and Full Snapshot structure
          const projects = data.projects ? data.projects : [data.project];
          const arrangements = data.arrangements;

          for(const project of projects) {
                // Check existence
                const pCheck = await this.conn.query(`SELECT id FROM projects WHERE id = '${project.id}'`);
                if (pCheck.numRows === 0) {
                    await this.conn.query(`
                        INSERT INTO projects VALUES ('${project.id}', '${project.name.replace(/'/g, "''")}', '${project.domain.replace(/'/g, "''")}', '${(project.description || '').replace(/'/g, "''")}')
                    `);
                }
          }

          // Insert Arrangements
          for (const a of arrangements) {
               // Check if pipeline exists to avoid dupes
               const pipeCheck = await this.conn.query(`SELECT id FROM pipelines WHERE id = '${a.id}'`);
               if (pipeCheck.numRows > 0) continue; // Skip existing

               const containerJson = JSON.stringify(a.container).replace(/'/g, "''");
               const predicatesJson = JSON.stringify(a.predicates).replace(/'/g, "''");
               const linksJson = JSON.stringify(a.links || []).replace(/'/g, "''");
               const parentId = a.parentId ? `'${a.parentId}'` : 'NULL';
       
               await this.conn.query(`
                   INSERT INTO pipelines VALUES (
                       '${a.id}', 
                       '${a.projectId}', 
                       '${a.name.replace(/'/g, "''")}', 
                       ${parentId}, 
                       ${a.createdAt}, 
                       '${containerJson}', 
                       '${predicatesJson}',
                       '${linksJson}'
                   )
               `);
       
               // Insert Nodes
               for (const s of a.services) {
                   const attrs = JSON.stringify(s.attributes).replace(/'/g, "''");
                   const group = s.group ? `'${s.group.replace(/'/g, "''")}'` : 'NULL';
                   
                   await this.conn.query(`
                       INSERT INTO nodes VALUES (
                           '${s.id}',
                           '${a.id}',
                           '${s.name.replace(/'/g, "''")}',
                           '${s.type}',
                           ${group},
                           ${s.isExperimental},
                           '${attrs}'
                        )
                   `);
               }
          }
          
          this.invalidateCache(); // Invalidate & Notify
          console.log("Import successful");
      } catch (e) {
          console.error("Import failed", e);
          throw new Error("Invalid Import JSON");
      }
  }

  // Restore state completely (Destructive import)
  async restoreSnapshot(jsonString: string): Promise<void> {
      if (this.isFallback) {
          localStorage.removeItem('hyp_nodes');
          localStorage.removeItem('hyp_pipelines');
          localStorage.removeItem('hyp_projects');
          localStorage.removeItem('hyp_suggestions');
          this.invalidateCache();
          await this.importProject(jsonString);
          return;
      }

      if(!this.conn) return;
      // Nuke existing
      await this.conn.query('DELETE FROM nodes');
      await this.conn.query('DELETE FROM pipelines');
      await this.conn.query('DELETE FROM projects');
      await this.conn.query('DELETE FROM suggestions');
      
      this.invalidateCache(); // Invalidate & Notify
      
      // Import
      await this.importProject(jsonString);
  }

  // --- Fork/Create Logic ---
  
  async saveFork(arrangement: Arrangement): Promise<void> {
      if (this.isFallback) {
          const a = arrangement;
          const currentPipes = getFallbackPipelines();
          const currentNodes = getFallbackNodes();
          
          currentPipes.push({
              id: a.id,
              project_id: a.projectId,
              name: a.name,
              parent_id: a.parentId || null,
              created_at: a.createdAt,
              container_json: JSON.stringify(a.container),
              predicates_json: JSON.stringify(a.predicates),
              links_json: JSON.stringify(a.links || [])
          });
          
          for (const s of a.services) {
              currentNodes.push({
                  id: s.id,
                  pipeline_id: a.id,
                  name: s.name,
                  type: s.type,
                  group_name: s.group || null,
                  is_experimental: s.isExperimental,
                  attributes_json: JSON.stringify(s.attributes)
              });
          }
          setFallbackPipelines(currentPipes);
          setFallbackNodes(currentNodes);
          
          this.invalidateCache(a.projectId);
          return;
      }

      if (!this.conn) return;
      const a = arrangement;
      const containerJson = JSON.stringify(a.container).replace(/'/g, "''");
      const predicatesJson = JSON.stringify(a.predicates).replace(/'/g, "''");
      const linksJson = JSON.stringify(a.links || []).replace(/'/g, "''");
      const parentId = a.parentId ? `'${a.parentId}'` : 'NULL';

      await this.conn.query(`
        INSERT INTO pipelines VALUES (
            '${a.id}', 
            '${a.projectId}', 
            '${a.name.replace(/'/g, "''")}', 
            ${parentId}, 
            ${a.createdAt}, 
            '${containerJson}', 
            '${predicatesJson}',
            '${linksJson}'
        )
      `);

      for (const s of a.services) {
        const attrs = JSON.stringify(s.attributes).replace(/'/g, "''");
        const group = s.group ? `'${s.group.replace(/'/g, "''")}'` : 'NULL';
        
        await this.conn.query(`
            INSERT INTO nodes VALUES (
                '${s.id}',
                '${a.id}',
                '${s.name.replace(/'/g, "''")}',
                '${s.type}',
                ${group},
                ${s.isExperimental},
                '${attrs}'
            )
        `);
    }

    // Update Cache for this project immediately
    const currentCache = this.cache.get(a.projectId) || [];
    this.cache.set(a.projectId, [...currentCache, a]);
    
    // Notify Listeners
    this.notify();
  }

  // --- Snapshots Persistence ---

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    if (this.isFallback) {
        const snaps = getFallbackSnapshots();
        snaps.push({
            id: snapshot.id,
            timestamp: snapshot.timestamp,
            description: snapshot.description,
            data: snapshot.data,
            isAuto: snapshot.isAuto
        });
        setFallbackSnapshots(snaps);
        this.notify();
        return;
    }

    if (!this.conn) return;
    const desc = snapshot.description.replace(/'/g, "''");
    const data = snapshot.data.replace(/'/g, "''");
    const isAuto = snapshot.isAuto ? 'TRUE' : 'FALSE';

    await this.conn.query(`
        INSERT INTO snapshots VALUES (
            '${snapshot.id}',
            ${snapshot.timestamp},
            '${desc}',
            '${data}',
            ${isAuto}
        )
    `);
    this.notify();
  }

  async getSnapshots(): Promise<Snapshot[]> {
    if (this.isFallback) {
        return getFallbackSnapshots().map(s => ({
            id: s.id,
            timestamp: s.timestamp,
            description: s.description,
            data: s.data,
            isAuto: s.isAuto
        })).sort((a, b) => b.timestamp - a.timestamp);
    }

    if (!this.conn) return [];
    try {
        const res = await this.conn.query(`SELECT * FROM snapshots ORDER BY timestamp DESC`);
        return res.toArray().map((r: any) => ({
            id: r.id,
            timestamp: Number(r.timestamp),
            description: r.description,
            data: r.data,
            isAuto: !!r.is_auto
        }));
    } catch (e) {
        return [];
    }
  }

  async exportBinaryBackup(): Promise<Uint8Array | null> {
      if (this.isFallback || !this.db || !this.conn) {
          throw new Error("Binary export is only available in WebAssembly DuckDB mode, not fallback.");
      }
      try {
          // Detach if already attached just in case
          try { await this.conn.query(`DETACH backup;`); } catch(e) {}
          // Attach a new physical file
          await this.conn.query(`ATTACH 'export.duckdb' AS backup;`);
          // Copy data
          await this.conn.query(`CREATE TABLE backup.projects AS SELECT * FROM projects;`);
          await this.conn.query(`CREATE TABLE backup.pipelines AS SELECT * FROM pipelines;`);
          await this.conn.query(`CREATE TABLE backup.nodes AS SELECT * FROM nodes;`);
          await this.conn.query(`CREATE TABLE backup.suggestions AS SELECT * FROM suggestions;`);
          await this.conn.query(`CREATE TABLE backup.snapshots AS SELECT * FROM snapshots;`);
          // Detach so it flushes to file
          await this.conn.query(`DETACH backup;`);
          
          // Read the file buffer from DuckDB's virtual file system
          const buffer = await this.db.copyFileToBuffer('export.duckdb');
          
          // Clean up the virtual file
          await this.db.dropFile('export.duckdb');
          
          return buffer;
      } catch (err) {
          console.error("Binary backup export failed:", err);
          throw err;
      }
  }

  // --- STORAGE & FILESYSTEM MANAGEMENT ---

  async getStorageEstimate(): Promise<{ usage: number, quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage || 0,
                quota: estimate.quota || 0
            };
        } catch (e) {
            console.warn("Storage estimate failed", e);
        }
    }
    return { usage: 0, quota: 0 };
  }

  async getVirtualFiles(): Promise<string[]> {
      if (this.isFallback) {
          return getFallbackVirtualFiles().map(f => f.name);
      }

      if (!this.conn) return [];
      
      // Query from virtual_files table
      try {
          const res = await this.conn.query(`SELECT name FROM virtual_files ORDER BY registered_at DESC`);
          if (res.numRows > 0) {
              return res.toArray().map((r: any) => r.name);
          }
      } catch (e) {
          console.warn("Querying virtual_files failed, attempting glob fallback", e);
      }

      // Fallback
      try {
          const res = await this.conn.query(`SELECT * FROM glob('*')`);
          if (res.numRows > 0) {
              return res.toArray().map((r: any) => Object.values(r)[0] as string);
          }
          return [];
      } catch (e) {
          console.warn("Glob failed or empty", e);
          return [];
      }
  }

  async registerFile(file: File): Promise<void> {
      const buffer = await file.arrayBuffer();
      const content = new TextDecoder().decode(buffer);

      if (this.isFallback) {
          const files = getFallbackVirtualFiles();
          const idx = files.findIndex(f => f.name === file.name);
          if (idx !== -1) {
              files[idx] = { name: file.name, registered_at: Date.now(), content };
          } else {
              files.push({ name: file.name, registered_at: Date.now(), content });
          }
          setFallbackVirtualFiles(files);
          return;
      }

      if (!this.db) return;
      await this.db.registerFileBuffer(file.name, new Uint8Array(buffer));

      // Track in virtual_files table
      if (this.conn) {
          try {
              await this.conn.query(`
                  INSERT OR REPLACE INTO virtual_files VALUES ('${file.name}', ${Date.now()})
              `);
          } catch (e) {
              console.error("Failed to insert into virtual_files", e);
          }
      }
  }

  // Support for creating text files (templates) directly
  async registerFileText(filename: string, content: string): Promise<void> {
    if (this.isFallback) {
        const files = getFallbackVirtualFiles();
        const idx = files.findIndex(f => f.name === filename);
        if (idx !== -1) {
             files[idx] = { name: filename, registered_at: Date.now(), content };
        } else {
             files.push({ name: filename, registered_at: Date.now(), content });
        }
        setFallbackVirtualFiles(files);
        return;
    }

    if (!this.db) return;
    const encoder = new TextEncoder();
    const buffer = encoder.encode(content);
    await this.db.registerFileBuffer(filename, buffer);

    // Track in virtual_files table
    if (this.conn) {
        try {
            await this.conn.query(`
                INSERT OR REPLACE INTO virtual_files VALUES ('${filename}', ${Date.now()})
            `);
        } catch (e) {
            console.error("Failed to insert into virtual_files", e);
        }
    }
  }

  // Reads file from virtual FS. Used for importing templates.
  async readFileText(filename: string): Promise<string> {
      if (this.isFallback) {
          const files = getFallbackVirtualFiles();
          const file = files.find(f => f.name === filename);
          if (!file) throw new Error("File not found");
          return file.content;
      }

      if (!this.db) throw new Error("DB Not Ready");
      const buffer = await this.db.copyFileToBuffer(filename);
      const decoder = new TextDecoder();
      return decoder.decode(buffer);
  }

  async dropFile(filename: string): Promise<void> {
      if (this.isFallback) {
          const files = getFallbackVirtualFiles().filter(f => f.name !== filename);
          setFallbackVirtualFiles(files);
          return;
      }

      if(!this.db) return;
      await this.db.dropFile(filename);

      // Track in virtual_files table
      if (this.conn) {
          try {
              await this.conn.query(`
                  DELETE FROM virtual_files WHERE name = '${filename}'
              `);
          } catch (e) {
              console.error("Failed to delete from virtual_files", e);
          }
      }
  }
}

export const db = DBManager.getInstance();
