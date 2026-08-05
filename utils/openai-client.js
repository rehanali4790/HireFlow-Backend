const OpenAI = require('openai');

let client = null;

function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY is not configured. Set it in environment variables to enable AI features.');
    error.statusCode = 503;
    throw error;
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

module.exports = {
  getOpenAI,
  isOpenAiConfigured,
};
