# NEXUS Hypothesis Explorer

O Hypothesis Explorer atua como o "Digital Twin" de decisões técnicas de arquitetura, integrando-se à memória factual e estrutural do **NEXUS**.

Ele é uma aplicação Frontend Local-First que roda um motor SQL In-Browser (DuckDB Wasm) para permitir a exploração especulativa de arquiteturas de software, sem afetar imediatamente os dados reais, mas mantendo a capacidade de validação cruzada com o grafo topológico.

## 🔗 Como é feita a integração com o NEXUS? (API e Protocolo)

A comunicação entre este Explorer (Frontend) e o NEXUS (Backend Rust) **não é uma API REST convencional**, mas sim baseada no **Model Context Protocol (MCP)** operando sobre **SSE (Server-Sent Events)**.

1. **aiService.ts (MCP Client)**: Atua como a ponte de integração.
2. **NEXUS Coordinator (MCP Server)**: O backend em Rust expõe ferramentas dinâmicas de análise.
3. Quando o arquiteto faz uma pergunta ou modificação no Explorer, o Frontend invoca ferramentas MCP (como `nexus_query` ou `nexus_adjacent`) via fluxo SSE. 
4. O NEXUS Coordinator responde em tempo real com o subgrafo factual do sistema (Grafo T4), permitindo que a IA compare a "Hipótese" (no navegador) com a "Realidade" (no PostgreSQL do NEXUS).

## 🐳 Deployment: Posso rodar em outra rede em outro container?

**Sim, perfeitamente.** A arquitetura foi desenhada para ser altamente desacoplada.

Como o "Hypothesis Explorer" é essencialmente uma Single Page Application (SPA) em React/Vite com um banco de dados embutido no próprio navegador (DuckDB Wasm), o servidor que o hospeda atua apenas como um servidor de arquivos estáticos.

**Para rodar em outro container:**
1. Você pode empacotar a aplicação utilizando uma imagem do **Nginx** ou **Node.js**.
2. Basta realizar o build da aplicação (`npm run build`) e servir a pasta `dist/`.
3. Configure as variáveis de ambiente (ex: `VITE_NEXUS_API_URL`) para apontar para a URL do seu *NEXUS Coordinator* rodando em outra rede.
4. O usuário final fará o download do JS/Wasm para o seu navegador, e o navegador fará a conexão SSE diretamente para a URL configurada do NEXUS.

---

## 🛠️ Instruções de Uso

### 1. Terminal e Exploração (Painel Inferior)
O painel de comando é o coração da plataforma.
- Digite instruções em linguagem natural (ex: *"Crie um novo serviço de autenticação ligado ao gateway"*).
- O sistema intercepta o comando e pode consultar as ferramentas do NEXUS (via MCP) para validar se o gateway já existe na arquitetura factual.
- Você pode usar o Terminal para visualizar o esquema, gerenciar as conexões e avaliar métricas operacionais.

### 2. Árvore de Hipóteses (Fork Tree)
No painel esquerdo, você encontrará o **Exploration Branches (Fork Tree)**.
- Diferentes arquitetos podem explorar diferentes soluções (ex: "Migrar para Microsserviços" vs "Manter Monolito").
- Ao ramificar (criar um Fork), você herda o estado do DuckDB atual.
- A árvore visual mostra a hierarquia das suas hipóteses de decisão arquitetural.

### 3. Agente de Background e Sugestões (Loop de Supervisão)
O sistema possui um agente que analisa ativamente seu grafo em tempo real.
- **Botão Play/Pause (Verde/Amarelo)**: Localizado na barra superior. Pausa o loop de IA generativa se você quiser silenciar as sugestões por um momento.
- **Fallback Inteligente**: Se você configurar a chave `GEMINI_API_KEY`, ele usará o poder do modelo remoto. Caso não possua internet ou queira privacidade total (Off-Grid), o sistema faz o fallback automático para um LLM local em WebAssembly (Flan-T5).

### 4. Gestão de Estado e Backups (State Registry)
O painel da direita gerencia a memória especulativa:
- **SNAPSHOT**: Tira uma "fotografia" do estado atual do seu grafo e armazena na linha do tempo.
- **EXPORT SQL**: Baixa um arquivo de texto `.sql` com todas as queries DDL/DML que representam sua hipótese (útil para auditoria).
- **EXPORT DUCKDB BINARY**: Baixa o banco de dados físico completo do DuckDB. Você pode carregar esse `.duckdb` no CLI local do DuckDB no seu computador, no Python ou no DBeaver para análises complexas fora da plataforma.
