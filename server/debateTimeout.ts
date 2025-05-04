import { storage } from "./storage";
import { log } from "./vite";

// Timeout duration in milliseconds (15 minutes)
const DEBATE_TIMEOUT_MS = 15 * 60 * 1000;

// Map to track last activity time for each debate
const debateActivityMap = new Map<number, number>();

/**
 * Register a debate activity to update its last active timestamp
 * @param debateId The ID of the debate with activity
 */
export function registerDebateActivity(debateId: number): void {
  debateActivityMap.set(debateId, Date.now());
  log(`Registered activity for debate ${debateId}, resetting timeout`);
}

/**
 * Check for inactive debates and mark them as completed
 * This prevents endless polling for abandoned debates
 */
export async function checkInactiveDebates(): Promise<void> {
  const now = Date.now();
  
  // Get all non-completed debates
  const allDebates = await storage.getAllDebates();
  const activeDebates = allDebates.filter(debate => !debate.completed);
  
  for (const debate of activeDebates) {
    // If debate is not in the activity map, add it with current time
    if (!debateActivityMap.has(debate.id)) {
      debateActivityMap.set(debate.id, now);
      continue;
    }
    
    const lastActivity = debateActivityMap.get(debate.id) || 0;
    const inactiveDuration = now - lastActivity;
    
    // If debate has been inactive for more than the timeout period, mark it as completed
    if (inactiveDuration > DEBATE_TIMEOUT_MS) {
      log(`Debate ${debate.id} has been inactive for ${Math.floor(inactiveDuration/60000)} minutes - timing out`);
      
      try {
        // Create a simple timeout summary
        const timeoutSummary = {
          partyArguments: ["This debate was automatically ended due to inactivity."],
          citizenArguments: ["The debate timed out after 15 minutes of inactivity."],
          conclusion: {
            outcome: "party" as const,
            reasoning: "This debate was automatically ended due to 15 minutes of inactivity.",
          }
        };
        
        // Complete the debate with the timeout summary
        await storage.completeDebate(debate.id, timeoutSummary);
        
        // Remove from activity map
        debateActivityMap.delete(debate.id);
        
        log(`Debate ${debate.id} has been automatically completed due to inactivity`);
      } catch (error) {
        console.error(`Error completing inactive debate ${debate.id}:`, error);
      }
    }
  }
  
  // Cleanup activity map - remove entries for completed debates
  for (const debateId of debateActivityMap.keys()) {
    const debate = await storage.getDebate(debateId);
    if (debate?.completed) {
      debateActivityMap.delete(debateId);
    }
  }
}

/**
 * Start the periodic check for inactive debates (runs every 5 minutes)
 */
export function startDebateTimeoutChecker(): void {
  // Run the check every 5 minutes (300000 ms)
  const intervalMs = 5 * 60 * 1000;
  
  log(`Starting debate timeout checker (checking every ${intervalMs/60000} minutes, timeout set to ${DEBATE_TIMEOUT_MS/60000} minutes)`);
  
  setInterval(async () => {
    try {
      await checkInactiveDebates();
    } catch (error) {
      console.error("Error in debate timeout checker:", error);
    }
  }, intervalMs);
}