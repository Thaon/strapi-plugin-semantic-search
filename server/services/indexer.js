"use strict";

module.exports = ({ strapi }) => {
  const chunkTable = () => strapi.db.query("plugin::semantic-search.chunk");
  const cache = () => strapi.plugin("semantic-search").services.chunkCache;

  // Core indexing path: chunk once, embed once (batched), store per owner.
  /**
   * @param {{ text: string, parentDocId: string, parentType: string, title?: string, ownerIds: number[] }} args
   */
  async function indexOwnedContent({
    text,
    parentDocId,
    parentType,
    title,
    ownerIds,
  }) {
    if (!ownerIds?.length) {
      throw new Error("ownerIds is required for indexing");
    }
    if (!text || !text.trim().length) {
      throw new Error(`No content to index for ${parentDocId}`);
    }

    const started = Date.now();
    const { chunking, embedding } = strapi.plugin("semantic-search").services;

    const textChunks = chunking.splitText(text);
    const vectors = await embedding.generateBatch(textChunks);

    if (vectors.length !== textChunks.length) {
      throw new Error(
        `Embedding API returned ${vectors.length} vector(s) for ${textChunks.length} chunk(s)`,
      );
    }

    for (const ownerId of ownerIds) {
      await chunkTable().deleteMany({
        where: { parentDocId, parentType, owner: ownerId },
      });

      for (let i = 0; i < textChunks.length; i++) {
        await chunkTable().create({
          data: {
            content: textChunks[i],
            embedding: vectors[i],
            parentDocId,
            parentType,
            titleReference: title || "Untitled",
            owner: ownerId,
          },
        });
      }

      cache().invalidate(ownerId);
    }

    strapi.log.info(
      `Semantic Search: Indexed ${textChunks.length} chunk(s) for ${parentType}:${parentDocId} across ${ownerIds.length} owner(s) in ${Date.now() - started} ms`,
    );

    return {
      success: true,
      documentId: parentDocId,
      contentType: parentType,
      owners: ownerIds.length,
      chunksCreated: textChunks.length * ownerIds.length,
    };
  }

  return {
    /**
     * Index a specific document by content type, documentId, and field
     * @param {string} contentType - The content type UID (e.g., 'api::article.article')
     * @param {string} documentId - The document ID to index
     * @param {string} field - The field to generate embeddings for (e.g., 'content')
     * @param {string} titleField - Optional field to use as title reference (default: 'title')
     * @param {number} ownerId - The owner's user ID (required for ownership filtering)
     */
    async indexDocument(
      contentType,
      documentId,
      field,
      titleField = "title",
      ownerId,
    ) {
      if (!ownerId) {
        throw new Error("ownerId is required for indexing documents");
      }

      try {
        const document = await strapi.documents(contentType).findOne({
          documentId,
        });

        if (!document) {
          throw new Error(`Document ${documentId} not found in ${contentType}`);
        }

        const textContent = document[field];
        if (!textContent) {
          throw new Error(
            `Field "${field}" is empty or does not exist on document ${documentId}`,
          );
        }

        return await indexOwnedContent({
          text: textContent,
          parentDocId: documentId,
          parentType: contentType,
          title: document[titleField],
          ownerIds: [ownerId],
        });
      } catch (error) {
        strapi.log.error(
          `Semantic Search: Indexing failed for ${contentType}:${documentId}: ${error instanceof Error ? error.message : error}`,
        );
        throw error;
      }
    },

    /**
     * Remove all indexed chunks for a specific document
     * @param {string} documentId - The document ID to remove from index
     */
    async removeDocument(documentId) {
      const rows = await chunkTable().findMany({
        where: { parentDocId: documentId },
      });

      const deleted = await chunkTable().deleteMany({
        where: { parentDocId: documentId },
      });

      for (const ownerId of new Set(rows.map((r) => r.owner))) {
        cache().invalidate(ownerId);
      }

      strapi.log.info(
        `Semantic Search: Removed chunks for document ${documentId}`,
      );
      return { success: true, documentId, chunksRemoved: deleted.count || 0 };
    },

    /**
     * Remove all indexed chunks for a specific document and owner
     * @param {string} documentId - The document ID to remove from index
     * @param {number} ownerId - The owner whose chunks should be removed
     */
    async removeDocumentForOwner(documentId, ownerId) {
      const deleted = await chunkTable().deleteMany({
        where: { parentDocId: documentId, owner: ownerId },
      });

      cache().invalidate(ownerId);

      strapi.log.info(
        `Semantic Search: Removed chunks for document ${documentId} (owner ${ownerId})`,
      );
      return {
        success: true,
        documentId,
        ownerId,
        chunksRemoved: deleted.count || 0,
      };
    },

    /**
     * Index multiple fields from a document
     * @param {string} contentType - The content type UID
     * @param {string} documentId - The document ID
     * @param {string[]} fields - Array of fields to index
     * @param {string} titleField - Optional field to use as title reference
     * @param {number} ownerId - The owner's user ID (required for ownership filtering)
     */
    async indexDocumentFields(
      contentType,
      documentId,
      fields,
      titleField = "title",
      ownerId,
    ) {
      if (!ownerId) {
        throw new Error("ownerId is required for indexing documents");
      }

      try {
        const document = await strapi.documents(contentType).findOne({
          documentId,
        });

        if (!document) {
          throw new Error(`Document ${documentId} not found in ${contentType}`);
        }

        const combinedText = fields
          .map((field) => document[field] || "")
          .filter((text) => text.length > 0)
          .join(" ");

        if (!combinedText) {
          throw new Error(
            `No content found in fields [${fields.join(", ")}] for document ${documentId}`,
          );
        }

        return await indexOwnedContent({
          text: combinedText,
          parentDocId: documentId,
          parentType: contentType,
          title: document[titleField],
          ownerIds: [ownerId],
        });
      } catch (error) {
        strapi.log.error(
          `Semantic Search: Indexing failed: ${error instanceof Error ? error.message : error}`,
        );
        throw error;
      }
    },

    indexOwnedContent,
  };
};
