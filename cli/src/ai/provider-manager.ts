import { AIProvider, ProviderConfig } from "@/ai/provider";
import { OpenAIProvider } from "@/ai/providers/openai-provider";
import { createLogger } from "@/utils/logger";

const logger = createLogger("provider-manager");

/**
 * Provider factory and manager
 */
export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<string, AIProvider> = new Map();
  private currentProvider: AIProvider | null = null;

  private constructor() {}

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  async registerProvider(config: ProviderConfig): Promise<void> {
    logger.debug({ provider: config.provider }, "Registering AI provider");

    let provider: AIProvider;

    switch (config.provider) {
      case "openai":
        provider = new OpenAIProvider(config);
        break;
      case "anthropic":
        throw new Error("Anthropic provider not yet implemented");
      case "cohere":
        throw new Error("Cohere provider not yet implemented");
      case "bedrock":
        throw new Error("Bedrock provider not yet implemented");
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }

    await provider.initialize();
    this.providers.set(config.provider, provider);
    this.currentProvider = provider;

    logger.info({ provider: config.provider }, "Provider registered successfully");
  }

  getProvider(name?: string): AIProvider {
    const providerName = name || this.currentProvider?.name;

    if (!providerName) {
      throw new Error("No AI provider configured");
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider '${providerName}' not registered`);
    }

    return provider;
  }

  getCurrentProvider(): AIProvider {
    if (!this.currentProvider) {
      throw new Error("No AI provider configured");
    }
    return this.currentProvider;
  }

  async switchProvider(name: string): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider '${name}' not registered`);
    }
    this.currentProvider = provider;
    logger.info({ provider: name }, "Switched to provider");
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  isProviderAvailable(): boolean {
    return this.currentProvider !== null && this.currentProvider.isInitialized();
  }

  async testCurrentProvider(): Promise<boolean> {
    if (!this.currentProvider) {
      return false;
    }
    return this.currentProvider.testConnection();
  }
}

export const providerManager = ProviderManager.getInstance();
