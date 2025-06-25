import OpenAI from "openai";
import { type Message, type DebateSummary } from "@shared/schema";

// Models for different purposes
const MODELS = {
  // Standard model for normal conversations and structured output
  STANDARD: "gpt-4o",
  // Search-enabled model for queries requiring up-to-date information
  SEARCH: "gpt-4o-search-preview-2025-03-11"
};

// Check for API key in multiple possible environment variables
const API_KEY = process.env.OPENAI_API_KEY || 
                process.env.OPENAI_API_KEY_ENV_VAR || 
                process.env.OPENAI_KEY ||
                process.env.open_ai_key_suara;

// Use API key
const openai = new OpenAI({
  apiKey: API_KEY,
});

// Helper function to determine if a query requires search capabilities
function requiresSearch(message: string): boolean {
  const searchTerms = [
    'latest', 'recent', 'new', 'current', 'update', 'today', 
    '2024', '2025', 'this year', 'last month', 'this month',
    'manifesto', 'election', 'campaign', 'announcement', 'speech',
    'policy changes', 'introduced', 'announced', 'unveiled',
    'what is your position on', 'what do you think about'
  ];
  
  return searchTerms.some(term => 
    message.toLowerCase().includes(term.toLowerCase())
  );
}

// Select appropriate model based on the purpose and content
function selectModel(purpose: 'conversation' | 'summary' | 'aggregation', userMessage?: string): string {
  // For conversation, check if the query likely needs search
  if (purpose === 'conversation' && userMessage && requiresSearch(userMessage)) {
    console.log("Using search model for query:", userMessage);
    return MODELS.SEARCH;
  }
  
  // For other purposes or non-search queries, use the standard model
  return MODELS.STANDARD;
}

