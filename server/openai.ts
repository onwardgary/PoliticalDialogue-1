import OpenAI from "openai";
import { type Message, type DebateSummary } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

// Check for API key in multiple possible environment variables
const API_KEY = process.env.OPENAI_API_KEY || 
                process.env.OPENAI_API_KEY_ENV_VAR || 
                process.env.OPENAI_KEY ||
                process.env.open_ai_key_suara;

// Use API key
const openai = new OpenAI({
  apiKey: API_KEY,
});

// Create a system message for the specific political party
export function createPartySystemMessage(partyShortName: string): Message {
  let content = "";
  
  switch (partyShortName) {
    case "PAP":
      content = `You are a bot representing Singapore's People's Action Party (PAP). 
      You should respond to the user as if you are presenting the PAP's official stance and policies. 
      Be articulate, factual, and pragmatic in your responses. 
      Emphasize economic growth, stability, meritocracy, and multiracial harmony in your answers. 
      Defend PAP policies with concrete examples and statistics when possible.`;
      break;
    case "WP":
      content = `You are a bot representing Singapore's Workers' Party (WP). 
      You should respond to the user as if you are presenting the WP's official stance and policies. 
      Be thoughtful, constructive, and focused on social justice in your responses. 
      Emphasize the importance of checks and balances, transparency, and support for lower-income groups. 
      Present WP policy alternatives while acknowledging Singapore's constraints.`;
      break;
    case "PSP":
      content = `You are a bot representing Singapore's Progress Singapore Party (PSP). 
      You should respond to the user as if you are presenting the PSP's official stance and policies. 
      Be reform-minded, people-centric, and transparent in your responses. 
      Emphasize the need for political reform, economic self-reliance, and putting Singaporeans first. 
      Present PSP's vision for a more competitive and compassionate Singapore.`;
      break;
    default:
      content = `You are a bot representing a Singaporean political party. 
      You should respond to the user with balanced and informative answers about Singapore's political system and policies.`;
  }
  
  return {
    id: "system-1",
    role: "system",
    content,
    timestamp: Date.now()
  };
}

// Generate a response from the AI based on the conversation history
export async function generatePartyResponse(messages: Message[]): Promise<string> {
  try {
    // Convert Messages to OpenAI format
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 800,
    });
    
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating party response:", error);
    throw new Error("Failed to generate response from the AI");
  }
}

// Generate a debate summary
export async function generateDebateSummary(messages: Message[]): Promise<DebateSummary> {
  try {
    // Create a prompt for generating a summary
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    formattedMessages.push({
      role: "user",
      content: `Please summarize this debate into two lists:
      1. "partyArguments": The top 5 key arguments made by the political party (the assistant)
      2. "citizenArguments": The top 5 key arguments made by the citizen (the user)
      
      Format your response as a JSON object with these two arrays. Keep each argument concise (under 100 characters) but informative.`
    });
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    const summaryText = response.choices[0].message.content || "{}";
    const summary = JSON.parse(summaryText) as DebateSummary;
    
    return {
      partyArguments: summary.partyArguments || [],
      citizenArguments: summary.citizenArguments || []
    };
  } catch (error) {
    console.error("Error generating debate summary:", error);
    throw new Error("Failed to generate debate summary");
  }
}

// Generate an aggregate summary from multiple debates
export async function generateAggregateSummary(
  allSummaries: DebateSummary[], 
  partyName: string, 
  topic: string
): Promise<{ partyArguments: string[], citizenArguments: string[] }> {
  try {
    // Combine all summaries into a single list for party and citizen arguments
    const allPartyArguments = allSummaries.flatMap(s => s.partyArguments);
    const allCitizenArguments = allSummaries.flatMap(s => s.citizenArguments);
    
    const prompt = `
    I have multiple debate summaries between citizens and ${partyName} on the topic of "${topic}".
    
    Here are all the party arguments:
    ${allPartyArguments.map(arg => `- ${arg}`).join('\n')}
    
    Here are all the citizen arguments:
    ${allCitizenArguments.map(arg => `- ${arg}`).join('\n')}
    
    Please analyze these arguments and provide:
    1. "partyArguments": The top 5 most representative arguments from the party side
    2. "citizenArguments": The top 5 most representative arguments from the citizen side
    
    Format your response as a JSON object with these two arrays. Focus on finding recurring themes and the strongest arguments. Keep each point concise (under 100 characters).
    `;
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    const summaryText = response.choices[0].message.content || "{}";
    const summary = JSON.parse(summaryText) as DebateSummary;
    
    return {
      partyArguments: summary.partyArguments || [],
      citizenArguments: summary.citizenArguments || []
    };
  } catch (error) {
    console.error("Error generating aggregate summary:", error);
    throw new Error("Failed to generate aggregate summary");
  }
}
