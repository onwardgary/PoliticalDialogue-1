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
    console.log("Generating party response with API key present:", !!API_KEY);
    console.log("Number of messages:", messages.length);
    
    // Convert Messages to OpenAI format
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    console.log("Sending request to OpenAI API...");
    
    // Add a timeout to the OpenAI request
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API request timed out after 15 seconds")), 15000);
    });
    
    const apiPromise = openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 800,
    });
    
    // Race the API promise against the timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    console.log("Received response from OpenAI API");
    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating party response:", error);
    // Provide more detailed error information
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    // Return a fallback response instead of throwing
    return "I apologize, but I'm having trouble connecting to our AI service at the moment. Please try again shortly.";
  }
}

// Generate a debate summary
export async function generateDebateSummary(messages: Message[]): Promise<DebateSummary> {
  try {
    console.log("Generating debate summary with API key present:", !!API_KEY);
    console.log("Number of messages for summary:", messages.length);
    
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
    
    console.log("Sending summary request to OpenAI API...");
    
    // Add a timeout to the OpenAI request
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API request timed out after 20 seconds")), 20000);
    });
    
    const apiPromise = openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.5,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    // Race the API promise against the timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    console.log("Received summary response from OpenAI API");
    const summaryText = response.choices[0].message.content || "{}";
    
    try {
      console.log("Parsing summary JSON response:", summaryText);
      const summary = JSON.parse(summaryText) as DebateSummary;
      
      return {
        partyArguments: summary.partyArguments || [],
        citizenArguments: summary.citizenArguments || []
      };
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError);
      // Provide a fallback summary
      return {
        partyArguments: ["The AI provided arguments about this topic"],
        citizenArguments: ["The citizen raised questions about this topic"]
      };
    }
  } catch (error) {
    console.error("Error generating debate summary:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    // Return a fallback summary instead of throwing
    return {
      partyArguments: ["Technical difficulties prevented proper summary"],
      citizenArguments: ["Technical difficulties prevented proper summary"]
    };
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
