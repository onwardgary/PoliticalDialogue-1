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
      mode: z.enum(["debate", "discuss"]).optional().default("debate"),
    });
    
    try {
      const { partyId, topic, mode } = bodySchema.parse(req.body);
      
      const party = await storage.getParty(partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      
      // Create system message
      const systemMessage = createPartySystemMessage(party.shortName);
      
      // Create welcome message - adjust based on mode
      let welcomeMessage = {
        id: nanoid(),
        role: "assistant" as const,
        content: "",
        timestamp: Date.now(),
      };
      
      if (mode === "debate") {
        welcomeMessage.content = `Hello! I'm the ${party.name} Bot, representing the positions of the ${party.name}. Let's debate policy positions. Challenge me on any policy area, and we'll engage in a point-by-point debate with clear positions. What would you like to debate today?`;
      } else { // discuss mode
        welcomeMessage.content = `Hello! I'm the ${party.name} Bot, representing the positions of the ${party.name}. I'm here to help you learn about our policy positions and provide recommendations for further learning. What policy area would you like to understand better?`;
      }
      
      // Create new debate with secure ID
      const debate = await storage.createDebate({
        userId,
        partyId,
        topic: topic || null,
        messages: [systemMessage, welcomeMessage],
        secureId: nanoid(), // Generate a secure ID for the debate
        completed: false,
        mode: mode, // Store the conversation mode
      });
      
      // Return debate with welcome message only (no system message)
      res.status(201).json({
        id: debate.id,
        secureId: debate.secureId,
        partyId: debate.partyId,
        topic: debate.topic,
        mode: mode,
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
      const userId = req.user.id;
      const userDebates = await storage.getUserDebates(userId);
      
      // Prepare debates for client (remove sensitive info, filter messages)
      const debatesList = userDebates.map(debate => ({
        id: debate.id,
        secureId: debate.secureId,
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
          // Add assistant message with searchEnabled flag
          const assistantMessage = {
            id: nanoid(),
            role: "assistant" as const,
            content: assistantResponse.content,
            timestamp: Date.now(),
            searchEnabled: assistantResponse.searchEnabled
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
          // Add assistant message with searchEnabled flag
          const assistantMessage = {
            id: nanoid(),
            role: "assistant" as const,
            content: assistantResponse.content,
            timestamp: Date.now(),
            searchEnabled: assistantResponse.searchEnabled
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
  
  // Regenerate a debate summary with secure ID
  app.post("/api/debates/s/:secureId/regenerate-summary", async (req, res) => {
    // For demo purposes, we're allowing anyone to regenerate summaries
    const isGuest = !req.isAuthenticated();
    
    try {
      const secureId = req.params.secureId;
      console.log(`Regenerating summary for debate with secure ID ${secureId}`);
      
      const debate = await storage.getDebateBySecureId(secureId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      // Only check authorization if user is authenticated and not the owner
      if (!isGuest && debate.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to access this debate" });
      }
      
      if (!debate.completed) {
        return res.status(400).json({ message: "This debate is not completed yet" });
      }
      
      console.log(`Generating new summary for debate ${debate.id} (${secureId})...`);
      
      try {
        // Generate summary
        const summary = await generateDebateSummary(debate.messages);
        
        console.log(`Got new summary, updating debate ${debate.id} (${secureId})`);
        // Update debate with new summary
        const updatedDebate = await storage.completeDebate(debate.id, summary);
        
        // Return summary
        res.json({ summary });
      } catch (openAiError) {
        console.error(`OpenAI API error for regenerating debate summary ${debate.id} (${secureId}):`, openAiError);
        
        // Return error so the user can try again
        res.status(500).json({ 
          message: "Failed to regenerate summary. Please try again.",
          error: openAiError.message
        });
      }
    } catch (error) {
      console.error("Error regenerating debate summary:", error);
      res.status(500).json({ message: "Failed to regenerate debate summary" });
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
        return res.status(400).json({ message: "Can only vote on completed debates" });
      }
      
      // Check if user has already voted
      const existingVotes = await storage.getVotesForDebate(debateId);
      const userVote = existingVotes.find(vote => vote.userId === req.user.id);
      
      if (userVote) {
        return res.status(400).json({ message: "You have already voted on this debate" });
      }
      
      // Record vote
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
      console.error("Error voting on debate:", error);
      res.status(500).json({ message: "Failed to record vote" });
    }
  });
  
  // Vote on a debate - secure ID version
  app.post("/api/debates/s/:secureId/vote", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const bodySchema = z.object({
      votedFor: z.enum(["party", "citizen"]),
    });
    
    try {
      const { votedFor } = bodySchema.parse(req.body);
      const secureId = req.params.secureId;
      
      const debate = await storage.getDebateBySecureId(secureId);
      
      if (!debate) {
        return res.status(404).json({ message: "Debate not found" });
      }
      
      if (!debate.completed) {
        return res.status(400).json({ message: "Can only vote on completed debates" });
      }
      
      // Check if user has already voted
      const existingVotes = await storage.getVotesForDebate(debate.id);
      const userVote = existingVotes.find(vote => vote.userId === req.user.id);
      
      if (userVote) {
        return res.status(400).json({ message: "You have already voted on this debate" });
      }
      
      // Record vote
      const vote = await storage.createVote({
        userId: req.user.id,
        debateId: debate.id,
        votedFor,
      });
      
      res.status(201).json({ message: "Vote recorded successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid vote data", errors: error.errors });
      }
      console.error("Error voting on debate:", error);
      res.status(500).json({ message: "Failed to record vote" });
    }
  });
  
  // Get trending topics/debates for all parties
  app.get("/api/trending/:period", async (req, res) => {
    try {
      const period = req.params.period || "weekly";
      const limit = parseInt(req.query.limit as string || "20");
      
      const trending = await storage.getTrendingTopics(period, limit);
      
      res.json(trending);
    } catch (error) {
      console.error("Error fetching trending topics:", error);
      res.status(500).json({ message: "Failed to fetch trending topics" });
    }
  });
  
  // Get trending topics/debates for a specific party
  app.get("/api/trending/:period/:partyId", async (req, res) => {
    try {
      const period = req.params.period || "weekly";
      const partyId = parseInt(req.params.partyId);
      
      const party = await storage.getParty(partyId);
      if (!party) {
        return res.status(404).json({ message: "Party not found" });
      }
      
      const trending = await storage.getAggregateSummariesByParty(partyId, period);
      
      res.json(trending);
    } catch (error) {
      console.error("Error fetching party trending topics:", error);
      res.status(500).json({ message: "Failed to fetch trending topics for this party" });
    }
  });
  
  // Admin endpoints for knowledge base management
  
  // Get all knowledge base entries
  app.get("/api/knowledge", async (req, res) => {
    try {
      const entries = await storage.getKnowledgeBaseEntries();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching knowledge base entries:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base entries" });
    }
  });
  
  // Get knowledge base entries for a specific party
  app.get("/api/knowledge/party/:partyId", async (req, res) => {
    try {
      const partyId = parseInt(req.params.partyId);
      const entries = await storage.getKnowledgeBaseEntriesByParty(partyId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching knowledge base entries for party:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base entries for this party" });
    }
  });
  
  // Get a specific knowledge base entry
  app.get("/api/knowledge/:id", async (req, res) => {
    try {
      const entryId = parseInt(req.params.id);
      const entry = await storage.getKnowledgeBaseEntry(entryId);
      
      if (!entry) {
        return res.status(404).json({ message: "Knowledge base entry not found" });
      }
      
      res.json(entry);
    } catch (error) {
      console.error("Error fetching knowledge base entry:", error);
      res.status(500).json({ message: "Failed to fetch knowledge base entry" });
    }
  });
  
  // Create a new knowledge base entry (admin only)
  app.post("/api/knowledge", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to create knowledge base entries" });
    }
    
    try {
      const entry = req.body;
      
      // Create the entry
      const newEntry = await storage.createKnowledgeBaseEntry(entry, req.user.id);
      
      res.status(201).json(newEntry);
    } catch (error) {
      console.error("Error creating knowledge base entry:", error);
      res.status(500).json({ message: "Failed to create knowledge base entry" });
    }
  });
  
  // Update a knowledge base entry (admin only)
  app.patch("/api/knowledge/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to update knowledge base entries" });
    }
    
    try {
      const entryId = parseInt(req.params.id);
      
      // Get the existing entry
      const existingEntry = await storage.getKnowledgeBaseEntry(entryId);
      
      if (!existingEntry) {
        return res.status(404).json({ message: "Knowledge base entry not found" });
      }
      
      // Update the entry
      const updates = req.body;
      const updatedEntry = await storage.updateKnowledgeBaseEntry(entryId, updates);
      
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating knowledge base entry:", error);
      res.status(500).json({ message: "Failed to update knowledge base entry" });
    }
  });
  
  // Delete a knowledge base entry (admin only)
  app.delete("/api/knowledge/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to delete knowledge base entries" });
    }
    
    try {
      const entryId = parseInt(req.params.id);
      
      // Verify the entry exists
      const existingEntry = await storage.getKnowledgeBaseEntry(entryId);
      
      if (!existingEntry) {
        return res.status(404).json({ message: "Knowledge base entry not found" });
      }
      
      // Delete the entry
      await storage.deleteKnowledgeBaseEntry(entryId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting knowledge base entry:", error);
      res.status(500).json({ message: "Failed to delete knowledge base entry" });
    }
  });
  
  // For demo purposes only: Add sample aggregate summaries
  app.post("/api/demo/add-sample-summaries", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to add sample data" });
    }
    
    try {
      // Sample topics
      const topics = [
        "Healthcare reform",
        "Public transportation improvements",
        "Education policy changes",
        "Housing affordability crisis",
        "Climate change initiatives",
        "Immigration policy",
        "Economic development strategy",
        "Public safety and policing",
        "Tax policy reform",
        "Infrastructure investment"
      ];
      
      // Create sample summaries
      const now = new Date();
      
      // Create for PAP (party ID 1)
      for (const topic of topics) {
        await storage.createAggregateSummary({
          date: now,
          partyId: 1, // PAP
          topic,
          period: "weekly",
          partyArguments: [
            "Government has made significant investments in this area",
            "Long-term strategic planning has guided policy development",
            "Results show measurable improvements over time",
            "PAP's approach balances various stakeholder needs",
            "Pragmatic policies yield sustainable outcomes"
          ],
          citizenArguments: [
            "Citizens have expressed concerns about implementation pace",
            "Some communities feel underserved by current policies",
            "Questions raised about cost efficiency and transparency",
            "Alternative approaches suggested by community advocates",
            "Requests for more direct community involvement"
          ],
          totalDebates: Math.floor(Math.random() * 50) + 10,
          partyVotes: Math.floor(Math.random() * 70) + 30,
          citizenVotes: Math.floor(Math.random() * 70) + 30
        });
      }
      
      // Create for WP (party ID 2)
      for (const topic of topics.slice(0, 5)) {
        await storage.createAggregateSummary({
          date: now,
          partyId: 2, // WP
          topic,
          period: "weekly",
          partyArguments: [
            "Workers' Party advocates for more inclusive policies",
            "More oversight and accountability is needed",
            "Current approach leaves gaps for vulnerable populations",
            "WP proposes alternative funding mechanisms",
            "Policy implementation needs more community consultation"
          ],
          citizenArguments: [
            "Citizens have mixed experiences with current systems",
            "Concerns about long-term sustainability of policies",
            "Questions about equitable distribution of resources",
            "Some support for maintaining existing frameworks",
            "Desire for more innovative approaches to problems"
          ],
          totalDebates: Math.floor(Math.random() * 30) + 5,
          partyVotes: Math.floor(Math.random() * 50) + 20,
          citizenVotes: Math.floor(Math.random() * 50) + 20
        });
      }
      
      // Create for PSP (party ID 3)
      for (const topic of topics.slice(5, 8)) {
        await storage.createAggregateSummary({
          date: now,
          partyId: 3, // PSP
          topic,
          period: "weekly",
          partyArguments: [
            "Progress Singapore Party believes in more transparent governance",
            "Citizens deserve more direct input on major policy decisions",
            "Current policies require significant reform",
            "PSP advocates for stronger checks and balances",
            "A fresh approach would yield better outcomes"
          ],
          citizenArguments: [
            "Some citizens express satisfaction with current policies",
            "Concerns about disruption from major policy changes",
            "Questions about implementation feasibility",
            "Mixed opinions on proposed alternatives",
            "General desire for improved service delivery"
          ],
          totalDebates: Math.floor(Math.random() * 20) + 3,
          partyVotes: Math.floor(Math.random() * 40) + 10,
          citizenVotes: Math.floor(Math.random() * 40) + 10
        });
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