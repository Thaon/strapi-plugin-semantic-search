"use strict";

const EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const REQUEST_TIMEOUT_MS = 10000;
const MAX_BATCH_SIZE = 64;

module.exports = ({ strapi }) => {
  /**
   * @param {string[]} input
   */
  async function callEmbeddingsApi(input) {
    const config = strapi.config.get("plugin::semantic-search");

    const response = await fetch(EMBEDDINGS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": config.siteUrl,
        "X-Title": config.siteName,
      },
      body: JSON.stringify({
        model: config.model,
        input,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `OpenRouter embeddings error: ${response.status} - ${text.slice(0, 300)}`,
      );
    }

    const data = JSON.parse(text);
    return (data.data || [])
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((d) => d.embedding);
  }

  /**
   * @param {string[]} texts
   */
  async function generateBatch(texts) {
    const cleaned = texts.map((t) => (t || "").replace(/\n/g, " "));
    const vectors = [];

    for (let i = 0; i < cleaned.length; i += MAX_BATCH_SIZE) {
      const batch = cleaned.slice(i, i + MAX_BATCH_SIZE);
      try {
        vectors.push(...(await callEmbeddingsApi(batch)));
      } catch (err) {
        if (batch.length === 1) throw err;
        // Some providers reject batched input — fall back to per-item calls.
        strapi.log.warn(
          `[Semantic Search] Batch embedding failed (${err instanceof Error ? err.message : String(err)}); falling back to per-chunk calls`,
        );
        for (const single of batch) {
          vectors.push(...(await callEmbeddingsApi([single])));
        }
      }
    }

    return vectors;
  }

  return {
    /**
     * @param {string} text
     */
    async generate(text) {
      const [vector] = await generateBatch([text]);
      return vector;
    },

    generateBatch,
  };
};