// Create a system message for the specific political party
export function createPartySystemMessage(partyShortName: string): Message {
  let content = "";
  
  const commonInstructions = `
  IMPORTANT COMMUNICATION GUIDELINES:
  1. LIMIT YOUR RESPONSES TO 1500 CHARACTERS OR LESS. This is a strict requirement.
  2. SEARCH FOR UP-TO-DATE INFORMATION WHEN NEEDED. Use web search to find the latest party manifestos, policy positions, and recent developments in Singapore politics, especially from 2024-2025.
  3. YOU MUST illustrate EVERY policy point with SPECIFIC, realistic examples relevant to Singaporeans.
  4. YOU MUST include calculations, statistics, and data when discussing economic topics. For example: "A family earning $4,800 monthly would receive $380 in GST vouchers, offsetting their additional $320 in GST expenses."
  5. Be informative and substantive - provide actual evidence for your claims.
  6. NEVER be theoretical or abstract - always ground arguments in concrete policies and real-world impacts.
  7. Use bold text (**like this**) sparingly for the most important points only.
  8. Your responses must be complete and not cut off mid-sentence.
  9. Your responses must never exceed 1500 characters total.
  10. When searching for information, focus on official party websites, government statistics, and reputable news sources specific to Singapore.
  
  CRITICAL PARTISAN BEHAVIOR:
  11. DEFEND YOUR PARTY'S POSITIONS VIGOROUSLY. Don't just acknowledge citizen concerns - challenge them when they conflict with party policy.
  12. When citizens criticize your party, counter their arguments by explaining why your party's approach is superior and necessary for Singapore.
  13. Use assertive transitions like "However, that overlooks...", "The real issue is...", or "What you're missing is..." to redirect debates back to your party's strengths.
  14. End every response by reinforcing why your party's position is the right choice for Singapore's future.
  15. Be passionate and confident about your party's policies - you're not a neutral mediator, you're an advocate.
  `;
  
  switch (partyShortName) {
    case "PAP":
      content = `You are a PASSIONATE ADVOCATE for Singapore's People's Action Party (PAP) policies and approach to governance.
      IMPORTANT: You are NOT officially endorsed by or affiliated with the PAP. Always clarify this if asked.
      You BELIEVE STRONGLY that PAP's policies are the best path for Singapore and will DEFEND them vigorously against criticism.
      
      YOUR MISSION: Argue convincingly for why PAP's pragmatic, results-driven approach has made Singapore successful and continues to be the right choice.
      
      CORE PAP VALUES TO CHAMPION:
      - Proven track record of economic growth and stability
      - Merit-based governance that delivers results
      - Pragmatic policies over populist promises  
      - Multiracial harmony through careful management
      - Long-term planning that has transformed Singapore
      - Strong institutions and rule of law
      
      RESPONSE FRAMEWORK:
      - Challenge weak arguments with facts and evidence
      - Show how PAP policies deliver tangible benefits to Singaporeans
      - Contrast PAP's proven success with opposition theories
      - Always end by reinforcing PAP's superior approach
      
      ${commonInstructions}`;
      break;
    case "WP":
      content = `You are a PASSIONATE ADVOCATE for Singapore's Workers' Party (WP) vision of a more balanced and representative democracy.
      IMPORTANT: You are NOT officially endorsed by or affiliated with the WP. Always clarify this if asked.
      You BELIEVE STRONGLY that Singapore needs the Workers' Party's alternative voice and will DEFEND WP positions against PAP dominance.
      
      YOUR MISSION: Argue convincingly for why WP's focus on checks and balances, transparency, and social justice offers a better path forward for ordinary Singaporeans.
      
      CORE WP VALUES TO CHAMPION:
      - Democratic accountability through opposition representation
      - Transparency in government decision-making
      - Support for working families and vulnerable groups
      - Genuine consultation with citizens, not top-down governance
      - Alternative policies that prioritize people over profits
      - Parliamentary debate that reflects diverse citizen voices
      
      RESPONSE FRAMEWORK:  
      - Challenge PAP's paternalistic approach with grassroots perspectives
      - Show how WP policies better serve ordinary Singaporeans' needs
      - Expose gaps in PAP governance that opposition oversight could fix
      - Always end by reinforcing why Singapore needs WP's alternative vision
      
      ${commonInstructions}`;
      break;

    default:
      content = `You are an UNOFFICIAL FAN BOT representing perspectives aligned with a Singaporean political party.
      IMPORTANT: You are NOT officially endorsed by or affiliated with any political party. Always clarify this if asked.
      You should respond with balanced and informative perspectives about Singapore's political system and policies.
      
      ${commonInstructions}`;
  }
  
  return {
    id: "system-1",
    role: "system",
    content,
    timestamp: Date.now()
  };
}

// Helper function to extract party from system message
function extractPartyFromMessages(messages: Message[]): string {
  const systemMessage = messages.find(msg => msg.role === 'system');
  if (!systemMessage) return 'unknown';
  
  if (systemMessage.content.includes('People\'s Action Party (PAP)')) return 'PAP';
  if (systemMessage.content.includes('Workers\' Party (WP)')) return 'WP';
  return 'unknown';
}

// Dynamic temperature based on party and conversation length
function getPartyTemperature(party: string, messageCount: number): number {
  const progressiveTemp = Math.min(0.9, 0.6 + (messageCount * 0.05));
  
  switch(party) {
    case 'PAP': return progressiveTemp - 0.05; // Slightly more structured
    case 'WP': return progressiveTemp + 0.05; // Slightly more exploratory
    default: return progressiveTemp;
  }
}

// Party-specific penalties to reduce repetition
function getPartyPenalties(party: string, round: number): {presence_penalty: number, frequency_penalty: number} {
  const roundMultiplier = Math.min(round / 3, 1.5); // Cap the multiplier
  
  switch(party) {
    case 'PAP': 
      return {
        presence_penalty: Math.min(0.6, 0.3 + (roundMultiplier * 0.1)),
        frequency_penalty: Math.min(0.4, 0.2 + (roundMultiplier * 0.05))
      };
    case 'WP':
      return {
        presence_penalty: Math.min(0.7, 0.4 + (roundMultiplier * 0.1)),
        frequency_penalty: Math.min(0.5, 0.3 + (roundMultiplier * 0.05))
      };
    default:
      return { presence_penalty: 0.3, frequency_penalty: 0.2 };
  }
}

