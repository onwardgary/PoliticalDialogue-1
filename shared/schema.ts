import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  isAdmin: boolean("is_admin").default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
});

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

export const parties = pgTable("parties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  shortName: text("short_name").notNull().unique(),
  color: text("color").notNull(),
  description: text("description").notNull(),
});

export const debates = pgTable("debates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  partyId: integer("party_id").references(() => parties.id).notNull(),
  topic: text("topic"),
  messages: json("messages").$type<Message[]>().notNull(),
  summary: json("summary").$type<DebateSummary>(),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  debateId: integer("debate_id").references(() => debates.id).notNull(),
  votedFor: text("voted_for").notNull(), // 'party' or 'citizen'
  createdAt: timestamp("created_at").defaultNow(),
});

export const aggregateSummaries = pgTable("aggregate_summaries", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").references(() => parties.id).notNull(),
  topic: text("topic").notNull(),
  period: text("period").notNull(), // 'daily', 'weekly', 'monthly'
  date: timestamp("date").notNull(),
  partyVotes: integer("party_votes").default(0),
  citizenVotes: integer("citizen_votes").default(0),
  partyArguments: json("party_arguments").$type<string[]>().notNull(),
  citizenArguments: json("citizen_arguments").$type<string[]>().notNull(),
  totalDebates: integer("total_debates").notNull(),
});

// Knowledge base table for RAG implementation
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  partyId: integer("party_id").references(() => parties.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  source: text("source"), // Optional source of the information
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  addedById: integer("added_by_id").references(() => users.id).notNull(),
  isActive: boolean("is_active").default(true), // Allow disabling entries without deletion
});

export type DebateSummary = {
  partyArguments: string[];
  citizenArguments: string[];
};

export type Party = typeof parties.$inferSelect;
export type InsertParty = typeof parties.$inferInsert;

export type Debate = typeof debates.$inferSelect;
export type InsertDebate = typeof debates.$inferInsert;

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

export type AggregateSummary = typeof aggregateSummaries.$inferSelect;
export type InsertAggregateSummary = typeof aggregateSummaries.$inferInsert;

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).pick({
  partyId: true,
  title: true,
  content: true,
  source: true,
  isActive: true,
});

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
