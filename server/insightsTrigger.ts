import { storage } from './storage';
import { debateAnalytics } from './analytics';

// Store latest analytics results in memory for fast access
let cachedInsights: {
  wordCloudData: any[];
  ministryBusyness: any[];
  totalDebates: number;
  totalTopics: number;
  lastUpdated: Date;
} | null = null;

let isUpdating = false;

/**
 * Trigger analytics update when a new debate completes
 * This should be called from the debate completion endpoint
 */
export async function triggerInsightsUpdate(): Promise<void> {
  if (isUpdating) {
    console.log('Insights update already in progress, skipping');
    return;
  }

  try {
    isUpdating = true;
    console.log('Triggering insights update after debate completion');
    
    const insights = await debateAnalytics.generateInsights();
    cachedInsights = {
      ...insights,
      lastUpdated: new Date()
    };
    
    console.log(`Updated insights: ${insights.totalTopics} topics from ${insights.totalDebates} debates`);
  } catch (error) {
    console.error('Error updating insights:', error);
  } finally {
    isUpdating = false;
  }
}

/**
 * Get cached insights or generate them if not available
 */
export async function getCachedInsights() {
  // If no cache exists, generate initial insights
  if (!cachedInsights) {
    console.log('No cached insights found, generating initial data');
    await triggerInsightsUpdate();
  }

  return cachedInsights || {
    wordCloudData: [],
    ministryBusyness: [],
    totalDebates: 0,
    totalTopics: 0,
    lastUpdated: new Date()
  };
}

/**
 * Force refresh insights (for admin use)
 */
export async function forceRefreshInsights(): Promise<void> {
  cachedInsights = null;
  await triggerInsightsUpdate();
}