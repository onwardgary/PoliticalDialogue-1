import { storage } from './storage';
import { debateAnalytics } from './analytics';

// Store latest analytics results in memory for fast access
let cachedInsights: {
  wordCloudData: any[];
  ministryBusyness: any[];
  totalDebates: number;
  totalTopics: number;
  lastUpdated: Date;
  dateRange: {
    startDate: string;
    endDate: string;
  };
} | null = null;

let isUpdating = false;

/**
 * Generate insights for a specific date range (admin-controlled)
 */
export async function generateInsightsForDateRange(startDate: string, endDate: string): Promise<void> {
  if (isUpdating) {
    console.log('Insights update already in progress, skipping');
    return;
  }

  try {
    isUpdating = true;
    console.log(`Generating insights for date range: ${startDate} to ${endDate}`);
    
    const insights = await debateAnalytics.generateInsightsForDateRange(startDate, endDate);
    cachedInsights = {
      ...insights,
      lastUpdated: new Date(),
      dateRange: { startDate, endDate }
    };
    
    console.log(`Generated insights: ${insights.totalTopics} topics from ${insights.totalDebates} debates`);
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  } finally {
    isUpdating = false;
  }
}

/**
 * Get cached insights - returns empty state if no insights generated yet
 */
export async function getCachedInsights() {
  return cachedInsights || {
    wordCloudData: [],
    ministryBusyness: [],
    totalDebates: 0,
    totalTopics: 0,
    lastUpdated: new Date(),
    dateRange: { startDate: '', endDate: '' }
  };
}