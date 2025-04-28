import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { nanoid } from "nanoid";
import { createPartySystemMessage, generatePartyResponse, generateDebateSummary, generateAggregateSummary } from "./openai";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Get political parties
  app.get("/api/parties", async (req, res) => {
    try {
      const parties = await storage.getParties();
      res.json(parties);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch parties" });
    }
  });
  
  // Start a new debate
  app.post("/api/debates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const bodySchema = z.object({
      partyId: z.number(),
      topic: z.string().optional(),
    });
    
    try {
      const { partyId, topic } = bodySchema.parse(req.body);
      
      const party = await storage.getParty(partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      
      // Create system message
      const systemMessage = createPartySystemMessage(party.shortName);
      
      // Create welcome message
      const welcomeMessage = {
        id: nanoid(),
        role: "assistant" as const,
        content: `Hello! I'm the ${party.name} Bot, representing the positions of the ${party.name}. What would you like to discuss today? We can talk about housing, education, healthcare, the economy, or any other policy area you're interested in.`,
        timestamp: Date.now(),
      };
      
      // Create debate
      const debate = await storage.createDebate({
        userId: req.user.id,
        partyId,
        topic: topic || null,
        messages: [systemMessage, welcomeMessage],
        completed: false,
      });
      
      res.status(201).json({
        id: debate.id,
        partyId: debate.partyId,
        topic: debate.topic,
        messages: [welcomeMessage], // Only send the welcome message, not the system message
        createdAt: debate.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create debate" });
    }
  });
  
  // Get a specific debate
  app.get("/api/debates/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const debateId = parseInt(req.params.id);
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      if (debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      // Filter out system messages
      const filteredMessages = debate.messages.filter(msg => msg.role !== "system");
      
      res.json({
        ...debate,
        messages: filteredMessages,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch debate" });
    }
  });
  
  // Get user's debates
  app.get("/api/user/debates", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const debates = await storage.getUserDebates(req.user.id);
      
      // Don't include messages in the list view
      const debatesList = debates.map(debate => ({
        id: debate.id,
        partyId: debate.partyId,
        topic: debate.topic,
        completed: debate.completed,
        createdAt: debate.createdAt,
        updatedAt: debate.updatedAt,
      }));
      
      res.json(debatesList);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user debates" });
    }
  });
  
  // Send message in debate
  app.post("/api/debates/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const bodySchema = z.object({
      content: z.string().min(1),
    });
    
    try {
      const { content } = bodySchema.parse(req.body);
      const debateId = parseInt(req.params.id);
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      if (debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (debate.completed) {
        return res.status(400).json({ message: "This debate has already been completed" });
      }
      
      // Add user message
      const userMessage = {
        id: nanoid(),
        role: "user" as const,
        content,
        timestamp: Date.now(),
      };
      
      const updatedMessages = [...debate.messages, userMessage];
      
      // Update debate with user message
      await storage.updateDebateMessages(debateId, updatedMessages);
      
      // Generate AI response
      const assistantResponse = await generatePartyResponse(updatedMessages);
      
      // Add assistant message
      const assistantMessage = {
        id: nanoid(),
        role: "assistant" as const,
        content: assistantResponse,
        timestamp: Date.now(),
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      
      // Update debate with assistant message
      const updatedDebate = await storage.updateDebateMessages(debateId, finalMessages);
      
      // Return both messages
      res.status(201).json({
        userMessage,
        assistantMessage,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message content", errors: error.errors });
      }
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // End debate and generate summary
  app.post("/api/debates/:id/end", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const debateId = parseInt(req.params.id);
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      if (debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (debate.completed) {
        return res.status(400).json({ message: "This debate has already been completed" });
      }
      
      // Generate summary
      const summary = await generateDebateSummary(debate.messages);
      
      // Update debate with summary and mark as completed
      const updatedDebate = await storage.completeDebate(debateId, summary);
      
      // Return summary
      res.json({ summary });
    } catch (error) {
      console.error("Error ending debate:", error);
      res.status(500).json({ message: "Failed to end debate and generate summary" });
    }
  });
  
  // Vote on a debate
  app.post("/api/debates/:id/vote", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const bodySchema = z.object({
      votedFor: z.enum(["party", "citizen"]),
    });
    
    try {
      const { votedFor } = bodySchema.parse(req.body);
      const debateId = parseInt(req.params.id);
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      if (!debate.completed) {
        return res.status(400).json({ message: "Cannot vote on an incomplete debate" });
      }
      
      // Create vote
      const vote = await storage.createVote({
        userId: req.user.id,
        debateId,
        votedFor,
      });
      
      res.status(201).json({ message: "Vote recorded successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to record vote" });
    }
  });
  
  // Get trending topics
  app.get("/api/trending/:period", async (req, res) => {
    try {
      const period = req.params.period;
      if (!["daily", "weekly", "monthly"].includes(period)) {
        return res.status(400).json({ message: "Invalid period. Must be 'daily', 'weekly', or 'monthly'" });
      }
      
      const limit = parseInt(req.query.limit as string || "5");
      const trendingTopics = await storage.getTrendingTopics(period, limit);
      
      res.json(trendingTopics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trending topics" });
    }
  });
  
  // For demo purposes only: Add sample aggregate summaries
  app.post("/api/demo/add-sample-summaries", async (req, res) => {
    try {
      // Sample data to populate the trending view
      const sampleSummaries = [
        {
          partyId: 1, // PAP
          topic: "Housing Affordability",
          period: "weekly",
          date: new Date(),
          partyVotes: 82,
          citizenVotes: 152,
          partyArguments: [
            "Government has increased BTO supply to meet demand",
            "COVID-19 caused unforeseen construction delays",
            "Housing grants make homes affordable for most families",
            "Prices remain below market value due to subsidies",
            "Long-term housing strategy balances affordability and quality"
          ],
          citizenArguments: [
            "BTO prices have outpaced wage growth",
            "Wait times are too long for young couples",
            "Prime location policy creates a two-tier public housing system",
            "Government should have built more during economic slowdown",
            "Young Singaporeans forced to live with parents longer"
          ],
          totalDebates: 234
        },
        {
          partyId: 2, // WP
          topic: "Healthcare System",
          period: "weekly",
          date: new Date(),
          partyVotes: 95,
          citizenVotes: 92,
          partyArguments: [
            "Universal healthcare coverage needs expansion",
            "Eldershield should be made compulsory and enhanced",
            "More healthcare resources in heartland areas needed",
            "Reduce out-of-pocket expenses for treatment",
            "Mental health services require more funding"
          ],
          citizenArguments: [
            "Healthcare costs rising faster than subsidies",
            "Long waiting times at public hospitals",
            "Elder care options insufficient for aging population",
            "More transparency in healthcare pricing needed",
            "Caregivers need more support and resources"
          ],
          totalDebates: 187
        },
        {
          partyId: 3, // PSP
          topic: "Foreign Labor Policies",
          period: "weekly",
          date: new Date(),
          partyVotes: 78,
          citizenVotes: 114,
          partyArguments: [
            "Foreign worker dependency undercuts local wages",
            "CECA and other FTAs need review and renegotiation",
            "Foreign labor quotas should be gradually reduced",
            "Skills transfer programs for essential sectors needed",
            "Jobless Singaporeans should be prioritized"
          ],
          citizenArguments: [
            "Stricter enforcement of fair hiring practices needed",
            "Too many employment pass holders in certain sectors",
            "Local companies need incentives to hire Singaporeans",
            "Foreign talent criteria should be more transparent",
            "Wage disparity between locals and foreigners is concerning"
          ],
          totalDebates: 192
        }
      ];
      
      for (const summary of sampleSummaries) {
        await storage.createAggregateSummary(summary);
      }
      
      res.status(201).json({ message: "Sample summaries added successfully" });
    } catch (error) {
      console.error("Error adding sample summaries:", error);
      res.status(500).json({ message: "Failed to add sample summaries" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
