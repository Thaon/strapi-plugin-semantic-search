"use strict";

/**
 * @param {number[]} vector
 */
function normalizeQueryVector(vector) {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / norm;
  return out;
}

module.exports = ({ strapi }) => ({
  async querySearch(userQuery, options = {}) {
    const { ownerId } = options;

    if (!ownerId) {
      throw new Error("ownerId is required for semantic search");
    }

    const totalStart = Date.now();
    const config = strapi.config.get("plugin::semantic-search");
    const { embedding, chunkCache } = strapi.plugin("semantic-search").services;

    const limit = options.limit || 5;
    const similarityThreshold =
      options.threshold || config.similarityThreshold || 0.5;
    const contentType = options.contentType || null;

    // Configurable content type for fetching full document content
    const docContentType = config.docContentType || "api::doc.doc";
    const docContentField = config.docContentField || "content";

    console.log(
      `[Semantic Search] Query: "${userQuery}" | Owner: ${ownerId} | Threshold: ${similarityThreshold}`,
    );

    // 1 + 2. Embed the query and load the owner's chunks (cached) in parallel
    const embedStart = Date.now();
    const [rawQueryVector, store] = await Promise.all([
      embedding.generate(userQuery),
      chunkCache.getForOwner(ownerId),
    ]);
    console.log(
      `[Semantic Search] Embedding + cache: ${Date.now() - embedStart} ms (${store.count} chunks for owner ${ownerId}${contentType ? `, filter: ${contentType}` : ""})`,
    );

    const { matrix, metas, dims } = store;

    // 3. Score = cosine similarity via dot product on pre-normalized vectors
    const scoreStart = Date.now();
    /** @type {{ id: string, title: string, textSnippet: string, contentType: string, score: number }[]} */
    const scoredResults = [];

    if (dims && rawQueryVector?.length === dims) {
      const queryVector = normalizeQueryVector(rawQueryVector);

      for (let i = 0; i < metas.length; i++) {
        if (contentType && metas[i].parentType !== contentType) continue;

        const offset = i * dims;
        let dot = 0;
        for (let d = 0; d < dims; d++) {
          dot += queryVector[d] * matrix[offset + d];
        }

        scoredResults.push({
          id: metas[i].parentDocId,
          title: metas[i].title,
          textSnippet: metas[i].content,
          contentType: metas[i].parentType,
          score: dot,
        });
      }
    } else if (dims) {
      console.warn(
        `[Semantic Search] Query vector dims (${rawQueryVector?.length}) != chunk dims (${dims}) — returning no results. Re-index the corpus to realign embeddings.`,
      );
    }

    // Single sort, then threshold filter (order preserved)
    scoredResults.sort((a, b) => b.score - a.score);
    const topScores = scoredResults
      .slice(0, 10)
      .map((r) => `${r.title}: ${(r.score * 100).toFixed(1)}%`);
    const filteredResults = scoredResults.filter(
      (res) => res.score > similarityThreshold,
    );

    console.log(
      `[Semantic Search] Scoring: ${Date.now() - scoreStart} ms | Top scores: ${topScores.join(", ") || "-"} | After threshold filter: ${filteredResults.length}`,
    );

    // 4. Deduplicate by document ID — sorted order means the first hit per
    // document is its best-scoring chunk
    const docBestChunks = new Map();
    for (const result of filteredResults) {
      if (!docBestChunks.has(result.id)) {
        docBestChunks.set(result.id, result);
      }
    }

    const uniqueDocIds = [...docBestChunks.keys()].slice(0, limit);

    // 5. Hydrate full document content in a single query
    const hydrateStart = Date.now();
    let docsById = new Map();
    if (uniqueDocIds.length) {
      try {
        const docs = await strapi.db.query(docContentType).findMany({
          where: { documentId: { $in: uniqueDocIds } },
        });
        docsById = new Map(docs.map((d) => [d.documentId, d]));
      } catch (error) {
        console.error(
          `[Semantic Search] Error fetching docs:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    const resultsWithFullContent = uniqueDocIds.map((docId) => {
      const bestChunk = docBestChunks.get(docId);
      const doc = docsById.get(docId);
      return {
        documentId: docId,
        title: bestChunk.title || doc?.title,
        textSnippet: bestChunk.textSnippet,
        fullContent: doc ? doc[docContentField] : bestChunk.textSnippet,
        contentType: bestChunk.contentType,
        score: bestChunk.score,
      };
    });

    console.log(
      `[Semantic Search] Hydration: ${Date.now() - hydrateStart} ms | Total: ${Date.now() - totalStart} ms | Unique documents returned: ${resultsWithFullContent.length}`,
    );

    return resultsWithFullContent;
  },
});
