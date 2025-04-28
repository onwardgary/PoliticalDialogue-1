import { users, parties, debates, votes, aggregateSummaries, knowledgeBase, type User, type InsertUser, type Party, type Debate, type Vote, type AggregateSummary, type InsertDebate, type InsertVote, type InsertAggregateSummary, type Message, type DebateSummary, type KnowledgeBase, type InsertKnowledgeBase } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { nanoid } from "nanoid";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Party methods
  getParties(): Promise<Party[]>;
  getParty(id: number): Promise<Party | undefined>;
  getPartyByShortName(shortName: string): Promise<Party | undefined>;
  
  // Debate methods
  createDebate(debate: InsertDebate): Promise<Debate>;
  getDebate(id: number): Promise<Debate | undefined>;
  getUserDebates(userId: number): Promise<Debate[]>;
  getAllDebates(): Promise<Debate[]>;
  updateDebateMessages(id: number, messages: Message[]): Promise<Debate>;
  completeDebate(id: number, summary: DebateSummary): Promise<Debate>;
  
  // Vote methods
  createVote(vote: InsertVote): Promise<Vote>;
  getVotesForDebate(debateId: number): Promise<Vote[]>;
  
  // Summary methods
  createAggregateSummary(summary: InsertAggregateSummary): Promise<AggregateSummary>;
  getAggregateSummaries(period: string): Promise<AggregateSummary[]>;
  getAggregateSummariesByParty(partyId: number, period: string): Promise<AggregateSummary[]>;
  getTrendingTopics(period: string, limit: number): Promise<AggregateSummary[]>;
  
  // Knowledge Base methods
  getKnowledgeBaseEntries(): Promise<KnowledgeBase[]>;
  getKnowledgeBaseEntriesByParty(partyId: number): Promise<KnowledgeBase[]>;
  getKnowledgeBaseEntry(id: number): Promise<KnowledgeBase | undefined>;
  createKnowledgeBaseEntry(entry: InsertKnowledgeBase, userId: number): Promise<KnowledgeBase>;
  updateKnowledgeBaseEntry(id: number, entry: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase>;
  deleteKnowledgeBaseEntry(id: number): Promise<void>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private parties: Map<number, Party>;
  private debates: Map<number, Debate>;
  private votes: Map<number, Vote>;
  private summaries: Map<number, AggregateSummary>;
  private knowledgeBase: Map<number, KnowledgeBase>;
  
  currentUserId: number;
  currentPartyId: number;
  currentDebateId: number;
  currentVoteId: number;
  currentSummaryId: number;
  currentKnowledgeBaseId: number;
  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.parties = new Map();
    this.debates = new Map();
    this.votes = new Map();
    this.summaries = new Map();
    this.knowledgeBase = new Map();
    
    this.currentUserId = 1;
    this.currentPartyId = 1;
    this.currentDebateId = 1;
    this.currentVoteId = 1;
    this.currentSummaryId = 1;
    this.currentKnowledgeBaseId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Initialize with default parties
    this.initializeParties();
  }
  
  private initializeParties() {
    const defaultParties = [
      {
        id: this.currentPartyId++,
        name: "People's Action Party",
        shortName: "PAP",
        color: "#2563eb", // primary blue
        description: "Singapore's ruling party since independence, focused on pragmatic policies."
      },
      {
        id: this.currentPartyId++,
        name: "Workers' Party",
        shortName: "WP",
        color: "#1d4ed8", // darker blue
        description: "Singapore's leading opposition party advocating for a more balanced political landscape."
      },
      {
        id: this.currentPartyId++,
        name: "Progress Singapore Party",
        shortName: "PSP",
        color: "#ef4444", // red
        description: "A newer political party focused on transparency and accountability in governance."
      }
    ];
    
    defaultParties.forEach(party => {
      this.parties.set(party.id, party);
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }
  
  // Party methods
  async getParties(): Promise<Party[]> {
    return Array.from(this.parties.values());
  }
  
  async getParty(id: number): Promise<Party | undefined> {
    return this.parties.get(id);
  }
  
  async getPartyByShortName(shortName: string): Promise<Party | undefined> {
    return Array.from(this.parties.values()).find(
      (party) => party.shortName === shortName,
    );
  }
  
  // Debate methods
  async createDebate(debate: InsertDebate): Promise<Debate> {
    const id = this.currentDebateId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const newDebate: Debate = { ...debate, id, createdAt, updatedAt };
    this.debates.set(id, newDebate);
    return newDebate;
  }
  
  async getDebate(id: number): Promise<Debate | undefined> {
    return this.debates.get(id);
  }
  
  async getUserDebates(userId: number): Promise<Debate[]> {
    return Array.from(this.debates.values()).filter(
      (debate) => debate.userId === userId,
    );
  }
  
  async getAllDebates(): Promise<Debate[]> {
    return Array.from(this.debates.values());
  }
  
  async updateDebateMessages(id: number, messages: Message[]): Promise<Debate> {
    const debate = this.debates.get(id);
    if (!debate) {
      throw new Error("Debate not found");
    }
    
    const updatedDebate: Debate = {
      ...debate,
      messages,
      updatedAt: new Date()
    };
    
    this.debates.set(id, updatedDebate);
    return updatedDebate;
  }
  
  async completeDebate(id: number, summary: DebateSummary): Promise<Debate> {
    const debate = this.debates.get(id);
    if (!debate) {
      throw new Error("Debate not found");
    }
    
    const updatedDebate: Debate = {
      ...debate,
      summary,
      completed: true,
      updatedAt: new Date()
    };
    
    this.debates.set(id, updatedDebate);
    return updatedDebate;
  }
  
  // Vote methods
  async createVote(vote: InsertVote): Promise<Vote> {
    const id = this.currentVoteId++;
    const createdAt = new Date();
    const newVote: Vote = { ...vote, id, createdAt };
    this.votes.set(id, newVote);
    return newVote;
  }
  
  async getVotesForDebate(debateId: number): Promise<Vote[]> {
    return Array.from(this.votes.values()).filter(
      (vote) => vote.debateId === debateId,
    );
  }
  
  // Summary methods
  async createAggregateSummary(summary: InsertAggregateSummary): Promise<AggregateSummary> {
    const id = this.currentSummaryId++;
    const newSummary: AggregateSummary = { ...summary, id };
    this.summaries.set(id, newSummary);
    return newSummary;
  }
  
  async getAggregateSummaries(period: string): Promise<AggregateSummary[]> {
    return Array.from(this.summaries.values()).filter(
      (summary) => summary.period === period,
    );
  }
  
  async getAggregateSummariesByParty(partyId: number, period: string): Promise<AggregateSummary[]> {
    return Array.from(this.summaries.values()).filter(
      (summary) => summary.partyId === partyId && summary.period === period,
    );
  }
  
  async getTrendingTopics(period: string, limit: number): Promise<AggregateSummary[]> {
    return Array.from(this.summaries.values())
      .filter((summary) => summary.period === period)
      .sort((a, b) => {
        const bVotes = (b.partyVotes || 0) + (b.citizenVotes || 0);
        const aVotes = (a.partyVotes || 0) + (a.citizenVotes || 0);
        return bVotes - aVotes;
      })
      .slice(0, limit);
  }

  // Knowledge Base methods
  async getKnowledgeBaseEntries(): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBase.values());
  }

  async getKnowledgeBaseEntriesByParty(partyId: number): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBase.values()).filter(
      (entry) => entry.partyId === partyId
    );
  }

  async getKnowledgeBaseEntry(id: number): Promise<KnowledgeBase | undefined> {
    return this.knowledgeBase.get(id);
  }

  async createKnowledgeBaseEntry(entry: InsertKnowledgeBase, userId: number): Promise<KnowledgeBase> {
    const id = this.currentKnowledgeBaseId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const addedById = userId;
    
    const newEntry: KnowledgeBase = { 
      ...entry, 
      id, 
      createdAt, 
      updatedAt, 
      addedById 
    };
    
    this.knowledgeBase.set(id, newEntry);
    return newEntry;
  }

  async updateKnowledgeBaseEntry(id: number, entry: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase> {
    const existingEntry = this.knowledgeBase.get(id);
    if (!existingEntry) {
      throw new Error("Knowledge base entry not found");
    }
    
    const updatedEntry: KnowledgeBase = {
      ...existingEntry,
      ...entry,
      updatedAt: new Date()
    };
    
    this.knowledgeBase.set(id, updatedEntry);
    return updatedEntry;
  }

  async deleteKnowledgeBaseEntry(id: number): Promise<void> {
    const exists = this.knowledgeBase.has(id);
    if (!exists) {
      throw new Error("Knowledge base entry not found");
    }
    
    this.knowledgeBase.delete(id);
  }
}

// Comment out MemStorage usage and replace with DatabaseStorage
// export const storage = new MemStorage();

// Import and use DatabaseStorage instead
import { DatabaseStorage } from "./dbStorage";
export const storage = new DatabaseStorage();
