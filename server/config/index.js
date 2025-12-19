"use strict";

module.exports = {
  default: ({ env }) => ({
    apiKey: env("OPENROUTER_API_KEY", ""),
    model: env("OPENROUTER_MODEL", "openai/text-embedding-3-small"),
    siteUrl: env("SITE_URL", "http://localhost:1337"),
    siteName: env("SITE_NAME", "StrapiSemanticSearch"),
    contentTypes: [],
    chunkSize: 500,
    chunkOverlap: 50,
    similarityThreshold: 0.7,
  }),
  validator: (config) => {
    if (!config.apiKey) {
      throw new Error("Semantic Search: OPENROUTER_API_KEY is required");
    }
  },
};