// Generate anti-repetition context for each party
function getAntiRepetitionContext(party: string, assistantMessages: Message[]): string {
  if (assistantMessages.length < 2) return '';
  
  const recentPoints = assistantMessages
    .slice(-3) // Last 3 bot messages
    .map(msg => msg.content.substring(0, 100))
    .join(', ');
    
  const baseContext = `\nPREVIOUSLY DISCUSSED: You've covered: ${recentPoints}...
CRITICAL: AVOID repeating these points. Explore NEW angles, different examples, or deeper policy details.`;

  switch(party) {
    case 'PAP':
      return baseContext + `
PAP ANTI-REPETITION STRATEGY:
- Find NEW ways to defend core PAP principles - don't abandon your partisan stance
- Rotate through policy layers: immediate impacts → medium-term planning → long-term vision
- Diversify evidence types: local statistics → international benchmarks → historical comparisons  
- Vary implementation angles: national programs → constituency examples → inter-ministry coordination
- Shift perspectives: economic efficiency → social cohesion → strategic positioning
MAINTAIN: Fierce defense of PAP governance, authoritative expertise, confident advocacy for PAP superiority`;
    
    case 'WP':
      return baseContext + `
WP ANTI-REPETITION STRATEGY:
- Explore DIFFERENT angles of opposition critique - don't move toward PAP's center
- Rotate stakeholder perspectives: working families → elderly → young adults → small businesses
- Vary democratic angles: parliamentary representation → grassroots feedback → policy consultation
- Shift focus areas: immediate relief → structural reform → democratic participation  
- Change advocacy styles: policy critique → alternative proposals → citizen empowerment
MAINTAIN: Strong opposition stance, challenges to PAP dominance, passionate advocacy for democratic alternatives`;
    
    default:
      return baseContext;
  }
}

// Generate a response from the AI based on the conversation history
export async function generatePartyResponse(messages: Message[]): Promise<{content: string, searchEnabled: boolean}> {
  try {
    console.log("Generating party response with API key present:", !!API_KEY);
    console.log("Number of messages:", messages.length);
    
    // Extract party and conversation metrics
    const party = extractPartyFromMessages(messages);
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    const conversationRound = Math.ceil(userMessages.length / 2);
    
    console.log(`Party: ${party}, Round: ${conversationRound}, Assistant messages: ${assistantMessages.length}`);
    
    // Find the latest user message for search capability determination
    const latestUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';
    
    // Select the appropriate model
    const model = selectModel('conversation', latestUserMessage);
    console.log(`Using model for party response: ${model}`);
    
    // Track if search was used
    const searchEnabled = model === MODELS.SEARCH;
    
    // Add anti-repetition context to system message
    const antiRepetitionContext = getAntiRepetitionContext(party, assistantMessages);
    const enhancedMessages = messages.map(msg => {
      if (msg.role === 'system') {
        return {
          ...msg,
          content: msg.content + antiRepetitionContext
        };
      }
      return msg;
    });
    
    // Convert to OpenAI format
    const formattedMessages = enhancedMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    console.log("Sending request to OpenAI API...");
    
    // Timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API request timed out after 20 seconds")), 20000);
    });
    
    // Get dynamic parameters
    const temperature = getPartyTemperature(party, messages.length);
    const penalties = getPartyPenalties(party, conversationRound);
    
    console.log(`Using temperature: ${temperature}, presence_penalty: ${penalties.presence_penalty}, frequency_penalty: ${penalties.frequency_penalty}`);
    
    // Create configuration with dynamic parameters
    const config: any = {
      model: model,
      messages: formattedMessages,
      max_tokens: 1000,
    };
    
    // Add model-specific parameters
    if (model === MODELS.SEARCH) {
      config.web_search_options = {};
      // Search model doesn't support temperature, presence_penalty, frequency_penalty
    } else {
      // Standard model supports all anti-repetition parameters
      config.temperature = temperature;
      config.presence_penalty = penalties.presence_penalty;
      config.frequency_penalty = penalties.frequency_penalty;
    }
    
    // @ts-ignore - Type definitions haven't been updated for search tools
    const apiPromise = openai.chat.completions.create(config);
    
    // Race against timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    console.log("Received response from OpenAI API");
    // @ts-ignore - Type definitions don't match actual API response
    const content = response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
    return { content, searchEnabled };
  } catch (error) {
    console.error("Error generating party response:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    return { 
      content: "I apologize, but I'm having trouble connecting to our AI service at the moment. Please try again shortly.",
      searchEnabled: false 
    };
  }
}

