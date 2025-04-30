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
    // Allow both authenticated and unauthenticated users to start debates
    let userId;
    
    if (req.isAuthenticated()) {
      // Use the authenticated user's ID
      userId = req.user.id;
    } else {
      // Use a guest user for unauthenticated sessions
      try {
        // Check if there's already a guest user
        let guestUser = await storage.getUserByUsername("guest");
        
        if (!guestUser) {
          // Create a demo guest user for testing purposes
          guestUser = await storage.createUser({
            username: "guest",
            password: "guest-password-not-for-login", // This is just for demo, never used for login
            email: "guest@example.com",
            isAdmin: false
          });
        }
        
        userId = guestUser.id;
      } catch (error) {
        console.error("Error creating guest user:", error);
        return res.status(500).json({ message: "Failed to create guest user" });
      }
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
      
      // Customize welcome message based on topic
      let welcomeContent = `Hello! I'm the ${party.name} Bot, representing the positions of the ${party.name}.`;
      
      if (topic) {
        welcomeContent += ` I understand you want to discuss ${topic}. What specific aspects of this issue would you like to explore?`;
      } else {
        welcomeContent += ` What would you like to discuss today? We can talk about housing, education, healthcare, the economy, or any other policy area you're interested in.`;
      }
      
      // Create welcome message
      const welcomeMessage = {
        id: nanoid(),
        role: "assistant" as const,
        content: welcomeContent,
        timestamp: Date.now(),
      };
      
      // Create debate
      const debate = await storage.createDebate({
        userId,
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
      console.error("Error creating debate:", error);
      res.status(500).json({ message: "Failed to create debate" });
    }
  });
  
  // Get completed debates with summaries and recommendations
  app.get("/api/debates/completed", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string || "10");
      
      // Get all user debates
      const allDebates = await storage.getAllDebates();
      
      // Filter to only completed debates with summaries
      const completedDebates = allDebates
        .filter(debate => debate.completed && debate.summary)
        .slice(0, limit);
      
      if (completedDebates.length === 0) {
        return res.json([]);
      }
      
      res.json(completedDebates);
    } catch (error) {
      console.error("Error fetching completed debates:", error);
      res.status(500).json({ message: "Failed to fetch completed debates" });
    }
  });
  
  // Get a specific debate by numeric ID (legacy route for backward compatibility)
  app.get("/api/debates/:id([0-9]+)", async (req, res) => {
    // For demo purposes, we're allowing anyone to access debates
    const isGuest = !req.isAuthenticated();
    
    try {
      const debateId = parseInt(req.params.id);
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      // Filter out system messages
      const filteredMessages = debate.messages.filter(msg => msg.role !== "system");
      
      res.json({
        ...debate,
        messages: filteredMessages,
      });
    } catch (error) {
      console.error("Error fetching debate:", error);
      res.status(500).json({ message: "Failed to fetch debate" });
    }
  });
  
  // Get a specific debate by secure ID (preferred method)
  app.get("/api/debates/s/:secureId", async (req, res) => {
    // For demo purposes, we're allowing anyone to access debates
    const isGuest = !req.isAuthenticated();
    
    try {
      const secureId = req.params.secureId;
      const debate = await storage.getDebateBySecureId(secureId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      // Filter out system messages
      const filteredMessages = debate.messages.filter(msg => msg.role !== "system");
      
      res.json({
        ...debate,
        messages: filteredMessages,
      });
    } catch (error) {
      console.error("Error fetching debate by secure ID:", error);
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
  // Send message in debate - legacy numeric ID version
  app.post("/api/debates/:id([0-9]+)/messages", async (req, res) => {
    // For demo purposes, we're allowing anyone to send messages
    const isGuest = !req.isAuthenticated();
    
    const bodySchema = z.object({
      content: z.string().min(1),
    });
    
    try {
      const { content } = bodySchema.parse(req.body);
      const debateId = parseInt(req.params.id);
      console.log(`Processing message for debate ${debateId}`);
      
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (debate.completed) {
        return res.status(400).json({ message: "This debate has already been completed" });
      }
      
      console.log(`Creating user message for debate ${debateId}`);
      // Add user message
      const userMessage = {
        id: nanoid(),
        role: "user" as const,
        content,
        timestamp: Date.now(),
      };
      
      const updatedMessages = [...debate.messages, userMessage];
      
      // First, immediately update the debate with the user message
      // This ensures the user message is saved right away
      await storage.updateDebateMessages(debateId, updatedMessages);
      
      // Begin an asynchronous process to generate and save the AI response
      // Don't await this - we'll respond to the client immediately
      (async () => {
        try {
          console.log(`Generating AI response for debate ${debateId}...`);
          // Generate AI response with a timeout
          const assistantResponse = await generatePartyResponse(updatedMessages);
          
          console.log(`Got AI response, creating assistant message for debate ${debateId}`);
          // Add assistant message
          const assistantMessage = {
            id: nanoid(),
            role: "assistant" as const,
            content: assistantResponse,
            timestamp: Date.now(),
          };
          
          const finalMessages = [...updatedMessages, assistantMessage];
          
          // Update debate with assistant message
          await storage.updateDebateMessages(debateId, finalMessages);
          console.log(`Updated debate ${debateId} with AI response`);
        } catch (openAiError) {
          console.error(`OpenAI API error for debate ${debateId}:`, openAiError);
          
          // Create a fallback message when OpenAI fails
          const fallbackMessage = {
            id: nanoid(),
            role: "assistant" as const,
            content: "I'm sorry, I'm having trouble connecting to our AI service. Please try again in a moment.",
            timestamp: Date.now(),
          };
          
          const fallbackMessages = [...updatedMessages, fallbackMessage];
          await storage.updateDebateMessages(debateId, fallbackMessages);
          console.log(`Updated debate ${debateId} with fallback message due to API error`);
        }
      })().catch(err => console.error(`Unhandled error in AI response generation for debate ${debateId}:`, err));
      
      // Respond to the client immediately with just the user message
      // This reduces latency since we don't wait for the AI response
      res.status(201).json({
        userMessage,
        // No assistantMessage here; the client will get it via polling or socket update
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message content", errors: error.errors });
      }
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // Send message in debate - secure ID version
  app.post("/api/debates/s/:secureId/messages", async (req, res) => {
    // For demo purposes, we're allowing anyone to send messages
    const isGuest = !req.isAuthenticated();
    
    const bodySchema = z.object({
      content: z.string().min(1),
    });
    
    try {
      const { content } = bodySchema.parse(req.body);
      const secureId = req.params.secureId;
      console.log(`Processing message for debate with secure ID ${secureId}`);
      
      const debate = await storage.getDebateBySecureId(secureId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (debate.completed) {
        return res.status(400).json({ message: "This debate has already been completed" });
      }
      
      console.log(`Creating user message for debate ${debate.id} (${secureId})`);
      // Add user message
      const userMessage = {
        id: nanoid(),
        role: "user" as const,
        content,
        timestamp: Date.now(),
      };
      
      const updatedMessages = [...debate.messages, userMessage];
      
      // First, immediately update the debate with the user message
      // This ensures the user message is saved right away
      await storage.updateDebateMessages(debate.id, updatedMessages);
      
      // Begin an asynchronous process to generate and save the AI response
      // Don't await this - we'll respond to the client immediately
      (async () => {
        try {
          console.log(`Generating AI response for debate ${debate.id} (${secureId})...`);
          // Generate AI response with a timeout
          const assistantResponse = await generatePartyResponse(updatedMessages);
          
          console.log(`Got AI response, creating assistant message for debate ${debate.id} (${secureId})`);
          // Add assistant message
          const assistantMessage = {
            id: nanoid(),
            role: "assistant" as const,
            content: assistantResponse,
            timestamp: Date.now(),
          };
          
          const finalMessages = [...updatedMessages, assistantMessage];
          
          // Update debate with assistant message
          await storage.updateDebateMessages(debate.id, finalMessages);
          console.log(`Updated debate ${debate.id} (${secureId}) with AI response`);
        } catch (openAiError) {
          console.error(`OpenAI API error for debate ${debate.id} (${secureId}):`, openAiError);
          
          // Create a fallback message when OpenAI fails
          const fallbackMessage = {
            id: nanoid(),
            role: "assistant" as const,
            content: "I'm sorry, I'm having trouble connecting to our AI service. Please try again in a moment.",
            timestamp: Date.now(),
          };
          
          const fallbackMessages = [...updatedMessages, fallbackMessage];
          await storage.updateDebateMessages(debate.id, fallbackMessages);
          console.log(`Updated debate ${debate.id} (${secureId}) with fallback message due to API error`);
        }
      })().catch(err => console.error(`Unhandled error in AI response generation for debate ${debate.id} (${secureId}):`, err));
      
      // Respond to the client immediately with just the user message
      // This reduces latency since we don't wait for the AI response
      res.status(201).json({
        userMessage,
        // No assistantMessage here; the client will get it via polling or socket update
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message content", errors: error.errors });
      }
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });
  
  // End debate and generate summary - legacy numeric ID version
  app.post("/api/debates/:id([0-9]+)/end", async (req, res) => {
    // For demo purposes, we're allowing anyone to end debates
    const isGuest = !req.isAuthenticated();
    
    try {
      const debateId = parseInt(req.params.id);
      console.log(`Ending debate ${debateId}`);
      
      const debate = await storage.getDebate(debateId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (debate.completed) {
        return res.status(400).json({ message: "This debate has already been completed" });
      }
      
      console.log(`Generating summary for debate ${debateId}...`);
      
      try {
        // Generate summary
        const summary = await generateDebateSummary(debate.messages);
        
        console.log(`Got summary, completing debate ${debateId}`);
        // Update debate with summary and mark as completed
        const updatedDebate = await storage.completeDebate(debateId, summary);
        
        // Return summary
        res.json({ summary });
      } catch (openAiError) {
        console.error(`OpenAI API error for debate summary ${debateId}:`, openAiError);
        
        // Create a fallback summary when OpenAI fails
        const fallbackSummary = {
          partyArguments: ["The party presented their official position on this topic",
                         "The party highlighted key policy initiatives",
                         "The party explained the reasoning behind their approach",
                         "The party addressed specific concerns raised",
                         "The party outlined their vision for the future"],
          citizenArguments: ["The citizen asked about specific policies",
                           "The citizen raised concerns about implementation",
                           "The citizen shared personal perspectives",
                           "The citizen questioned certain aspects of the policy",
                           "The citizen engaged with different viewpoints"]
        };
        
        // Still complete the debate with the fallback summary
        await storage.completeDebate(debateId, fallbackSummary);
        
        // Return the fallback summary
        res.json({ summary: fallbackSummary });
      }
    } catch (error) {
      console.error("Error ending debate:", error);
      res.status(500).json({ message: "Failed to end debate and generate summary" });
    }
  });
  
  // End debate and generate summary - secure ID version
  app.post("/api/debates/s/:secureId/end", async (req, res) => {
    // For demo purposes, we're allowing anyone to end debates
    const isGuest = !req.isAuthenticated();
    
    try {
      const secureId = req.params.secureId;
      console.log(`Ending debate with secure ID ${secureId}`);
      
      const debate = await storage.getDebateBySecureId(secureId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (debate.completed) {
        return res.status(400).json({ message: "This debate has already been completed" });
      }
      
      console.log(`Generating summary for debate ${debate.id} (${secureId})...`);
      
      try {
        // Generate summary
        const summary = await generateDebateSummary(debate.messages);
        
        console.log(`Got summary, completing debate ${debate.id} (${secureId})`);
        // Update debate with summary and mark as completed
        const updatedDebate = await storage.completeDebate(debate.id, summary);
        
        // Return summary
        res.json({ summary });
      } catch (openAiError) {
        console.error(`OpenAI API error for debate summary ${debate.id} (${secureId}):`, openAiError);
        
        // Create a fallback summary when OpenAI fails
        const fallbackSummary = {
          partyArguments: ["The party presented their official position on this topic",
                         "The party highlighted key policy initiatives",
                         "The party explained the reasoning behind their approach",
                         "The party addressed specific concerns raised",
                         "The party outlined their vision for the future"],
          citizenArguments: ["The citizen asked about specific policies",
                           "The citizen raised concerns about implementation",
                           "The citizen shared personal perspectives",
                           "The citizen questioned certain aspects of the policy",
                           "The citizen engaged with different viewpoints"]
        };
        
        // Still complete the debate with the fallback summary
        await storage.completeDebate(debate.id, fallbackSummary);
        
        // Return the fallback summary
        res.json({ summary: fallbackSummary });
      }
    } catch (error) {
      console.error("Error ending debate:", error);
      res.status(500).json({ message: "Failed to end debate and generate summary" });
    }
  });

  // Vote on a debate - legacy numeric ID version
  app.post("/api/debates/:id([0-9]+)/vote", async (req, res) => {
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
  
  // Knowledge Base API Endpoints
  
  // Get all knowledge base entries
  app.get("/api/knowledge", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "You don't have permission to access the knowledge base" });
    }
    
    try {
      const entries = await storage.getKnowledgeBaseEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base entries" });
    }
  });
  
  // Get knowledge base entries for a specific party
  app.get("/api/knowledge/party/:partyId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "You don't have permission to access the knowledge base" });
    }
    
    try {
      const partyId = parseInt(req.params.partyId);
      const entries = await storage.getKnowledgeBaseEntriesByParty(partyId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base entries" });
    }
  });
  
  // Get a specific knowledge base entry
  app.get("/api/knowledge/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "You don't have permission to access the knowledge base" });
    }
    
    try {
      const id = parseInt(req.params.id);
      const entry = await storage.getKnowledgeBaseEntry(id);
      
      if (!entry) {
        return res.status(404).json({ message: "Knowledge base entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base entry" });
    }
  });
  
  // Create a new knowledge base entry
  app.post("/api/knowledge", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "You don't have permission to add to the knowledge base" });
    }
    
    const bodySchema = z.object({
      partyId: z.number(),
      title: z.string(),
      content: z.string(),
      source: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    
    try {
      const data = bodySchema.parse(req.body);
      const entry = await storage.createKnowledgeBaseEntry(data, req.user.id);
      res.status(201).json(entry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create knowledge base entry" });
    }
  });
  
  // Update a knowledge base entry
  app.patch("/api/knowledge/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "You don't have permission to update the knowledge base" });
    }
    
    const bodySchema = z.object({
      partyId: z.number().optional(),
      title: z.string().optional(),
      content: z.string().optional(),
      source: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    
    try {
      const id = parseInt(req.params.id);
      const data = bodySchema.parse(req.body);
      
      // Make sure the entry exists
      const existingEntry = await storage.getKnowledgeBaseEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ message: "Knowledge base entry not found" });
      }
      
      const updatedEntry = await storage.updateKnowledgeBaseEntry(id, data);
      res.json(updatedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid entry data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update knowledge base entry" });
    }
  });
  
  // Delete a knowledge base entry
  app.delete("/api/knowledge/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "You don't have permission to delete from the knowledge base" });
    }
    
    try {
      const id = parseInt(req.params.id);
      
      // Make sure the entry exists
      const existingEntry = await storage.getKnowledgeBaseEntry(id);
      if (!existingEntry) {
        return res.status(404).json({ message: "Knowledge base entry not found" });
      }
      
      await storage.deleteKnowledgeBaseEntry(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete knowledge base entry" });
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
