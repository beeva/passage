// A standard English stopword list - function words with no topical
// meaning of their own (articles, prepositions, common auxiliary verbs,
// pronouns). IDF alone doesn't reliably suppress these: it downweights a
// term by how common it is IN THIS CORPUS, and a small or young
// workspace (a handful of documents, which is the normal starting state
// for a brand new one) can have "is" or "the" appear in only one or two
// documents by pure chance, giving a function word real IDF weight and
// letting an unrelated question match on it alone. Found by testing
// selectAnswer against a genuinely off-topic question that still matched
// a passage - it shared nothing content-bearing, only "is".
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "so", "as", "of", "at", "by", "for", "with", "about",
  "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up",
  "down", "in", "out", "on", "off", "over", "under", "again", "further", "once", "here", "there", "when", "where",
  "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now", "is",
  "am", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing",
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves",
  "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their",
  "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those",
]);

/**
 * Lowercase word tokenizer with stopword removal - deliberately no
 * stemming. Stemming would make the citation story worse, not better: a
 * passage should be findable by the words actually in it, not a
 * normalized form a reader never sees. Stopword removal is a different
 * concern (see STOPWORDS above) - it's about which words should never
 * carry retrieval weight at all, regardless of corpus size.
 */
export function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.filter((word) => !STOPWORDS.has(word));
}
