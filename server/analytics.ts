import { storage } from "./storage";
import natural from "natural";

// Ministry portfolio mapping for topic classification
const MINISTRY_PORTFOLIOS = {
  'Ministry of National Development': [
    'housing', 'hdb', 'bto', 'property', 'urban', 'planning', 'development', 'build', 'flat', 'resale'
  ],
  'Ministry of Health': [
    'health', 'healthcare', 'hospital', 'medical', 'covid', 'mental', 'doctor', 'clinic', 'medicine', 'polyclinic'
  ],
  'Ministry of Education': [
    'education', 'school', 'university', 'student', 'tuition', 'skillsfuture', 'learning', 'exam', 'teacher', 'primary', 'secondary'
  ],
  'Ministry of Transport': [
    'transport', 'mrt', 'bus', 'taxi', 'grab', 'coe', 'erp', 'traffic', 'lta', 'road', 'driving'
  ],
  'Ministry of Manpower': [
    'job', 'jobs', 'work', 'employment', 'cpf', 'worker', 'foreign', 'salary', 'wage', 'career', 'skills'
  ],
  'Ministry of Finance': [
    'finance', 'tax', 'gst', 'budget', 'economy', 'economic', 'money', 'cost', 'price', 'inflation'
  ],
  'Ministry of Trade and Industry': [
    'trade', 'industry', 'business', 'company', 'startup', 'sme', 'export', 'import', 'commerce'
  ]
};

// Common stop words to filter out
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'will', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'will', 'this', 'that',
  'with', 'for', 'from', 'by', 'of', 'in', 'not', 'but', 'or', 'if', 'then', 'than', 'more', 'also', 'very',
  'singapore', 'singaporean', 'singaporeans', 'government', 'policy', 'policies', 'pap', 'party', 'citizen',
  'you', 'your', 'our', 'we', 'they', 'their', 'them', 'there', 'here', 'what', 'how', 'when', 'where', 'why'
]);

export interface TopicData {
  text: string;
  value: number;
  ministry?: string;
}

export interface MinistryBusyness {
  ministry: string;
  topicCount: number;
  topics: string[];
}

export class DebateAnalytics {
  
  // Extract and clean text from debate messages
  private extractTextFromDebates(debates: any[]): string[] {
    const allTexts: string[] = [];
    
    for (const debate of debates) {
      if (debate.messages && Array.isArray(debate.messages)) {
        for (const message of debate.messages) {
          // Focus on user messages as they contain citizen concerns and topics
          if (message.role === 'user' && message.content) {
            // Clean and normalize text, removing system prompts and formatting
            let cleanText = message.content
              .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold formatting
              .replace(/\n+/g, ' ') // Replace newlines with spaces
              .replace(/[^\w\s]/g, ' ') // Remove punctuation
              .replace(/\s+/g, ' ') // Normalize whitespace
              .toLowerCase()
              .trim();
            
            // Filter out very short messages and system prompts
            if (cleanText.length > 15 && 
                !cleanText.startsWith('hello i m the') &&
                !cleanText.includes('fanbot') &&
                !cleanText.includes('unofficial')) {
              allTexts.push(cleanText);
            }
          }
        }
      }
    }
    
    console.log(`Extracted ${allTexts.length} text segments from ${debates.length} debates`);
    return allTexts;
  }

  // Tokenize and clean text for analysis
  private tokenizeText(texts: string[]): string[] {
    const allTokens: string[] = [];
    
    for (const text of texts) {
      try {
        // Use natural.js for tokenization
        const tokens = natural.WordTokenizer.prototype.tokenize(text) || [];
        
        for (const token of tokens) {
          const cleanToken = token.toLowerCase().trim();
          
          // Filter out stop words, short words, and non-alphabetic tokens
          if (cleanToken.length > 2 && // Lowered threshold from 3 to 2
              !STOP_WORDS.has(cleanToken) && 
              /^[a-zA-Z]+$/.test(cleanToken)) {
            allTokens.push(cleanToken);
          }
        }
      } catch (error) {
        console.warn('Error tokenizing text:', error);
      }
    }
    
    console.log(`Generated ${allTokens.length} tokens from ${texts.length} text segments`);
    return allTokens;
  }

