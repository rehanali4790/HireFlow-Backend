function cleanTranscription(text) {
  if (!text) return '';
  return String(text)
    .replace(/\s+/g, ' ')
    .replace(/(.{1,40})\1{3,}/gu, '$1')
    .trim();
}

function isLikelyHallucination(text) {
  const trimmed = cleanTranscription(text);
  if (!trimmed) return true;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  if (words.length >= 6) {
    const uniqueWords = new Set(words);
    if (uniqueWords.size / words.length < 0.25) {
      return true;
    }
  }

  let consecutiveRepeats = 1;
  let maxConsecutive = 1;
  for (let i = 1; i < words.length; i += 1) {
    if (words[i] === words[i - 1]) {
      consecutiveRepeats += 1;
      maxConsecutive = Math.max(maxConsecutive, consecutiveRepeats);
    } else {
      consecutiveRepeats = 1;
    }
  }
  if (maxConsecutive >= 4) return true;

  const counts = new Map();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  const topCount = Math.max(...counts.values());
  if (words.length >= 10 && topCount / words.length > 0.45) {
    return true;
  }

  const compact = trimmed.replace(/\s+/g, '');
  if (compact.length >= 40) {
    const chunkSize = Math.min(12, Math.max(4, Math.floor(compact.length / 8)));
    const firstChunk = compact.slice(0, chunkSize);
    const repeatMatches = compact.match(new RegExp(firstChunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
    if (repeatMatches && repeatMatches.length >= 6) {
      return true;
    }
  }

  return false;
}

function buildWhisperPrompt(languagePreference) {
  switch (languagePreference) {
    case 'urdu':
      return 'یہ ایک ٹیکنیکل انٹرویو ہے۔ امیدوار اردو میں جواب دے رہا ہے۔';
    case 'english':
      return 'This is a technical job interview. The candidate is answering in English.';
    case 'both':
    default:
      return 'Technical job interview. Candidate may answer in English or Urdu.';
  }
}

function mapLanguagePreference(languagePreference) {
  switch (languagePreference) {
    case 'urdu':
      return 'ur';
    case 'english':
      return 'en';
    default:
      return undefined;
  }
}

function getAverageNoSpeechProb(segments = []) {
  if (!segments.length) return 0;
  const total = segments.reduce((sum, segment) => sum + (segment.no_speech_prob || 0), 0);
  return total / segments.length;
}

module.exports = {
  cleanTranscription,
  isLikelyHallucination,
  buildWhisperPrompt,
  mapLanguagePreference,
  getAverageNoSpeechProb,
};
