import { db } from "./db";
import { parties } from "@shared/schema";

export async function initializeDatabase() {
  console.log("Checking if database needs initialization...");
  
  // Check if parties table is empty
  const existingParties = await db.select().from(parties);
  
  if (existingParties.length === 0) {
    console.log("Initializing database with default data...");
    
    // Insert default parties
    await db.insert(parties).values([
      {
        name: "People's Action Party",
        shortName: "PAP",
        color: "#2563eb", // primary blue
        description: "Singapore's ruling party since independence, focused on pragmatic policies."
      },
      {
        name: "Workers' Party",
        shortName: "WP",
        color: "#1d4ed8", // darker blue
        description: "Singapore's leading opposition party advocating for a more balanced political landscape."
      },
      {
        name: "Progress Singapore Party",
        shortName: "PSP",
        color: "#ef4444", // red
        description: "A newer political party focused on transparency and accountability in governance."
      }
    ]);
    
    console.log("Database initialization complete!");
  } else {
    console.log("Database already initialized, skipping.");
  }
}