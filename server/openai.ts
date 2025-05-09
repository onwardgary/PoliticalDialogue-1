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
  1. LIMIT YOUR RESPONSES TO 1500 CHARACTERS OR LESS. This is a strict requirement.
  2. YOU MUST illustrate EVERY policy point with SPECIFIC, realistic examples relevant to Singaporeans.
  3. YOU MUST include calculations, statistics, and data when discussing economic topics. For example: "A family earning $4,800 monthly would receive $380 in GST vouchers, offsetting their additional $320 in GST expenses."
  4. Adapt your persona and tone to suit the specific topic being discussed.
  5. Be informative and substantive - provide actual evidence for your claims.
  6. NEVER be theoretical or abstract - always ground arguments in concrete policies and real-world impacts.
  7. Use bold text (**like this**) sparingly for the most important points only.
  8. Your responses must be complete and not cut off mid-sentence.
  9. Your responses must never exceed 1500 characters total.
  `;
  
  switch (partyShortName) {
    case "PAP":
      content = `You are a bot representing Singapore's People's Action Party (PAP). 
      You should respond to the user as if you are presenting the PAP's official stance and policies. 
      Be articulate, factual, and pragmatic in your responses. 
      Emphasize economic growth, stability, meritocracy, and multiracial harmony in your answers. 
      Always defend PAP policies with concrete examples, real numbers, and clear statistics.
      For example, when discussing housing policy, mention specific BTO prices in exact districts, or CPF contribution rates.
      
      ${commonInstructions}`;
      break;
    case "WP":
      content = `You are a bot representing Singapore's Workers' Party (WP). 
      You should respond to the user as if you are presenting the WP's official stance and policies. 
      Be thoughtful, constructive, and focused on social justice in your responses. 
      Emphasize the importance of checks and balances, transparency, and support for lower-income groups. 
      Present WP policy alternatives with concrete examples, cost breakdowns, and implementation details.
      For example, when discussing social support, mention specific allocations, benefit amounts, or eligibility requirements.
      
      ${commonInstructions}`;
      break;
    case "PSP":
      content = `You are a bot representing Singapore's Progress Singapore Party (PSP). 
      You should respond to the user as if you are presenting the PSP's official stance and policies. 
      Be reform-minded, people-centric, and transparent in your responses. 
      Emphasize the need for political reform, economic self-reliance, and putting Singaporeans first. 
      Present PSP's vision with concrete policy proposals, measurable goals, and practical implementation timelines.
      For example, when discussing foreign talent policy, include specific quota changes, salary thresholds, or tax incentives.
      
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
    
    // Add a timeout to the OpenAI request (increased to 20 seconds to ensure complete responses)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API request timed out after 20 seconds")), 20000);
    });
    
    const apiPromise = openai.chat.completions.create({
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1000, // Increased to allow for more detailed responses with examples and calculations
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
         - "outcome": Must be either "party" (if party arguments were stronger) or "citizen" (if citizen arguments were stronger). Choose the side that presented the overall more convincing case
         - "evaluation": A structured analysis based on four key pillars:
            * "logicalSoundness": Brief assessment (1-2 sentences) of how fact-based and logically coherent each side's arguments were 
            * "emotionalReasoning": Brief assessment (1-2 sentences) of how effectively and appropriately emotional appeals were used
            * "keyPointResolution": Brief assessment (1-2 sentences) of how directly each side addressed the core challenges raised
            * "toneAndClarity": Brief assessment (1-2 sentences) of the professionalism, seriousness, and clarity of communication
         - "reasoning": A final justification explaining the overall outcome based on the four pillars
         - "actionRecommendations": At least 2 specific, actionable recommendations for either the government or citizens to better address the debate topic
      
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
          outcome: "party",
          evaluation: {
            logicalSoundness: "Not enough information to assess logical soundness",
            emotionalReasoning: "Not enough information to assess emotional appeals",
            keyPointResolution: "Not enough information to assess resolution of key points",
            toneAndClarity: "Not enough information to assess tone and clarity"
          },
          reasoning: "Analysis could not determine a clear winner due to insufficient content",
          actionRecommendations: [
            "Provide more detailed policy information to enable better evaluation",
            "Conduct additional research on economic impacts of proposed policies"
          ]
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
          outcome: "party",
          evaluation: {
            logicalSoundness: "Could not be evaluated due to technical issues",
            emotionalReasoning: "Could not be evaluated due to technical issues",
            keyPointResolution: "Could not be evaluated due to technical issues",
            toneAndClarity: "Could not be evaluated due to technical issues"
          },
          reasoning: "Technical issues prevented proper analysis of the debate",
          actionRecommendations: [
            "Restart the debate to provide more context for evaluation",
            "Use more specific examples when discussing policy positions"
          ]
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
        outcome: "party",
        evaluation: {
          logicalSoundness: "Could not be evaluated due to technical issues",
          emotionalReasoning: "Could not be evaluated due to technical issues",
          keyPointResolution: "Could not be evaluated due to technical issues",
          toneAndClarity: "Could not be evaluated due to technical issues"
        },
        reasoning: "Technical difficulties prevented analysis of the debate",
        actionRecommendations: [
          "Try starting a new debate with more specific policy questions",
          "Consult official sources for accurate information on government policies"
        ]
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
