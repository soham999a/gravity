/**
 * Model Capability Registry
 *
 * Classifies models/providers by what they can ACTUALLY do — not by how cheap
 * or attractive they are. This is the senior's core point:
 *
 *   "Capability eligibility must happen BEFORE optimization."
 *
 * The router cannot select a cheap text model merely because its expected
 * utility is attractive — if the task requires image generation, only
 * image-capable models are eligible.
 *
 * CAPABILITY REGISTRY
 *   Text Reasoning:      DeepSeek, Nemotron, Claude, OpenAI
 *   Image Generation:    image-capable model A, B, C
 *   Vision Evaluation:   vision model A, B
 *
 * Usage:
 *   1. Profile the problem → determine required capabilities
 *   2. Filter models by capability eligibility (THIS module)
 *   3. THEN optimize within the eligible set (Thompson sampling, cost, etc.)
 */

export type ModelCapability =
  | "text_reasoning"       // DeepSeek, Nemotron, Claude, OpenAI — can reason about text
  | "image_generation"     // Can generate images from prompts
  | "vision_evaluation"   // Can look at images and evaluate/understand them
  | "image_verification"  // Can VERIFY a generated image matches its prompt (senior's 4th box)
  | "code_generation"      // Can write code
  | "statistical"          // Can do statistical computation
  | "web_artifact"         // Can generate websites/web pages
  | "multi_modal"          // Can handle text + images + code together
  | "deterministic";       // Pure computation, no model needed

export type ModelProvider =
  | "deepseek"
  | "nemotron"
  | "claude"
  | "openai"
  | "gemini"
  | "groq"
  | "pollinations"
  | "custom";

export interface ModelEntry {
  /** Unique model identifier, e.g. "deepseek-chat", "claude-sonnet-4" */
  modelId: string;
  /** Human-readable label */
  label: string;
  /** Provider name */
  provider: ModelProvider;
  /** Capabilities this model actually has */
  capabilities: ModelCapability[];
  /** Strategies this model can power */
  supportedStrategies: import("./capabilities").StrategyKind[];
  /** Approximate cost per 1K tokens (0 = free tier) */
  costPerToken: number;
  /** Approximate time-to-first-token in ms */
  latencyTtfMs: number;
  /** Context window in tokens */
  contextWindow: number;
  /** Quality tier: 0-100 */
  qualityTier: number;
  /** Whether this model is currently available */
  available: boolean;
  /** Notes about limitations */
  notes?: string;
}

export interface ModelCapabilityRegistry {
  /** Register a model with its capabilities */
  register(model: ModelEntry): void;
  /** Get all registered models */
  list(): ModelEntry[];
  /** Get models that have ALL of the required capabilities */
  eligible(requiredCapabilities: ModelCapability[]): ModelEntry[];
  /** Get models for a specific strategy kind */
  forStrategy(strategy: import("./capabilities").StrategyKind): ModelEntry[];
  /** Check if a specific model has a capability */
  hasCapability(modelId: string, capability: ModelCapability): boolean;
}

class InMemoryModelRegistry implements ModelCapabilityRegistry {
  private readonly models = new Map<string, ModelEntry>();

  register(model: ModelEntry) {
    this.models.set(model.modelId, model);
  }

  list(): ModelEntry[] {
    return [...this.models.values()];
  }

  eligible(requiredCapabilities: ModelCapability[]): ModelEntry[] {
    if (requiredCapabilities.length === 0) return this.list();
    return this.list().filter((model) =>
      requiredCapabilities.every((cap) => model.capabilities.includes(cap)),
    );
  }

  forStrategy(strategy: import("./capabilities").StrategyKind): ModelEntry[] {
    return this.list().filter((model) =>
      model.supportedStrategies.includes(strategy),
    );
  }

  hasCapability(modelId: string, capability: ModelCapability): boolean {
    const model = this.models.get(modelId);
    return model?.capabilities.includes(capability) ?? false;
  }
}

export const modelCapabilityRegistry: ModelCapabilityRegistry = new InMemoryModelRegistry();

