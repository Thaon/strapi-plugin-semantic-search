"use strict";

module.exports = ({ strapi }) => ({
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
    ownerId
  ) {
    if (!ownerId) {
      throw new Error("ownerId is required for indexing documents");
    }

    const { chunking, embedding } = strapi.plugin("semantic-search").services;

    try {
      // 1. Fetch the document
      const document = await strapi.documents(contentType).findOne({
        documentId,
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found in ${contentType}`);
      }

      const textContent = document[field];
      if (!textContent) {
        throw new Error(
          `Field "${field}" is empty or does not exist on document ${documentId}`
        );
      }

      // 2. Clear old chunks for this document and content type
      await strapi.db.query("plugin::semantic-search.chunk").deleteMany({
        where: { parentDocId: documentId, parentType: contentType },
      });

      // 3. Split content into smaller pieces (Chunking)
      const textChunks = chunking.splitText(textContent);

      // 4. Generate embeddings for each chunk and save
      const createdChunks = [];

      for (const text of textChunks) {
        const vector = await embedding.generate(text);
        const chunk = await strapi.db
          .query("plugin::semantic-search.chunk")
          .create({
            data: {
              content: text,
              embedding: vector,
              parentDocId: documentId,
              parentType: contentType,
              titleReference: document[titleField] || "Untitled",
              owner: ownerId,
            },
          });
        createdChunks.push(chunk);
      }

      strapi.log.info(
        `Semantic Search: Indexed ${textChunks.length} chunks for ${contentType}:${documentId}`
      );

      return {
        success: true,
        documentId,
        contentType,
        chunksCreated: createdChunks.length,
      };
    } catch (error) {
      strapi.log.error(
        `Semantic Search: Indexing failed for ${contentType}:${documentId}: ${error.message}`
      );
      throw error;
    }
  },

  /**
   * Remove all indexed chunks for a specific document
   * @param {string} documentId - The document ID to remove from index
   */
  async removeDocument(documentId) {
    const deleted = await strapi.db
      .query("plugin::semantic-search.chunk")
      .deleteMany({
        where: { parentDocId: documentId },
      });

    strapi.log.info(
      `Semantic Search: Removed chunks for document ${documentId}`
    );
    return { success: true, documentId, chunksRemoved: deleted.count || 0 };
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
    ownerId
  ) {
    if (!ownerId) {
      throw new Error("ownerId is required for indexing documents");
    }

    const { chunking, embedding } = strapi.plugin("semantic-search").services;

    try {
      const document = await strapi.documents(contentType).findOne({
        documentId,
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found in ${contentType}`);
      }

      // Clear old chunks for this document and content type
      await strapi.db.query("plugin::semantic-search.chunk").deleteMany({
        where: { parentDocId: documentId, parentType: contentType },
      });

      // Combine all field contents
      const combinedText = fields
        .map((field) => document[field] || "")
        .filter((text) => text.length > 0)
        .join(" ");

      if (!combinedText) {
        throw new Error(
          `No content found in fields [${fields.join(", ")}] for document ${documentId}`
        );
      }

      const textChunks = chunking.splitText(combinedText);
      const createdChunks = [];

      for (const text of textChunks) {
        const vector = await embedding.generate(text);
        const chunk = await strapi.db
          .query("plugin::semantic-search.chunk")
          .create({
            data: {
              content: text,
              embedding: vector,
              parentDocId: documentId,
              parentType: contentType,
              titleReference: document[titleField] || "Untitled",
              owner: ownerId,
            },
          });
        createdChunks.push(chunk);
      }

      strapi.log.info(
        `Semantic Search: Indexed ${textChunks.length} chunks for ${contentType}:${documentId}`
      );

      return {
        success: true,
        documentId,
        contentType,
        fields,
        chunksCreated: createdChunks.length,
      };
    } catch (error) {
      strapi.log.error(`Semantic Search: Indexing failed: ${error.message}`);
      throw error;
    }
  },
});
