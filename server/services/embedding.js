"use strict";

module.exports = ({ strapi }) => ({
  async generate(text) {
    const config = strapi.config.get("plugin::semantic-search");

    // Use dynamic import for ESM module
    const { OpenRouter } = await import("@openrouter/sdk");

    // Initialize the official SDK as per OpenRouter Quickstart
    const openRouter = new OpenRouter({
      apiKey: config.apiKey,
      defaultHeaders: {
        "HTTP-Referer": config.siteUrl,
        "X-Title": config.siteName,
      },
    });

    try {
      // Generate the embedding vector for the input text
      const response = await openRouter.embeddings.generate({
        model: config.model,
        input: text.replace(/\n/g, " "),
      });

      return response.data[0].embedding;
    } catch (error) {
      strapi.log.error(`OpenRouter SDK Error: ${error.message}`);
      throw error;
    }
  },
});
