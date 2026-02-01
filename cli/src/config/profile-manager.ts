/**
 * Profile Manager
 * Handles multiple configuration profiles
 */

import { CLIConfig } from "@/types";
import { createLogger } from "@/utils/logger";
import { ConfigError } from "@/utils/error-handler";

const logger = createLogger("profile-manager");

export interface Profile {
  name: string;
  projectDir: string;
  logLevel: "debug" | "info" | "warn" | "error";
  aiProvider: string;
  tools: string[];
  metadata?: Record<string, unknown>;
}

export class ProfileManager {
  private profiles: Map<string, Profile> = new Map();
  private currentProfile: string = "default";

  constructor() {
    this.initializeDefaultProfile();
  }

  /**
   * Initialize default profile
   */
  private initializeDefaultProfile() {
    const defaultProfile: Profile = {
      name: "default",
      projectDir: "./projects",
      logLevel: "info",
      aiProvider: "openai",
      tools: ["file-read", "file-write", "list-dir"],
    };

    this.profiles.set("default", defaultProfile);
    logger.debug("Default profile initialized");
  }

  /**
   * Create a new profile
   */
  createProfile(name: string, config: Partial<Profile>): Profile {
    if (this.profiles.has(name)) {
      throw new ConfigError(`Profile "${name}" already exists`);
    }

    const profile: Profile = {
      name,
      projectDir: config.projectDir || "./projects",
      logLevel: config.logLevel || "info",
      aiProvider: config.aiProvider || "openai",
      tools: config.tools || [],
      metadata: config.metadata,
    };

    this.profiles.set(name, profile);
    logger.info({ profile: name }, "Profile created");

    return profile;
  }

  /**
   * Get a profile
   */
  getProfile(name: string): Profile | undefined {
    return this.profiles.get(name);
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): Profile {
    const profile = this.profiles.get(this.currentProfile);
    if (!profile) {
      throw new ConfigError(`Current profile "${this.currentProfile}" not found`);
    }
    return profile;
  }

  /**
   * Set current profile
   */
  setCurrentProfile(name: string): void {
    if (!this.profiles.has(name)) {
      throw new ConfigError(`Profile "${name}" not found`);
    }
    this.currentProfile = name;
    logger.info({ profile: name }, "Current profile changed");
  }

  /**
   * List all profiles
   */
  listProfiles(): Profile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Delete a profile
   */
  deleteProfile(name: string): void {
    if (name === "default") {
      throw new ConfigError("Cannot delete default profile");
    }

    if (this.currentProfile === name) {
      this.currentProfile = "default";
    }

    this.profiles.delete(name);
    logger.info({ profile: name }, "Profile deleted");
  }

  /**
   * Update a profile
   */
  updateProfile(name: string, updates: Partial<Profile>): Profile {
    const profile = this.profiles.get(name);
    if (!profile) {
      throw new ConfigError(`Profile "${name}" not found`);
    }

    const updated: Profile = {
      ...profile,
      ...updates,
      name: profile.name, // Prevent name changes
    };

    this.profiles.set(name, updated);
    logger.info({ profile: name }, "Profile updated");

    return updated;
  }

  /**
   * Convert profile to CLI config
   */
  toConfig(profileName?: string): CLIConfig {
    const profile = profileName ? this.profiles.get(profileName) : this.getCurrentProfile();

    if (!profile) {
      throw new ConfigError(`Profile "${profileName}" not found`);
    }

    return {
      version: "0.1.0",
      profile: profile.name,
      projectDir: profile.projectDir,
      logLevel: profile.logLevel,
      aiProvider: profile.aiProvider,
      tools: profile.tools,
    };
  }
}

/**
 * Global profile manager instance
 */
let globalProfileManager: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
  if (!globalProfileManager) {
    globalProfileManager = new ProfileManager();
  }
  return globalProfileManager;
}

export function resetProfileManager() {
  globalProfileManager = null;
}
