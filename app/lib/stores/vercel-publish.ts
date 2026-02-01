import { atom } from 'nanostores';
import type { PublishedVersion, PublishHistory } from '~/types/vercel';

// Store for tracking published versions per project
const storedHistory = typeof window !== 'undefined' ? localStorage.getItem('vercel_publish_history') : null;
let initialHistory: PublishHistory = {};

if (storedHistory) {
  try {
    initialHistory = JSON.parse(storedHistory);
  } catch (error) {
    console.error('Error parsing publish history:', error);
    initialHistory = {};
  }
}

export const publishHistory = atom<PublishHistory>(initialHistory);

// Track the currently publishing state for UI feedback
export const isPublishing = atom<boolean>(false);
export const publishError = atom<string | null>(null);
export const lastPublished = atom<PublishedVersion | null>(null);

/**
 * Add a published version to history
 */
export const addPublishedVersion = (version: PublishedVersion) => {
  const currentHistory = publishHistory.get();
  const projectId = version.projectId;

  if (!currentHistory[projectId]) {
    currentHistory[projectId] = [];
  }

  // Add to the beginning (most recent first)
  currentHistory[projectId].unshift(version);

  // Keep only last 10 versions per project (configurable)
  const MAX_VERSIONS_PER_PROJECT = 10;
  if (currentHistory[projectId].length > MAX_VERSIONS_PER_PROJECT) {
    currentHistory[projectId] = currentHistory[projectId].slice(0, MAX_VERSIONS_PER_PROJECT);
  }

  publishHistory.set(currentHistory);
  lastPublished.set(version);

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('vercel_publish_history', JSON.stringify(currentHistory));
  }
};

/**
 * Get all published versions for a project
 */
export const getProjectPublished = (projectId: string): PublishedVersion[] => {
  return publishHistory.get()[projectId] || [];
};

/**
 * Get the most recent published version for a project
 */
export const getLatestPublished = (projectId: string): PublishedVersion | null => {
  const versions = getProjectPublished(projectId);
  return versions.length > 0 ? versions[0] : null;
};

/**
 * Remove a published version from history
 */
export const removePublishedVersion = (projectId: string, versionTimestamp: string) => {
  const currentHistory = publishHistory.get();

  if (currentHistory[projectId]) {
    currentHistory[projectId] = currentHistory[projectId].filter(
      (v) => v.versionTimestamp !== versionTimestamp,
    );

    if (currentHistory[projectId].length === 0) {
      delete currentHistory[projectId];
    }

    publishHistory.set(currentHistory);

    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('vercel_publish_history', JSON.stringify(currentHistory));
    }
  }
};

/**
 * Clear all publish history
 */
export const clearPublishHistory = () => {
  publishHistory.set({});
  lastPublished.set(null);

  if (typeof window !== 'undefined') {
    localStorage.removeItem('vercel_publish_history');
  }
};

/**
 * Set publishing state and error
 */
export const setPublishingState = (isPublishing: boolean, error: string | null = null) => {
  // Use direct imports to avoid circular dependency
  const module = require('./vercel-publish');
  module.isPublishing.set(isPublishing);
  if (error) {
    module.publishError.set(error);
  } else {
    module.publishError.set(null);
  }
};
