const natural = require("natural");

// ─── Levenshtein Distance (Title Similarity) ─────────────────────────────────
// Measures character-level edit distance between two strings
// Returns a normalised score between 0 (completely different) and 1 (identical)
const getTitleSimilarity = (title1, title2) => {
  if (!title1 || !title2) return 0;

  const t1 = title1.toLowerCase().trim();
  const t2 = title2.toLowerCase().trim();

  const distance = natural.LevenshteinDistance(t1, t2);
  const maxLength = Math.max(t1.length, t2.length);

  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
};

// ─── Jaccard Similarity (Description Similarity) ─────────────────────────────
// Measures token-set overlap between two descriptions
// Returns a score between 0 (no overlap) and 1 (identical token sets)
const getDescriptionSimilarity = (desc1, desc2) => {
  if (!desc1 || !desc2) return 0;

  // Stopwords to ignore — common words that add no matching value
  const stopwords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "is",
    "it",
    "was",
    "are",
    "were",
    "be",
    "been",
    "have",
    "has",
    "had",
    "this",
    "that",
    "my",
    "i",
    "me",
    "we",
    "you",
    "he",
    "she",
    "they",
    "its",
  ]);

  const tokenize = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "") // remove punctuation
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopwords.has(word));
  };

  const tokens1 = new Set(tokenize(desc1));
  const tokens2 = new Set(tokenize(desc2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  // Intersection: words that appear in both
  const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));

  // Union: all unique words across both
  const union = new Set([...tokens1, ...tokens2]);

  // Jaccard = |intersection| / |union|
  return intersection.size / union.size;
};

// ─── Category Match (Binary) ─────────────────────────────────────────────────
// Returns 1.0 if both items share the same category, 0.0 otherwise
const getCategoryMatch = (cat1, cat2) => {
  if (!cat1 || !cat2) return 0;
  return cat1.toLowerCase() === cat2.toLowerCase() ? 1.0 : 0.0;
};

// ─── Composite Scoring ───────────────────────────────────────────────────────
// Combines all similarity measures into a single weighted score
// Score = 0.25 × TitleSim + 0.35 × DescSim + 0.30 × ImageSim + 0.10 × CategoryMatch
// ImageSim defaults to 0 until pHash is implemented in semester 2
const computeMatchScore = (itemA, itemB) => {
  const titleSim = getTitleSimilarity(itemA.title, itemB.title);
  const descSim = getDescriptionSimilarity(
    itemA.description,
    itemB.description,
  );
  const categoryMatch = getCategoryMatch(itemA.category, itemB.category);

  // Image similarity placeholder — will be replaced with pHash comparison
  const imageSim = 0;

  const score =
    0.25 * titleSim + 0.35 * descSim + 0.3 * imageSim + 0.1 * categoryMatch;

  return {
    score: Math.round(score * 100) / 100, // round to 2 decimal places
    breakdown: {
      titleSim: Math.round(titleSim * 100) / 100,
      descSim: Math.round(descSim * 100) / 100,
      imageSim,
      categoryMatch,
    },
  };
};

module.exports = { computeMatchScore };
