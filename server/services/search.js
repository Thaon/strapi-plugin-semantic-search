"use strict";

module.exports = ({ strapi }) => ({
  async querySearch(userQuery, options = {}) {
    const { ownerId } = options;

    if (!ownerId) {
      throw new Error("ownerId is required for semantic search");
    }

    const config = strapi.config.get("plugin::semantic-search");
    const { embedding, vector: vectorMath } =
      strapi.plugin("semantic-search").services;

    const limit = options.limit || 5;
    const similarityThreshold =
      options.threshold || config.similarityThreshold || 0.5;
    const contentType = options.contentType || null;

    console.log(
      `[Semantic Search] Query: "${userQuery}" | Owner: ${ownerId} | Threshold: ${similarityThreshold}`
    );

    // 1. Convert the search string into a vector
    const queryVector = await embedding.generate(userQuery);

    // 2. Retrieve stored chunks, filtered by owner and optionally by content type
    const whereClause = { owner: ownerId };
    if (contentType) {
      whereClause.parentType = contentType;
    }

    const storedChunks = await strapi.db
      .query("plugin::semantic-search.chunk")
      .findMany({ where: whereClause });

    console.log(
      `[Semantic Search] Found ${storedChunks.length} chunks for owner ${ownerId}`
    );

    // 3. Perform Cosine Similarity calculation and rank results
    const scoredResults = storedChunks.map((chunk) => ({
      id: chunk.parentDocId,
      title: chunk.titleReference,
      textSnippet: chunk.content,
      contentType: chunk.parentType,
      score: vectorMath.cosineSimilarity(queryVector, chunk.embedding),
    }));

    // Log top scores for debugging
    const topScores = scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((r) => `${r.title}: ${(r.score * 100).toFixed(1)}%`);
    console.log(`[Semantic Search] Top scores: ${topScores.join(", ")}`);

    const filteredResults = scoredResults
      .filter((res) => res.score > similarityThreshold)
      .sort((a, b) => b.score - a.score);

    console.log(
      `[Semantic Search] Results after threshold filter: ${filteredResults.length}`
    );

    // 4. Deduplicate by document ID - keep best scoring chunk per document
    const docBestChunks = new Map();
    for (const result of filteredResults) {
      if (
        !docBestChunks.has(result.id) ||
        docBestChunks.get(result.id).score < result.score
      ) {
        docBestChunks.set(result.id, result);
      }
    }

    // Sort by score and apply limit AFTER deduplication
    const uniqueDocIds = [...docBestChunks.keys()]
      .sort((a, b) => docBestChunks.get(b).score - docBestChunks.get(a).score)
      .slice(0, limit);

    const resultsWithFullContent = [];

    for (const docId of uniqueDocIds) {
      // Get the best scoring chunk for this document
      const bestChunk = docBestChunks.get(docId);

      // Fetch the full document content
      try {
        const doc = await strapi.db.query("api::doc.doc").findOne({
          where: { documentId: docId },
        });

        if (doc) {
          resultsWithFullContent.push({
            documentId: docId,
            title: bestChunk.title || doc.title,
            textSnippet: bestChunk.textSnippet,
            fullContent: doc.content,
            contentType: bestChunk.contentType,
            score: bestChunk.score,
          });
        } else {
          // Document not found or no content, use chunk content
          console.log(
            `[Semantic Search] Using chunk content as fallback for doc ${docId}`
          );
          resultsWithFullContent.push({
            documentId: docId,
            title: bestChunk.title,
            textSnippet: bestChunk.textSnippet,
            fullContent: bestChunk.textSnippet,
            contentType: bestChunk.contentType,
            score: bestChunk.score,
          });
        }
      } catch (error) {
        console.error(
          `[Semantic Search] Error fetching doc ${docId}:`,
          error.message
        );
        resultsWithFullContent.push({
          documentId: docId,
          title: bestChunk.title,
          textSnippet: bestChunk.textSnippet,
          fullContent: bestChunk.textSnippet,
          contentType: bestChunk.contentType,
          score: bestChunk.score,
        });
      }
    }

    console.log(
      `[Semantic Search] Unique documents returned: ${resultsWithFullContent.length}`
    );

    return resultsWithFullContent;
  },
});
