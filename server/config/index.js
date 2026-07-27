"use strict";

module.exports = {
  default: ({ env }) => ({
    apiKey: env("OPENROUTER_API_KEY", ""),
    model: env("OPENROUTER_MODEL", "openai/text-embedding-3-small"),
    siteUrl: env("SITE_URL", "http://localhost:1337"),
    siteName: env("SITE_NAME", "StrapiSemanticSearch"),
    contentTypes: [],
    chunkSize: 2000,
    chunkOverlap: 200,
    similarityThreshold: 0.7,
    docContentType: "api::doc.doc",
    docContentField: "content",
  }),
  validator: (config) => {
    if (!config.apiKey) {
      throw new Error("Semantic Search: OPENROUTER_API_KEY is required");
    }
  },
};
