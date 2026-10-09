import type { Track } from "@/lib/content/types";

export const ai: Track = {
  slug: "ai",
  name: "AI Engineering",
  tagline: "From gradient descent to production LLM systems.",
  intro:
    "A path from machine-learning fundamentals through LLM applications to running AI systems in production. Each module builds only on what came before, and every lesson ends with the questions interviewers actually ask.",
  stages: [
    {
      name: "Foundations",
      blurb:
        "How models learn, how transformers work, and how LLMs are trained and sampled — the mental model everything else rests on.",
      modules: [
        {
          slug: "ml-basics",
          title: "Machine Learning Basics",
          outcome:
            "Explain supervised vs unsupervised learning, split data correctly, spot overfitting, and describe how gradient descent minimizes a loss.",
          lessons: [
            {
              slug: "what-is-machine-learning",
              title: "What Machine Learning Actually Is",
              summary: "Learning a function from examples: supervised, unsupervised, and self-supervised learning.",
              minutes: 10,
            },
            {
              slug: "train-validation-test-splits",
              title: "Train, Validation, and Test Splits",
              summary: "Why you hold data back, how to split it, and the leakage traps that fake good results.",
              minutes: 10,
            },
            {
              slug: "overfitting-and-regularization",
              title: "Overfitting and Regularization",
              summary: "Memorizing vs generalizing, the bias–variance trade-off, and the tools that keep models honest.",
              minutes: 12,
            },
            {
              slug: "loss-functions-and-gradient-descent",
              title: "Loss Functions and Gradient Descent",
              summary: "How a model measures its mistakes and walks downhill to make fewer of them.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "neural-networks",
          title: "Neural Networks",
          outcome:
            "Describe a neural network as stacked linear layers plus non-linearities, and explain backpropagation without hand-waving.",
          lessons: [
            {
              slug: "neurons-layers-activations",
              title: "Neurons, Layers, and Activations",
              summary: "What a layer computes and why non-linear activations make depth worthwhile.",
              minutes: 12,
            },
            {
              slug: "backpropagation-intuition",
              title: "Backpropagation Intuition",
              summary: "The chain rule as blame assignment: how every weight learns its share of the error.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "deep-learning-building-blocks",
          title: "Deep Learning Building Blocks",
          outcome:
            "Recognize the components that make deep networks trainable and read a training loop with confidence.",
          lessons: [
            {
              slug: "normalization-dropout-residuals",
              title: "Normalization, Dropout, and Residuals",
              summary: "The three tricks that let very deep networks train stably.",
              minutes: 12,
            },
            {
              slug: "optimizers-and-training-loops",
              title: "Optimizers and Training Loops",
              summary: "SGD, momentum, Adam, learning-rate schedules, and the anatomy of a training step.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "tokens-and-embeddings",
          title: "Tokens and Embeddings",
          outcome:
            "Explain how text becomes tokens and tokens become vectors, and why that matters for cost, limits, and meaning.",
          lessons: [
            {
              slug: "tokenization",
              title: "Tokenization",
              summary: "Subword tokenizers like BPE, and why token counts drive cost and odd model behavior.",
              minutes: 10,
            },
            {
              slug: "embeddings-as-meaning",
              title: "Embeddings as Meaning",
              summary: "Turning tokens and texts into vectors where distance tracks similarity.",
              minutes: 10,
            },
          ],
        },
        {
          slug: "transformers",
          title: "Attention and the Transformer",
          outcome:
            "Walk through self-attention with queries, keys, and values, and sketch a decoder-only transformer block end to end.",
          lessons: [
            {
              slug: "attention-mechanism",
              title: "The Attention Mechanism",
              summary: "Queries, keys, and values: how each token decides what to look at.",
              minutes: 14,
            },
            {
              slug: "transformer-architecture",
              title: "The Transformer Architecture",
              summary: "Multi-head attention, feed-forward layers, positions, and causal masking in one block.",
              minutes: 14,
            },
          ],
        },
        {
          slug: "how-llms-are-trained",
          title: "How LLMs Are Trained",
          outcome:
            "Explain the pretraining → instruction tuning → preference tuning pipeline and what each stage adds.",
          lessons: [
            {
              slug: "pretraining-next-token-prediction",
              title: "Pretraining: Next-Token Prediction",
              summary: "How predicting the next token on huge corpora produces general capability.",
              minutes: 12,
            },
            {
              slug: "supervised-fine-tuning",
              title: "Supervised Fine-Tuning",
              summary: "Turning a text-completer into an instruction-follower with curated demonstrations.",
              minutes: 10,
            },
            {
              slug: "rlhf-and-preference-tuning",
              title: "RLHF and Preference Tuning",
              summary: "Reward models, PPO, DPO, and how human preferences shape model behavior.",
              minutes: 14,
            },
          ],
        },
        {
          slug: "sampling-and-decoding",
          title: "Sampling and Decoding",
          outcome:
            "Choose decoding settings deliberately and use logprobs for confidence, classification, and debugging.",
          lessons: [
            {
              slug: "temperature-and-top-p",
              title: "Temperature and Top-p",
              summary: "How the next token is actually chosen and which knobs change it.",
              minutes: 10,
            },
            {
              slug: "logprobs-and-decoding-strategies",
              title: "Logprobs and Decoding Strategies",
              summary: "Greedy, beam, and constrained decoding, plus what logprobs can tell you.",
              minutes: 12,
            },
          ],
        },
      ],
    },
    {
      name: "Applications",
      blurb:
        "Building with LLMs: prompting, retrieval, tools, agents, MCP, LangGraph, and knowing when to fine-tune.",
      modules: [
        {
          slug: "prompt-engineering",
          title: "Prompt Engineering",
          outcome:
            "Write prompts that are structured, testable, and reliable, including ones that return machine-parseable output.",
          lessons: [
            {
              slug: "prompt-structure",
              title: "Prompt Structure",
              summary: "System vs user messages, roles, delimiters, and writing instructions a model can follow.",
              minutes: 12,
            },
            {
              slug: "few-shot-and-chain-of-thought",
              title: "Few-Shot and Chain-of-Thought",
              summary: "Teaching by example and giving the model room to reason before answering.",
              minutes: 12,
            },
            {
              slug: "structured-output-json",
              title: "Structured Output and JSON",
              summary: "Getting reliable JSON with schemas, constrained decoding, validation, and repair.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "embeddings-and-vector-search",
          title: "Embeddings and Vector Search",
          outcome:
            "Build semantic search and explain how ANN indexes like HNSW, IVF, and PQ trade recall for speed and memory.",
          lessons: [
            {
              slug: "semantic-search",
              title: "Semantic Search with Embeddings",
              summary: "Embedding documents and queries, similarity metrics, and where keyword search still wins.",
              minutes: 12,
            },
            {
              slug: "ann-indexes-hnsw-ivf-pq",
              title: "Vector Databases and ANN Indexes",
              summary: "HNSW, IVF, and product quantization, and how to choose a vector store.",
              minutes: 15,
            },
          ],
        },
        {
          slug: "rag",
          title: "Retrieval-Augmented Generation",
          outcome:
            "Design a RAG pipeline end to end: chunking, hybrid retrieval, reranking, query rewriting, and grounded answers with citations.",
          lessons: [
            {
              slug: "rag-fundamentals-and-chunking",
              title: "RAG Fundamentals and Chunking",
              summary: "The ingest/retrieve/generate loop and how chunking choices make or break it.",
              minutes: 14,
            },
            {
              slug: "hybrid-search-and-reranking",
              title: "Hybrid Search and Reranking",
              summary: "Combining BM25 with vectors, fusing rankings, and reranking with cross-encoders.",
              minutes: 14,
            },
            {
              slug: "query-rewriting-and-citations",
              title: "Query Rewriting and Citations",
              summary: "Fixing bad queries before retrieval and making answers verifiable after it.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "tool-calling-and-agents",
          title: "Tool Calling and Agents",
          outcome:
            "Implement a tool-calling loop, explain ReAct and planning patterns, and design agent memory and multi-agent setups.",
          lessons: [
            {
              slug: "function-calling",
              title: "Tool and Function Calling",
              summary: "How models request tool calls, how your code executes them, and how to design good tools.",
              minutes: 12,
            },
            {
              slug: "react-and-planning-agents",
              title: "ReAct and Planning Agents",
              summary: "Reason–act–observe loops, plan-and-execute, and keeping agents from spinning.",
              minutes: 14,
            },
            {
              slug: "agent-memory",
              title: "Agent Memory",
              summary: "Short-term context, long-term stores, summarization, and what to remember.",
              minutes: 12,
            },
            {
              slug: "multi-agent-systems",
              title: "Multi-Agent Systems",
              summary: "Supervisors, handoffs, and when splitting work across agents helps or hurts.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "mcp",
          title: "Model Context Protocol",
          outcome:
            "Explain MCP's host/client/server model and build a server that exposes tools, resources, and prompts.",
          lessons: [
            {
              slug: "mcp-architecture",
              title: "MCP Architecture",
              summary: "Hosts, clients, servers, transports, and why a standard protocol for context matters.",
              minutes: 12,
            },
            {
              slug: "mcp-tools-resources-prompts",
              title: "MCP Tools, Resources, and Prompts",
              summary: "The three server primitives, who controls each, and how to design them well.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "langgraph",
          title: "LangGraph",
          outcome:
            "Model an agent as a state graph with nodes, edges, and reducers, and add persistence and human approval steps.",
          lessons: [
            {
              slug: "langgraph-state-graphs",
              title: "State Graphs, Nodes, and Edges",
              summary: "Typed state, reducers, conditional edges, and cycles in LangGraph.",
              minutes: 14,
            },
            {
              slug: "langgraph-checkpoints-human-in-the-loop",
              title: "Checkpoints and Human-in-the-Loop",
              summary: "Persisting graph state, resuming threads, interrupts, and time travel.",
              minutes: 14,
            },
          ],
        },
        {
          slug: "fine-tuning",
          title: "Fine-Tuning",
          outcome:
            "Decide between prompting, RAG, and fine-tuning for a given problem, and explain how LoRA makes tuning cheap.",
          lessons: [
            {
              slug: "fine-tuning-vs-rag-vs-prompting",
              title: "Fine-Tuning vs RAG vs Prompting",
              summary: "A decision framework: knowledge problems, behavior problems, and cost.",
              minutes: 12,
            },
            {
              slug: "lora-and-peft",
              title: "LoRA and Parameter-Efficient Fine-Tuning",
              summary: "Low-rank adapters, QLoRA, and the practical workflow for tuning a small model.",
              minutes: 14,
            },
          ],
        },
      ],
    },
    {
      name: "Production",
      blurb:
        "Shipping and running AI systems: evaluation, security, cost, observability, serving, and system design interviews.",
      modules: [
        {
          slug: "evaluation",
          title: "Evaluation",
          outcome:
            "Build offline eval suites with golden sets, use LLM-as-judge responsibly, and measure RAG quality component by component.",
          lessons: [
            {
              slug: "offline-evals-and-golden-sets",
              title: "Offline Evals and Golden Sets",
              summary: "Treating prompts like code: datasets, metrics, and regression gates in CI.",
              minutes: 14,
            },
            {
              slug: "llm-as-judge",
              title: "LLM-as-Judge",
              summary: "Using a model to grade a model, its biases, and how to calibrate it against humans.",
              minutes: 12,
            },
            {
              slug: "rag-evaluation-metrics",
              title: "RAG Evaluation Metrics",
              summary: "Retrieval recall, MRR, faithfulness, and answer relevance — measured separately.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "safety-and-security",
          title: "Guardrails, Security, and Responsible AI",
          outcome:
            "Threat-model an LLM app, defend against prompt injection and exfiltration, and build guardrails and responsible-AI practices into delivery.",
          lessons: [
            {
              slug: "prompt-injection-and-exfiltration",
              title: "Prompt Injection and Data Exfiltration",
              summary: "Direct and indirect injection, the lethal trifecta, and defenses that actually hold.",
              minutes: 14,
            },
            {
              slug: "guardrails-jailbreaks-and-pii",
              title: "Guardrails, Jailbreaks, and PII",
              summary: "Input/output filters, jailbreak resistance, and keeping personal data out of logs and prompts.",
              minutes: 12,
            },
            {
              slug: "responsible-ai",
              title: "Responsible AI in Practice",
              summary: "Bias, transparency, human oversight, and turning principles into engineering tasks.",
              minutes: 10,
            },
          ],
        },
        {
          slug: "cost-latency-observability",
          title: "Cost, Latency, and Observability",
          outcome:
            "Cut cost and latency with caching, streaming, batching, and routing, and trace every LLM call so you can debug production.",
          lessons: [
            {
              slug: "caching-and-prompt-caching",
              title: "Caching and Prompt Caching",
              summary: "Exact, semantic, and provider-side prefix caching, and when each pays off.",
              minutes: 12,
            },
            {
              slug: "streaming-batching-model-routing",
              title: "Streaming, Batching, and Model Routing",
              summary: "Perceived vs real latency, batch APIs, and sending each request to the cheapest model that can handle it.",
              minutes: 12,
            },
            {
              slug: "tracing-llm-apps",
              title: "Observability and Tracing for LLM Apps",
              summary: "Spans for every model and tool call, what to log, and closing the loop with evals.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "serving-and-inference",
          title: "Serving and Inference",
          outcome:
            "Explain what happens inside an inference server — KV cache, continuous batching, quantization — and size a self-hosted deployment.",
          lessons: [
            {
              slug: "kv-cache-and-continuous-batching",
              title: "KV Cache and Continuous Batching",
              summary: "Prefill vs decode, why memory bandwidth rules, and how servers keep GPUs busy.",
              minutes: 14,
            },
            {
              slug: "quantization",
              title: "Quantization",
              summary: "Shrinking weights to 8 or 4 bits and what you trade for the speed.",
              minutes: 12,
            },
          ],
        },
        {
          slug: "ai-system-design",
          title: "AI System Design",
          outcome:
            "Run an AI system design interview with a repeatable framework and apply it to a support copilot and a RAG search system.",
          lessons: [
            {
              slug: "ai-system-design-framework",
              title: "The AI System Design Framework",
              summary: "A step-by-step structure for AI design interviews, from requirements to evals.",
              minutes: 14,
            },
            {
              slug: "design-a-support-copilot",
              title: "Design a Customer Support Copilot",
              summary: "A worked design: retrieval, tools, guardrails, handoff, and metrics.",
              minutes: 15,
            },
            {
              slug: "design-a-rag-search-system",
              title: "Design an Enterprise RAG Search System",
              summary: "A worked design: ingestion at scale, permissions, hybrid retrieval, and freshness.",
              minutes: 15,
            },
          ],
        },
      ],
    },
  ],
  practiceLabel: "Build Projects",
  practiceIntro:
    "Hands-on projects that turn lessons into portfolio pieces. Each one has milestones with acceptance criteria, a core code skeleton, and talking points for interviews.",
  practice: [
    {
      slug: "cli-chatbot-with-memory",
      title: "CLI Chatbot with Memory",
      level: "Easy",
      concepts: ["chat API", "streaming", "context window", "summarization"],
      minutes: 120,
      summary: "A terminal chatbot that streams replies and remembers long conversations via rolling summaries.",
    },
    {
      slug: "semantic-search-over-notes",
      title: "Semantic Search over Your Notes",
      level: "Easy",
      concepts: ["embeddings", "chunking", "cosine similarity"],
      minutes: 180,
      summary: "Index a folder of Markdown notes and search them by meaning, not keywords.",
    },
    {
      slug: "rag-over-pdfs-with-citations",
      title: "RAG over PDFs with Citations",
      level: "Medium",
      concepts: ["RAG", "hybrid search", "reranking", "citations"],
      minutes: 300,
      summary: "Answer questions over a PDF collection with page-level citations and refusal when unsupported.",
    },
    {
      slug: "tool-using-agent-with-langgraph",
      title: "Tool-Using Agent with LangGraph",
      level: "Medium",
      concepts: ["LangGraph", "tool calling", "checkpoints", "human-in-the-loop"],
      minutes: 300,
      summary: "A LangGraph agent that calls real tools, persists state, and pauses for approval on risky actions.",
    },
    {
      slug: "mcp-server-for-a-real-api",
      title: "MCP Server for a Real API",
      level: "Medium",
      concepts: ["MCP", "tool design", "auth", "resources"],
      minutes: 240,
      summary: "Wrap a real HTTP API as an MCP server with tools, resources, and prompts any MCP host can use.",
    },
    {
      slug: "eval-harness-for-rag",
      title: "Eval Harness for a RAG App",
      level: "Medium",
      concepts: ["golden sets", "LLM-as-judge", "retrieval metrics", "CI gates"],
      minutes: 300,
      summary: "A repeatable evaluation pipeline that scores retrieval and generation and blocks regressions in CI.",
    },
    {
      slug: "multi-agent-research-assistant",
      title: "Multi-Agent Research Assistant",
      level: "Hard",
      concepts: ["supervisor pattern", "parallel agents", "web search", "synthesis"],
      minutes: 420,
      summary: "A supervisor agent that fans research out to worker agents and writes a cited report.",
    },
    {
      slug: "ai-support-copilot-with-guardrails",
      title: "AI Support Copilot with Guardrails",
      level: "Hard",
      concepts: ["RAG", "guardrails", "prompt injection", "escalation"],
      minutes: 480,
      summary: "A support assistant that answers from docs, takes scoped actions, and resists injection and PII leaks.",
    },
    {
      slug: "production-llm-gateway",
      title: "Production LLM Gateway",
      level: "Hard",
      concepts: ["model routing", "caching", "rate limiting", "observability"],
      minutes: 480,
      summary: "A gateway service that routes, caches, rate-limits, retries, and traces every LLM request.",
    },
    {
      slug: "fine-tune-small-model-with-lora",
      title: "Fine-Tune a Small Model with LoRA",
      level: "Hard",
      concepts: ["LoRA", "dataset curation", "evaluation", "PEFT"],
      minutes: 420,
      summary: "Fine-tune an open small model with LoRA for a narrow task and prove it beats prompting.",
    },
  ],
};
