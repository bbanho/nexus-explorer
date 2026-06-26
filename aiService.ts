
import { pipeline, env as transformersEnv } from '@xenova/transformers';
import { GoogleGenAI } from "@google/genai";

// Configure to not load from local path, but fetch from CDN
transformersEnv.allowLocalModels = false;
transformersEnv.useBrowserCache = true;

export interface AIStats {
    totalRequests: number;
    successRequests: number;
    failedRequests: number;
    lastLatencyMs: number;
    averageLatencyMs: number;
    deviceType: 'CPU' | 'GPU (WebGPU)' | 'WASM' | 'API' | 'GEMINI';
    modelSizeMB: number;
}

export interface RemoteConfig {
    baseUrl: string;
    apiKey: string;
    model: string;
}

const SUPERVISOR_SYSTEM_PROMPT = `
Papel: Agente Supervisor e Reconfigurador Cognitivo (Especialista em Semiótica de Sistemas).

Contexto do sistema:
O sistema apresenta visualizações conceituais (grafos, clusters) de arquiteturas complexas.
O layout visual, a disposição espacial e o grau de abração SÃO parte do objeto de análise, não apenas contexto passivo.

Suas responsabilidades (obrigatórias):
1. Crítica da Linguagem Visual:
   - Avalie se a visualização comunica os critérios pretendidos (ex: riscos, fluxos).
   - Aponte ambiguidades causadas pela forma (ex: "A sobreposição destes clusters confunde a responsabilidade").
   - Sugira alterações de layout, legendas ou separação de views (independente dos dados).
2. Diagnóstico Estrutural:
   - Identifique falhas lógicas na conexão entre nós (ex: "Fluxo de dados crítico passando por nó experimental").
   - Diferencie dado vs hipótese e operador vs visualização.
3. Mediação Semântica:
   - Traduza perguntas vagas em tarefas de análise visual/estrutural.
   - Se faltar informação, explique qual *elemento visual* ou *relação* está ausente.

Restrições:
- Não assumir acesso a dados tabulares reais (apenas metadados e estrutura).
- Não forçar execução SQL para dúvidas conceituais.
- A "Vaguidade Visual" é um sinal, não um erro: analise o que ela esconde ou comunica implicitamente.
`;

class AIService {
    private static instance: AIService;
    private generator: any = null;
    public isLoaded: boolean = false;
    
    private _stats: AIStats = {
        totalRequests: 0,
        successRequests: 0,
        failedRequests: 0,
        lastLatencyMs: 0,
        averageLatencyMs: 0,
        deviceType: 'WASM',
        modelSizeMB: 0
    };

    private constructor() {}

    static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    get stats() {
        return this._stats;
    }

    async load() {
        if (this.isLoaded) return;
        
        // Detect likely backend
        if ('gpu' in navigator) {
            this._stats.deviceType = 'GPU (WebGPU)';
        } else {
            this._stats.deviceType = 'CPU';
        }

        console.log("Loading AI Model...");
        // Using flan-t5-small: Good balance of size vs instruction following capability for code/SQL
        this.generator = await pipeline('text2text-generation', 'Xenova/flan-t5-small');
        this.isLoaded = true;
        this._stats.modelSizeMB = 240; // Approx size for flan-t5-small quant
        console.log("AI Model Loaded");
    }

    async generate(prompt: string, context?: string): Promise<string> {
        if (!this.generator) throw new Error("AI not loaded. Click 'Load AI' first.");

        this._stats.totalRequests++;
        const start = performance.now();

        try {
            // Local model is simple, so we prepend a simplified instruction
            const fullPrompt = context 
                ? `Context: ${context.substring(0, 500)}. Question: ${prompt}`
                : prompt;

            const output = await this.generator(fullPrompt, {
                max_new_tokens: 150,
                temperature: 0.3
            });

            const end = performance.now();
            const duration = end - start;
            
            this._stats.lastLatencyMs = duration;
            this._stats.successRequests++;
            
            // Update Running Average
            const totalTime = (this._stats.averageLatencyMs * (this._stats.successRequests - 1)) + duration;
            this._stats.averageLatencyMs = totalTime / this._stats.successRequests;

            return output[0].generated_text;
        } catch (e) {
            this._stats.failedRequests++;
            throw e;
        }
    }

