import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { and, eq } from "drizzle-orm";
import { IStorage } from "./storage";
import {
  users,
  parties,
  debates,
  votes,
  aggregateSummaries,
  knowledgeBase,
  type User,
  type InsertUser,
  type Party,
  type Debate,
  type Vote,
  type AggregateSummary,
  type InsertDebate,
  type InsertVote,
  type InsertAggregateSummary,
  type Message,
  type DebateSummary,
  type KnowledgeBase,
  type InsertKnowledgeBase
} from "@shared/schema";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error in getUser:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error("Error in getUserByUsername:", error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error("Error in getUserByEmail:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const [newUser] = await db.insert(users).values(user).returning();
      return newUser;
    } catch (error) {
      console.error("Error in createUser:", error);
      throw error;
    }
  }

  // Party methods
  async getParties(): Promise<Party[]> {
    try {
      return await db.select().from(parties);
    } catch (error) {
      console.error("Error in getParties:", error);
      return [];
    }
  }

  async getParty(id: number): Promise<Party | undefined> {
    try {
      const [party] = await db.select().from(parties).where(eq(parties.id, id));
      return party;
    } catch (error) {
      console.error("Error in getParty:", error);
      return undefined;
    }
  }

  async getPartyByShortName(shortName: string): Promise<Party | undefined> {
    try {
      const [party] = await db.select().from(parties).where(eq(parties.shortName, shortName));
      return party;
    } catch (error) {
      console.error("Error in getPartyByShortName:", error);
      return undefined;
    }
  }

  // Debate methods
  async createDebate(debate: InsertDebate): Promise<Debate> {
    try {
      // Generate a secure unique ID using nanoid
      const { nanoid } = await import('nanoid');
      const secureId = nanoid(16); // Create a 16-character secure ID
      
      const [newDebate] = await db.insert(debates).values({
        ...debate,
        secureId
      }).returning();
      
      return newDebate;
    } catch (error) {
      console.error("Error in createDebate:", error);
      throw error;
    }
  }

  async getDebate(id: number): Promise<Debate | undefined> {
    try {
      const [debate] = await db.select().from(debates).where(eq(debates.id, id));
      return debate;
    } catch (error) {
      console.error("Error in getDebate:", error);
      return undefined;
    }
  }
  
  async getDebateBySecureId(secureId: string): Promise<Debate | undefined> {
    try {
      const [debate] = await db.select().from(debates).where(eq(debates.secureId, secureId));
      return debate;
    } catch (error) {
      console.error("Error in getDebateBySecureId:", error);
      return undefined;
    }
  }

  async getUserDebates(userId: number): Promise<Debate[]> {
    try {
      return await db.select().from(debates).where(eq(debates.userId, userId));
    } catch (error) {
      console.error("Error in getUserDebates:", error);
      return [];
    }
  }
  
  async getAllDebates(): Promise<Debate[]> {
    try {
      return await db.select().from(debates);
    } catch (error) {
      console.error("Error in getAllDebates:", error);
      return [];
    }
  }

  async updateDebateMessages(id: number, messages: Message[]): Promise<Debate> {
    try {
      const [updatedDebate] = await db
        .update(debates)
        .set({ 
          messages, 
          updatedAt: new Date() 
        })
        .where(eq(debates.id, id))
        .returning();
      
      if (!updatedDebate) {
        throw new Error("Debate not found");
      }
      
      return updatedDebate;
    } catch (error) {
      console.error("Error in updateDebateMessages:", error);
      throw error;
    }
  }

  async completeDebate(id: number, summary: DebateSummary): Promise<Debate> {
    try {
      const [updatedDebate] = await db
        .update(debates)
        .set({ 
          summary, 
          completed: true, 
          updatedAt: new Date() 
        })
        .where(eq(debates.id, id))
        .returning();
      
      if (!updatedDebate) {
        throw new Error("Debate not found");
      }
      
      return updatedDebate;
    } catch (error) {
      console.error("Error in completeDebate:", error);
      throw error;
    }
  }

  // Vote methods
  async createVote(vote: InsertVote): Promise<Vote> {
    try {
      const [newVote] = await db.insert(votes).values(vote).returning();
      return newVote;
    } catch (error) {
      console.error("Error in createVote:", error);
      throw error;
    }
  }

  async getVotesForDebate(debateId: number): Promise<Vote[]> {
    try {
      return await db.select().from(votes).where(eq(votes.debateId, debateId));
    } catch (error) {
      console.error("Error in getVotesForDebate:", error);
      return [];
    }
  }

  // Summary methods
  async createAggregateSummary(summary: InsertAggregateSummary): Promise<AggregateSummary> {
    try {
      const [newSummary] = await db.insert(aggregateSummaries).values(summary).returning();
      return newSummary;
    } catch (error) {
      console.error("Error in createAggregateSummary:", error);
      throw error;
    }
  }

  async getAggregateSummaries(period: string): Promise<AggregateSummary[]> {
    try {
      return await db.select().from(aggregateSummaries).where(eq(aggregateSummaries.period, period));
    } catch (error) {
      console.error("Error in getAggregateSummaries:", error);
      return [];
    }
  }

  async getAggregateSummariesByParty(partyId: number, period: string): Promise<AggregateSummary[]> {
    try {
      return await db
        .select()
        .from(aggregateSummaries)
        .where(
          and(
            eq(aggregateSummaries.partyId, partyId),
            eq(aggregateSummaries.period, period)
          )
        );
    } catch (error) {
      console.error("Error in getAggregateSummariesByParty:", error);
      return [];
    }
  }

  async getTrendingTopics(period: string, limit: number): Promise<AggregateSummary[]> {
    try {
      // Combine partyVotes and citizenVotes for sorting
      const results = await db
        .select()
        .from(aggregateSummaries)
        .where(eq(aggregateSummaries.period, period));
      
      // Sort by total votes and limit
      return results
        .sort((a, b) => {
          const aVotes = (a.partyVotes || 0) + (a.citizenVotes || 0);
          const bVotes = (b.partyVotes || 0) + (b.citizenVotes || 0);
          return bVotes - aVotes;
        })
        .slice(0, limit);
    } catch (error) {
      console.error("Error in getTrendingTopics:", error);
      return [];
    }
  }

  // Knowledge Base methods
  async getKnowledgeBaseEntries(): Promise<KnowledgeBase[]> {
    try {
      return await db.select().from(knowledgeBase);
    } catch (error) {
      console.error("Error in getKnowledgeBaseEntries:", error);
      return [];
    }
  }

  async getKnowledgeBaseEntriesByParty(partyId: number): Promise<KnowledgeBase[]> {
    try {
      return await db.select().from(knowledgeBase).where(eq(knowledgeBase.partyId, partyId));
    } catch (error) {
      console.error("Error in getKnowledgeBaseEntriesByParty:", error);
      return [];
    }
  }

  async getKnowledgeBaseEntry(id: number): Promise<KnowledgeBase | undefined> {
    try {
      const [entry] = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id));
      return entry;
    } catch (error) {
      console.error("Error in getKnowledgeBaseEntry:", error);
      return undefined;
    }
  }

  async createKnowledgeBaseEntry(entry: InsertKnowledgeBase, userId: number): Promise<KnowledgeBase> {
    try {
      const [newEntry] = await db
        .insert(knowledgeBase)
        .values({
          ...entry,
          addedById: userId
        })
        .returning();
      
      return newEntry;
    } catch (error) {
      console.error("Error in createKnowledgeBaseEntry:", error);
      throw error;
    }
  }

  async updateKnowledgeBaseEntry(id: number, entry: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase> {
    try {
      const [updatedEntry] = await db
        .update(knowledgeBase)
        .set({ 
          ...entry, 
          updatedAt: new Date() 
        })
        .where(eq(knowledgeBase.id, id))
        .returning();
      
      if (!updatedEntry) {
        throw new Error("Knowledge base entry not found");
      }
      
      return updatedEntry;
    } catch (error) {
      console.error("Error in updateKnowledgeBaseEntry:", error);
      throw error;
    }
  }

  async deleteKnowledgeBaseEntry(id: number): Promise<void> {
    try {
      const result = await db
        .delete(knowledgeBase)
        .where(eq(knowledgeBase.id, id));
    } catch (error) {
      console.error("Error in deleteKnowledgeBaseEntry:", error);
      throw error;
    }
  }
}