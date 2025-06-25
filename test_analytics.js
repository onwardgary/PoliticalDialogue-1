// Test analytics processing directly
const natural = require('natural');

// Sample debate content based on actual database queries
const sampleTexts = [
  "What are your plans to improve public transportation?",
  "How would you address the increasing cost of living?", 
  "What policies do you have for affordable housing?",
  "How will you tackle healthcare costs and accessibility?",
  "What measures will you take to improve education quality?",
  "How do you plan to create more jobs for Singaporeans?",
  "What environmental policies will you implement?",
  "How will you support small businesses and startups?",
  "What tax reforms are you considering?",
  "How will you improve infrastructure development?"
];

// Stop words
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'and', 'a', 'to', 'are', 'as', 'was', 'will', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall', 'will', 'this', 'that',
  'with', 'for', 'from', 'by', 'of', 'in', 'not', 'but', 'or', 'if', 'then', 'than', 'more', 'also', 'very',
  'singapore', 'singaporean', 'singaporeans', 'government', 'policy', 'policies', 'pap', 'party', 'citizen',
  'you', 'your', 'our', 'we', 'they', 'their', 'them', 'there', 'here', 'what', 'how', 'when', 'where', 'why'
]);

// Process texts
const allTokens = [];
for (const text of sampleTexts) {
  const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = natural.WordTokenizer.prototype.tokenize(cleanText) || [];
  
  for (const token of tokens) {
    const cleanToken = token.toLowerCase().trim();
    if (cleanToken.length > 2 && !STOP_WORDS.has(cleanToken) && /^[a-zA-Z]+$/.test(cleanToken)) {
      allTokens.push(cleanToken);
    }
  }
}

// Count frequencies
const frequencies = {};
for (const token of allTokens) {
  frequencies[token] = (frequencies[token] || 0) + 1;
}

// Show results
console.log('Total tokens:', allTokens.length);
console.log('Unique words:', Object.keys(frequencies).length);
console.log('Top topics:');
Object.entries(frequencies)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 20)
  .forEach(([word, count]) => console.log(`  ${word}: ${count}`));