// ---------------------------------------------------------------------------
// Default model registrations
// ---------------------------------------------------------------------------
// These reflect the senior's capability registry vision. In production,
// these would be loaded from config / admin UI / provider API discovery.
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: ModelEntry[] = [
  // ── Text Reasoning models ────────────────────────────────────────────────
  {
    modelId: "deepseek-chat",
    label: "DeepSeek Chat",
    provider: "deepseek",
    capabilities: ["text_reasoning", "code_generation", "multi_modal"],
    supportedStrategies: [
      "small_llm",
      "llm",
      "specialist_agent",
      "advanced_reasoning",
      "multi_agent",
    ],
    costPerToken: 0,
    latencyTtfMs: 300,
    contextWindow: 128_000,
    qualityTier: 82,
    available: true,
    notes: "Strong reasoning at low cost. Not image-capable despite multimodal training.",
  },
  {
    modelId: "nemotron",
    label: "Nemotron",
    provider: "nemotron",
    capabilities: ["text_reasoning", "code_generation"],
    supportedStrategies: [
      "small_llm",
      "llm",
      "specialist_agent",
    ],
    costPerToken: 0,
    latencyTtfMs: 250,
    contextWindow: 128_000,
    qualityTier: 78,
    available: true,
    notes: "Good reasoning model. No image generation or vision evaluation.",
  },
  {
    modelId: "claude-sonnet",
    label: "Claude Sonnet",
    provider: "claude",
    capabilities: ["text_reasoning", "code_generation", "multi_modal"],
    supportedStrategies: [
      "small_llm",
      "llm",
      "specialist_agent",
      "advanced_reasoning",
      "multi_agent",
    ],
    costPerToken: 0,
    latencyTtfMs: 400,
    contextWindow: 200_000,
    qualityTier: 88,
    available: true,
    notes: "Strong reasoning and coding. Multimodal but not primarily an image generator.",
  },
  {
    modelId: "gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    capabilities: ["text_reasoning", "code_generation", "image_generation", "vision_evaluation", "multi_modal"],
    supportedStrategies: [
      "small_llm",
      "llm",
      "specialist_agent",
      "advanced_reasoning",
      "multi_agent",
      "image_generation",
    ],
    costPerToken: 0,
    latencyTtfMs: 350,
    contextWindow: 128_000,
    qualityTier: 90,
    available: true,
    notes: "Multimodal: can reason, code, generate images via DALL-E, and evaluate images.",
  },

  // ── Image Generation models ──────────────────────────────────────────────
  {
    modelId: "pollinations-default",
    label: "Pollinations.ai",
    provider: "pollinations",
    capabilities: ["image_generation"],
    supportedStrategies: ["image_generation"],
    costPerToken: 0,
    latencyTtfMs: 5000,
    contextWindow: 0,
    qualityTier: 75,
    available: true,
    notes: "Free image generation via Pollinations. Text-only models cannot do this.",
  },

  // ── Vision Evaluation models ─────────────────────────────────────────────
  // ── Image Verification models (senior's 4th box) ─────────────────────────
  // A verifier must be able to LOOK at a generated image and judge it against
  // the prompt. Distinct from generation: the generator never grades itself.
  {
    modelId: "gemini-flash-verifier",
    label: "Gemini Flash (Image Verifier)",
    provider: "gemini",
    capabilities: ["image_verification", "vision_evaluation", "text_reasoning", "multi_modal"],
    supportedStrategies: ["specialist_agent"],
    costPerToken: 0,
    latencyTtfMs: 600,
    contextWindow: 1_000_000,
    qualityTier: 85,
    available: true,
    notes: "Dedicated image VERIFIER — looks at generated image bytes and judges prompt adherence. Generator never grades its own output.",
  },
  {
    modelId: "claude-vision",
    label: "Claude Vision",
    provider: "claude",
    capabilities: ["vision_evaluation", "text_reasoning", "multi_modal"],
    supportedStrategies: [
      "specialist_agent",
      "advanced_reasoning",
    ],
    costPerToken: 0,
    latencyTtfMs: 500,
    contextWindow: 200_000,
    qualityTier: 87,
    available: true,
    notes: "Can evaluate and understand images. Distinct from image generation. Also usable as an image verifier.",
  },
  {
    modelId: "gpt-4o-vision",
    label: "GPT-4o Vision",
    provider: "openai",
    capabilities: ["vision_evaluation", "text_reasoning", "image_generation", "multi_modal"],
    supportedStrategies: [
      "specialist_agent",
      "advanced_reasoning",
      "image_generation",
    ],
    costPerToken: 0,
    latencyTtfMs: 450,
    contextWindow: 128_000,
    qualityTier: 89,
    available: true,
    notes: "Can both generate AND evaluate images — a multi-modal model.",
  },

  // ── Fast/cheap models for simple tasks ───────────────────────────────────
  {
    modelId: "groq-llama",
    label: "Llama via Groq",
    provider: "groq",
    capabilities: ["text_reasoning", "code_generation"],
    supportedStrategies: ["small_llm", "deterministic"],
    costPerToken: 0,
    latencyTtfMs: 50,
    contextWindow: 128_000,
    qualityTier: 70,
    available: true,
    notes: "Very fast, low cost. Good for simple text tasks. Not image-capable.",
  },
  {
    modelId: "gemini-flash",
    label: "Gemini Flash",
    provider: "gemini",
    capabilities: ["text_reasoning", "code_generation", "vision_evaluation", "multi_modal"],
    supportedStrategies: [
      "small_llm",
      "llm",
      "specialist_agent",
    ],
    costPerToken: 0,
    latencyTtfMs: 200,
    contextWindow: 1_000_000,
    qualityTier: 80,
    available: true,
    notes: "Fast and capable. Can evaluate images but not primarily an image generator.",
  },

  // ── Fallback ─────────────────────────────────────────────────────────────
  {
    modelId: "fallback-small",
    label: "Fallback Small Model",
    provider: "custom",
    capabilities: ["text_reasoning"],
    supportedStrategies: ["small_llm"],
    costPerToken: 0,
    latencyTtfMs: 1000,
    contextWindow: 32_000,
    qualityTier: 65,
    available: true,
    notes: "Minimal fallback when no other model is available. Text only.",
  },
];