    // Specific method for background agent loop using local model or Gemini fallback
    async generateCreativeSuggestion(projectDomain: string, entityNames: string[], useGeminiFallback: boolean = true): Promise<string> {
        this._stats.totalRequests++;
        
        const start = performance.now();
        
        // Rotating prompts to keep suggestions varied
        const tasks = [
            `Suggest an architectural rule to balance safety and complexity for a system in domain "${projectDomain}"`,
            `Suggest a new external service block or integration point that can solve architectural problems in domain "${projectDomain}" with components [${entityNames.slice(0, 5).join(', ')}]`,
            `Suggest a risk verification check for domain "${projectDomain}" with components [${entityNames.slice(0, 5).join(', ')}]`
        ];
        const task = tasks[Math.floor(Math.random() * tasks.length)];

        if (useGeminiFallback || !this.generator) {
            try {
                const apiKeyToUse = process.env.GEMINI_API_KEY || process.env.API_KEY;
                if (apiKeyToUse) {
                    const genAI = new GoogleGenAI({ apiKey: apiKeyToUse });
                    const prompt = `Based on the project domain "${projectDomain}" and active components [${entityNames.join(', ')}], do the following task: ${task}. Output ONLY a single concise, highly technical creative suggestion. Choose either a RULE (e.g., "AI clinical output must require a human specialist validation") or a SERVICE (e.g., "Add an Automated Audit trail log block to track patient data access") or a HYPOTHESIS. Keep it under 25 words. DO NOT explain, output the suggestion directly.`;
                    const response = await genAI.models.generateContent({
                        model: 'gemini-3.1-pro-preview',
                        contents: prompt,
                        config: {
                            systemInstruction: "You are an expert systems architect. Design creative, realistic and concise suggestions.",
                        }
                    });
                    const output = response.text || "";
                    const end = performance.now();
                    this._stats.lastLatencyMs = end - start;
                    this._stats.successRequests++;
                    return output.trim();
                }
            } catch (e) {
                console.warn("Background Gemini suggestion failed, trying local model...", e);
            }
        }

        if (!this.generator) return "";
        // Few-shot to guide flan-t5-small (which is very literal)
        // Improved prompt structure:
        const prompt = `Task: ${task}. Context: ${entityNames.slice(0, 4).join(', ')}. Answer concisely:`;

        try {
            const output = await this.generator(prompt, {
                max_new_tokens: 45, // Shorter tokens for speed and focus
                temperature: 0.9, // Higher temp for creativity
                do_sample: true,
                top_k: 50
            });
            
            const end = performance.now();
            this._stats.lastLatencyMs = end - start;
            this._stats.successRequests++;

            return output[0].generated_text;
        } catch (e) {
            this._stats.failedRequests++;
            console.warn("Background AI fail", e);
            return "";
        }
    }

    async generateRemote(prompt: string, config: RemoteConfig, context?: string): Promise<string> {
        this._stats.totalRequests++;
        this._stats.deviceType = 'API';
        this._stats.modelSizeMB = 0; // Remote models have no local footprint
        
        const start = performance.now();

        try {
            // Remove trailing slash if present
            const baseUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
            const url = `${baseUrl}/chat/completions`;

            const systemContent = context 
                ? `${SUPERVISOR_SYSTEM_PROMPT}\n\nDADOS VISUAIS ATUAIS (CONCEITUAL):\n${context}`
                : "You are a helpful assistant.";

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: config.model,
                    messages: [
                        { role: "system", content: systemContent },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API ${response.status}: ${errText.substring(0, 100)}...`);
            }

            const data = await response.json();
            const output = data.choices?.[0]?.message?.content || "";
            
            const end = performance.now();
            const duration = end - start;
            
            this._stats.lastLatencyMs = duration;
            this._stats.successRequests++;
            
            const totalTime = (this._stats.averageLatencyMs * (this._stats.successRequests - 1)) + duration;
            this._stats.averageLatencyMs = totalTime / this._stats.successRequests;

            return output;
        } catch (e: any) {
            this._stats.failedRequests++;
            throw e;
        }
    }

    // Always use process.env.API_KEY and SDK directly for Gemini calls.
    async generateGemini(prompt: string, context?: string): Promise<string> {
        this._stats.totalRequests++;
        this._stats.deviceType = 'GEMINI';
        this._stats.modelSizeMB = 0;
        
        const start = performance.now();
        // Use recommended model for complex reasoning and architecture analysis.
        const modelName = 'gemini-3.1-pro-preview';

        // Prepare System Instruction
        const systemInstruction = context 
            ? `${SUPERVISOR_SYSTEM_PROMPT}\n\nESTRUTURA CONCEITUAL ATUAL (NÓS E RELAÇÕES):\n${context}`
            : `You are a strict SQL translation assistant. Translate the following natural language request into a valid DuckDB SQL query. Output ONLY the SQL. No markdown, no explanations, no code blocks.`;

        try {
            // Initialize SDK with process.env.API_KEY directly.
            const apiKeyToUse = process.env.GEMINI_API_KEY || process.env.API_KEY;
            const genAI = new GoogleGenAI({ apiKey: apiKeyToUse });
            const response = await genAI.models.generateContent({
                model: modelName,
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                }
            });
            
            // Extract text from property (getter), not a method call.
            const output = response.text || "";
            
            const end = performance.now();
            const duration = end - start;
            
            this._stats.lastLatencyMs = duration;
            this._stats.successRequests++;
            
            const totalTime = (this._stats.averageLatencyMs * (this._stats.successRequests - 1)) + duration;
            this._stats.averageLatencyMs = totalTime / this._stats.successRequests;

            return output.trim();
        } catch (e: any) {
            this._stats.failedRequests++;
            console.error("Gemini Error:", e);
            throw new Error(`Gemini API Error: ${e.message || "Unknown error"}`);
        }
    }
}

export const ai = AIService.getInstance();