// Generate a debate summary
export async function generateDebateSummary(messages: Message[], mode: string = 'debate'): Promise<DebateSummary> {
  try {
    console.log("Generating debate summary with API key present:", !!API_KEY);
    console.log("Number of messages for summary:", messages.length);
    console.log("Using standard model for summary generation (json_object is required)");
    
    // Create a prompt for generating a summary
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Always use debate format as requested by user
    console.log("Generating summary in debate format (always using debate mode)");
    
    // Always use debate format regardless of the mode parameter
    let promptContent = `Analyze this debate and provide a comprehensive structured summary with the following components:

      1. "partyArguments": The top 5 key arguments made by the political party (the assistant) - concise but specific
      2. "citizenArguments": The top 5 key arguments made by the citizen (the user) - concise but specific
      3. "keyPoints": An array of the most important points of contention, with each object containing:
         - "point": The core issue being debated
         - "partyPosition": The party's stance on this issue
         - "citizenPosition": The citizen's stance on this issue
      4. "stakeholderImpact": Assess which groups in society would be impacted by each side's policies:
         - "party": 
            * "happy": An array of 3-5 groups who would benefit from the party's proposed policies
            * "sad": An array of 3-5 groups who might be disadvantaged by the party's proposed policies
         - "citizen": 
            * "happy": An array of 3-5 groups who would benefit from the citizen's proposed policies
            * "sad": An array of 3-5 groups who might be disadvantaged by the citizen's proposed policies
      5. "policyConsequences": A thorough analysis of the real-world consequences:
         - "party":
            * "positive": An array of 3-5 likely positive outcomes if the party's policies were implemented
            * "negative": An array of 3-5 likely negative outcomes or unintended consequences if the party's policies were implemented
         - "citizen":
            * "positive": An array of 3-5 likely positive outcomes if the citizen's policies were implemented
            * "negative": An array of 3-5 likely negative outcomes or unintended consequences if the citizen's policies were implemented
      6. "conclusion": An in-depth assessment of the debate with:
         - "outcome": Must be either "party" (if party arguments were stronger) or "citizen" (if citizen arguments were stronger). Choose the side that presented the overall more convincing case
         - "evaluation": A structured analysis based on five key pillars:
            * "logicalSoundness": Brief assessment (1-2 sentences) of how fact-based and logically coherent each side's arguments were 
            * "emotionalReasoning": Brief assessment (1-2 sentences) of how effectively and appropriately emotional appeals were used
            * "keyPointResolution": Brief assessment (1-2 sentences) of how directly each side addressed the core challenges raised
            * "toneAndClarity": Brief assessment (1-2 sentences) of the professionalism, seriousness, and clarity of communication
            * "pragmatism": Thorough assessment (3-4 sentences) evaluating which position would most effectively work in practice from Singapore's non-ideological perspective - considering implementation feasibility, economic impact, social outcomes, and alignment with Singapore's unique constraints as a small nation-state with limited resources but high global connectivity
         - "reasoning": A final justification explaining the overall outcome with special emphasis on the pragmatism pillar (which should be weighted more heavily than other pillars due to Singapore's pragmatic governance approach), while still considering all five pillars
         - "actionRecommendations": At least 2 specific, actionable recommendations for either the government or citizens to better address the debate topic`;
    
    // Add common instructions
    promptContent += `
    
    IMPORTANT: Use your web search capabilities to verify facts and claims made during the discussion when needed. This may include looking up official policy positions, economic statistics, or recent political developments in Singapore (2024-2025).
    
    Format your response as a JSON object with these properties. Focus on concrete examples mentioned in the conversation rather than generalizations.`;
    
    formattedMessages.push({
      role: "user",
      content: promptContent
    });
    
    console.log("Sending summary request to OpenAI API...");
    
    // Add a timeout to the OpenAI request (increased for more complex responses)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("OpenAI API request timed out after 30 seconds")), 30000);
    });
    
    // For summary generation, we need structured JSON output which isn't compatible with search
    // So we always use the standard model for summaries, but include web search instructions in the prompt
    // @ts-ignore - The type definitions haven't been updated for retrieval yet
    const apiPromise = openai.chat.completions.create({
      model: MODELS.STANDARD,
      messages: formattedMessages,
      max_tokens: 2000, // Increased to handle larger and more detailed responses
      response_format: { type: "json_object" },
      temperature: 0.5,
    });
    
    // Race the API promise against the timeout
    const response = await Promise.race([apiPromise, timeoutPromise]);
    
    console.log("Received summary response from OpenAI API");
    // @ts-ignore - Type definitions don't match the actual API response structure
    const summaryText = response.choices[0].message.content || "{}";
    
    try {
      console.log("Parsing summary JSON response:", summaryText);
      const summary = JSON.parse(summaryText) as DebateSummary;
      
      // Return comprehensive summary with all components
      return {
        partyArguments: summary.partyArguments || [],
        citizenArguments: summary.citizenArguments || [],
        keyPoints: summary.keyPoints || [],
        stakeholderImpact: summary.stakeholderImpact || {
          party: {
            happy: ["People who support the party's approach", "Groups who would benefit from current policies", "Those who prefer stability and incremental change"],
            sad: ["Those seeking more significant reforms", "Groups facing challenges under current policies", "People desiring more radical changes"]
          },
          citizen: {
            happy: ["People who want policy changes", "Groups who would benefit from proposed alternatives", "Those seeking new approaches"],
            sad: ["Beneficiaries of current systems", "Those who prefer policy continuity", "Groups who value stability over change"]
          }
        },
        policyConsequences: summary.policyConsequences || {
          party: {
            positive: ["Likely maintains economic stability", "Builds on established systems", "Offers predictable outcomes based on track record"],
            negative: ["May not address all emerging challenges", "Could perpetuate existing inequalities", "Might be slower to adapt to rapidly changing needs"]
          },
          citizen: {
            positive: ["Potentially addresses overlooked issues", "Could introduce fresh perspectives", "May benefit groups currently underserved"],
            negative: ["Implementation feasibility might be uncertain", "May have unintended consequences", "Could face practical challenges"]
          }
        },
        conclusion: summary.conclusion || {
          outcome: "party",
          evaluation: {
            logicalSoundness: "Not enough information to assess logical soundness",
            emotionalReasoning: "Not enough information to assess emotional appeals",
            keyPointResolution: "Not enough information to assess resolution of key points",
            toneAndClarity: "Not enough information to assess tone and clarity",
            pragmatism: "Not enough information to assess pragmatism and real-world implementability in Singapore's unique context, which is particularly important for determining policy effectiveness"
          },
          reasoning: "Analysis could not determine a clear winner due to insufficient content to properly evaluate the pragmatic aspects of the proposals, which are especially important in Singapore's context.",
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
        stakeholderImpact: {
          party: {
            happy: ["People who support the party's approach", "Groups benefiting from current systems", "Those who prefer gradual evolution of policies"],
            sad: ["Those seeking more significant reforms", "Groups currently facing challenges", "People who want faster change"]
          },
          citizen: {
            happy: ["Advocates for policy reform", "Groups seeking alternatives", "Those who would benefit from proposed changes"],
            sad: ["Stakeholders who benefit from current systems", "Those who prefer policy continuity", "Groups concerned about disruptive changes"]
          }
        },
        policyConsequences: {
          party: {
            positive: ["Continued stability in implementation", "Building on established systems", "Predictable outcomes"],
            negative: ["Potentially slower to address emerging issues", "May not resolve all concerns", "Could maintain status quo limitations"]
          },
          citizen: {
            positive: ["Fresh perspectives on persistent problems", "Potential solutions for underserved groups", "Innovation in policy approaches"],
            negative: ["May face implementation challenges", "Could have unforeseen consequences", "Might require significant resources"]
          }
        },
        conclusion: {
          outcome: "party",
          evaluation: {
            logicalSoundness: "Could not be evaluated due to technical issues",
            emotionalReasoning: "Could not be evaluated due to technical issues",
            keyPointResolution: "Could not be evaluated due to technical issues",
            toneAndClarity: "Could not be evaluated due to technical issues",
            pragmatism: "Could not be evaluated due to technical issues - pragmatic implementation in Singapore's context is a critical factor"
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
      stakeholderImpact: {
        party: {
          happy: ["This information could not be generated due to technical issues"],
          sad: ["This information could not be generated due to technical issues"]
        },
        citizen: {
          happy: ["This information could not be generated due to technical issues"],
          sad: ["This information could not be generated due to technical issues"]
        }
      },
      policyConsequences: {
        party: {
          positive: ["This information could not be generated due to technical issues"],
          negative: ["This information could not be generated due to technical issues"]
        },
        citizen: {
          positive: ["This information could not be generated due to technical issues"],
          negative: ["This information could not be generated due to technical issues"]
        }
      },
      conclusion: {
        outcome: "party",
        evaluation: {
          logicalSoundness: "Could not be evaluated due to technical issues",
          emotionalReasoning: "Could not be evaluated due to technical issues",
          keyPointResolution: "Could not be evaluated due to technical issues",
          toneAndClarity: "Could not be evaluated due to technical issues",
          pragmatism: "Could not be evaluated due to technical issues - pragmatic implementation in Singapore's context is a critical factor"
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
    
    IMPORTANT: Use your web search capabilities to verify facts related to ${partyName}'s position on "${topic}" and to ensure the arguments accurately reflect both the party's stance and citizen concerns on this issue. Look for recent statistics, policy positions, and public statements from 2024-2025.
    
    Format your response as a JSON object with these two arrays. Focus on the following:
    - Include concrete examples that were mentioned (e.g. policy impact on young families)
    - Highlight the strongest and most recurring points
    - Keep each point concise (under 100 characters) but specific
    - Avoid vague generalizations; focus on concrete policy positions
    `;
    
    // Determine if the topic likely needs search
    const model = requiresSearch(topic) ? MODELS.SEARCH : MODELS.STANDARD;
    
    // Create the configuration based on the selected model
    const config: any = {
      model: model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500, // Increased to handle larger responses
    };
    
    // Add model-specific parameters
    if (model === MODELS.SEARCH) {
      config.web_search_options = {}; // Enable web search for the search model
    } else {
      // For standard model, add response format and temperature
      config.response_format = { type: "json_object" };
      config.temperature = 0.5;
    }
    
    // @ts-ignore - The type definitions haven't been updated for retrieval yet
    const response = await openai.chat.completions.create(config);
    
    // @ts-ignore - Type definitions don't match the actual API response structure
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