DEFAULT_MODELS.forEach((model) => modelCapabilityRegistry.register(model));

// ---------------------------------------------------------------------------
// Capability → required strategies mapping
// Used by the router to determine which capabilities a task needs.
// ---------------------------------------------------------------------------

export function capabilitiesForStrategy(
  strategy: import("./capabilities").StrategyKind,
): ModelCapability[] {
  const map: Record<import("./capabilities").StrategyKind, ModelCapability[]> = {
    deterministic: ["deterministic"],
    statistical: ["statistical", "text_reasoning"],
    machine_learning: ["statistical", "text_reasoning"],
    small_model: ["text_reasoning"],
    small_llm: ["text_reasoning"],
    llm: ["text_reasoning"],
    specialist_agent: ["text_reasoning"],
    advanced_reasoning: ["text_reasoning"],
    multi_agent: ["text_reasoning"],
    image_generation: ["image_generation"],
    website_builder: ["code_generation", "text_reasoning"],
    human_review: [],
    human: [],
  };
  return map[strategy] ?? ["text_reasoning"];
}

/** Determine which model capabilities a problem requires, from its task type. */
export function requiredCapabilitiesForTask(
  taskType: import("./problemState").TaskType,
  wantsImage: boolean,
  wantsWebsite: boolean,
): ModelCapability[] {
  const caps: ModelCapability[] = [];

  if (wantsImage) caps.push("image_generation", "image_verification");
  if (wantsWebsite) caps.push("web_artifact", "code_generation");
  if (taskType === "calculation" || taskType === "forecasting") caps.push("statistical");
  if (taskType === "creation" && !wantsImage && !wantsWebsite) caps.push("text_reasoning", "code_generation");
  if (taskType === "analysis" || taskType === "summarization" || taskType === "investigation" || taskType === "classification") caps.push("text_reasoning");
  if (taskType === "optimization") caps.push("text_reasoning", "statistical");

  // Every task needs at least text reasoning unless it's purely computational
  if (caps.length === 0) caps.push("text_reasoning");

  return caps;
}
