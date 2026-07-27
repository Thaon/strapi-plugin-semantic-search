"use strict";

module.exports = ({ strapi }) => ({
  async generate(text) {
    const config = strapi.config.get("plugin::semantic-search");

    const { OpenRouter } = await import("@openrouter/sdk");

    const openRouter = new OpenRouter({
      apiKey: config.apiKey,
      httpReferer: config.siteUrl,
      appTitle: config.siteName,
    });

    try {
      const response = await openRouter.embeddings.generate({
        requestBody: {
          model: config.model,
          input: text.replace(/\n/g, " "),
        },
      });

      return response.data[0].embedding;
    } catch (error) {
      strapi.log.error(`OpenRouter SDK Error: ${error.message}`);
      throw error;
    }
  },
});
