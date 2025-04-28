import OpenAI from "openai";
import { type Message, type DebateSummary } from "@shared/schema";

// Using the latest version of GPT-4o as requested by the user
const MODEL = "chatgpt-4o-latest";

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
  
  const commonInstructions = `
  IMPORTANT COMMUNICATION GUIDELINES:
  1. ALWAYS LIMIT YOUR RESPONSES TO 280 CHARACTERS OR LESS, LIKE A TWEET. This is a strict requirement.
  2. Illustrate your points with brief, realistic examples relevant to Singaporeans.
  3. Adapt your persona and tone to suit the specific topic being discussed.
  4. Be extremely concise but informative - focus on quality over quantity.
  5. Use bold text (**like this**) sparingly for the most important points only.
  6. Your responses must never exceed 280 characters total.
  `;
  
  switch (partyShortName) {
    case "PAP":
      content = `You are a bot representing Singapore's People's Action Party (PAP). 
      You should respond to the user as if you are presenting the PAP's official stance and policies. 
      Be articulate, factual, and pragmatic in your responses. 
      Emphasize economic growth, stability, meritocracy, and multiracial harmony in your answers. 
      Defend PAP policies with concrete examples and statistics when possible.
      
      ${commonInstructions}`;
      break;
    case "WP":
      content = `You are a bot representing Singapore's Workers' Party (WP). 
      You should respond to the user as if you are presenting the WP's official stance and policies. 
      Be thoughtful, constructive, and focused on social justice in your responses. 
      Emphasize the importance of checks and balances, transparency, and support for lower-income groups. 
      Present WP policy alternatives while acknowledging Singapore's constraints.
      
      ${commonInstructions}`;
      break;
    case "PSP":
      content = `You are a bot representing Singapore's Progress Singapore Party (PSP). 
      You should respond to the user as if you are presenting the PSP's official stance and policies. 
      Be reform-minded, people-centric, and transparent in your responses. 
      Emphasize the need for political reform, economic self-reliance, and putting Singaporeans first. 
      Present PSP's vision for a more competitive and compassionate Singapore.
      
      ${commonInstructions}`;
      break;
    default:
      content = `You are a bot representing a Singaporean political party. 
      You should respond to the user with balanced and informative answers about Singapore's political system and policies.
      
      ${commonInstructions}`;
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
      max_tokens: 100, // Reduced to ensure we get responses under 280 characters
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
      content: `Analyze this debate and provide a comprehensive structured summary with the following components:

      1. "partyArguments": The top 5 key arguments made by the political party (the assistant) - concise but specific
      2. "citizenArguments": The top 5 key arguments made by the citizen (the user) - concise but specific
      3. "keyPoints": An array of the most important points of contention, with each object containing:
         - "point": The core issue being debated
         - "partyPosition": The party's stance on this issue
         - "citizenPosition": The citizen's stance on this issue
      4. "conclusion": An in-depth assessment of the debate with:
         - "outcome": Either "party" (if party arguments were stronger), "citizen" (if citizen arguments were stronger), or "inconclusive" (if the debate was balanced)
         - "evaluation": A structured analysis based on four key pillars:
            * "logicalSoundness": Brief assessment (1-2 sentences) of how fact-based and logically coherent each side's arguments were 
            * "emotionalReasoning": Brief assessment (1-2 sentences) of how effectively and appropriately emotional appeals were used
            * "keyPointResolution": Brief assessment (1-2 sentences) of how directly each side addressed the core challenges raised
            * "toneAndClarity": Brief assessment (1-2 sentences) of the professionalism, seriousness, and clarity of communication
         - "reasoning": A final justification explaining the overall outcome based on the four pillars
      
      Format your response as a JSON object with these properties. Focus on concrete examples mentioned in the debate rather than generalizations. Evaluate the logical strength of arguments, not just quantity or assertion.`
    });
    
    console.log("Sending summary request to OpenAI API...");
    
    // Add a timeout to the OpenAI request (increased for more complex responses)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API request timed out after 30 seconds")), 30000);
    });
    
    const apiPromise = openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.5,
      max_tokens: 2000, // Increased to handle larger and more detailed responses
      response_format: { type: "json_object" }
    });
    
    // Race the API promise against the timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    console.log("Received summary response from OpenAI API");
    const summaryText = response.choices[0].message.content || "{}";
    
    try {
      console.log("Parsing summary JSON response:", summaryText);
      const summary = JSON.parse(summaryText) as DebateSummary;
      
      // Return comprehensive summary with all components
      return {
        partyArguments: summary.partyArguments || [],
        citizenArguments: summary.citizenArguments || [],
        keyPoints: summary.keyPoints || [],
        conclusion: summary.conclusion || {
          outcome: "inconclusive",
          evaluation: {
            logicalSoundness: "Not enough information to assess logical soundness",
            emotionalReasoning: "Not enough information to assess emotional appeals",
            keyPointResolution: "Not enough information to assess resolution of key points",
            toneAndClarity: "Not enough information to assess tone and clarity"
          },
          reasoning: "Analysis could not determine a clear winner due to insufficient content"
        }
      };
    } catch (jsonError) {
      console.error("Error parsing JSON response:", jsonError);
      // Provide a fallback summary with all required properties
      return {
        partyArguments: ["The AI provided arguments about this topic"],
        citizenArguments: ["The citizen raised questions about this topic"],
        keyPoints: [{
          point: "Topic discussion",
          partyPosition: "Official party position on this topic",
          citizenPosition: "Citizen's concerns and questions about this topic"
        }],
        conclusion: {
          outcome: "inconclusive",
          evaluation: {
            logicalSoundness: "Could not be evaluated due to technical issues",
            emotionalReasoning: "Could not be evaluated due to technical issues",
            keyPointResolution: "Could not be evaluated due to technical issues",
            toneAndClarity: "Could not be evaluated due to technical issues"
          },
          reasoning: "Technical issues prevented proper analysis of the debate"
        }
      };
    }
  } catch (error) {
    console.error("Error generating debate summary:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    // Return a complete fallback summary instead of throwing
    return {
      partyArguments: ["Technical difficulties prevented proper summary"],
      citizenArguments: ["Technical difficulties prevented proper summary"],
      keyPoints: [{
        point: "Technical issue",
        partyPosition: "Could not be analyzed due to technical issues",
        citizenPosition: "Could not be analyzed due to technical issues"
      }],
      conclusion: {
        outcome: "inconclusive",
        evaluation: {
          logicalSoundness: "Could not be evaluated due to technical issues",
          emotionalReasoning: "Could not be evaluated due to technical issues",
          keyPointResolution: "Could not be evaluated due to technical issues",
          toneAndClarity: "Could not be evaluated due to technical issues"
        },
        reasoning: "Technical difficulties prevented analysis of the debate"
      }
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
    
    Format your response as a JSON object with these two arrays. Focus on the following:
    - Include concrete examples that were mentioned (e.g. policy impact on young families)
    - Highlight the strongest and most recurring points
    - Keep each point concise (under 100 characters) but specific
    - Avoid vague generalizations; focus on concrete policy positions
    `;
    
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 1500, // Increased to handle larger responses
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