  // Count word frequencies
  private calculateWordFrequencies(tokens: string[]): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
    
    return frequencies;
  }

  // Classify topics by ministry
  private classifyTopicsByMinistry(topicData: TopicData[]): MinistryBusyness[] {
    const ministryStats = new Map<string, { count: number; topics: Set<string> }>();
    
    // Initialize all ministries
    for (const ministry of Object.keys(MINISTRY_PORTFOLIOS)) {
      ministryStats.set(ministry, { count: 0, topics: new Set() });
    }
    
    // Classify each topic
    for (const topic of topicData) {
      let classified = false;
      
      for (const [ministry, keywords] of Object.entries(MINISTRY_PORTFOLIOS)) {
        if (keywords.includes(topic.text.toLowerCase())) {
          const stats = ministryStats.get(ministry)!;
          stats.count += topic.value;
          stats.topics.add(topic.text);
          classified = true;
          break;
        }
      }
      
      // If not classified, check for partial matches
      if (!classified) {
        for (const [ministry, keywords] of Object.entries(MINISTRY_PORTFOLIOS)) {
          for (const keyword of keywords) {
            if (topic.text.toLowerCase().includes(keyword) || keyword.includes(topic.text.toLowerCase())) {
              const stats = ministryStats.get(ministry)!;
              stats.count += topic.value;
              stats.topics.add(topic.text);
              classified = true;
              break;
            }
          }
          if (classified) break;
        }
      }
    }
    
    // Convert to array and sort by busyness
    const result: MinistryBusyness[] = [];
    for (const [ministry, stats] of ministryStats.entries()) {
      if (stats.count > 0) {
        result.push({
          ministry,
          topicCount: stats.count,
          topics: Array.from(stats.topics)
        });
      }
    }
    
    return result.sort((a, b) => b.topicCount - a.topicCount);
  }

  // Main method to generate insights
  async generateInsights(): Promise<{
    wordCloudData: TopicData[];
    ministryBusyness: MinistryBusyness[];
    totalDebates: number;
    totalTopics: number;
  }> {
    try {
      // Get all completed debates
      const debates = await storage.getAllDebates();
      const completedDebates = debates.filter(d => d.completed);
      
      console.log(`Processing ${completedDebates.length} completed debates`);
      
      // Extract text from debates
      const debateTexts = this.extractTextFromDebates(completedDebates);
      
      if (debateTexts.length === 0) {
        console.warn('No text content found in debates');
        return {
          wordCloudData: [],
          ministryBusyness: [],
          totalDebates: completedDebates.length,
          totalTopics: 0
        };
      }
      
      // Tokenize and clean
      const tokens = this.tokenizeText(debateTexts);
      
      if (tokens.length === 0) {
        console.warn('No valid tokens generated from text');
        return {
          wordCloudData: [],
          ministryBusyness: [],
          totalDebates: completedDebates.length,
          totalTopics: 0
        };
      }
      
      // Calculate frequencies
      const frequencies = this.calculateWordFrequencies(tokens);
      
      // Convert to word cloud data (top 100 words with minimum frequency of 2)
      const wordCloudData: TopicData[] = Array.from(frequencies.entries())
        .filter(([, count]) => count >= 2) // Only include words mentioned at least twice
        .sort(([,a], [,b]) => b - a)
        .slice(0, 100)
        .map(([text, value]) => ({ text, value }));
      
      console.log(`Generated ${wordCloudData.length} topics from ${frequencies.size} unique words`);
      
      // Calculate ministry busyness
      const ministryBusyness = this.classifyTopicsByMinistry(wordCloudData);
      
      return {
        wordCloudData,
        ministryBusyness,
        totalDebates: completedDebates.length,
        totalTopics: wordCloudData.length
      };
      
    } catch (error) {
      console.error('Error generating insights:', error);
      throw error;
    }
  }
}

export const debateAnalytics = new DebateAnalytics();