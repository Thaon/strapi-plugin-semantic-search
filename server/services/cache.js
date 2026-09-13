"use strict";

// In-memory chunk cache per owner. The plugin runs inside the Strapi process,
// so a module-level Map is shared by every service instance in that process.
const stores = new Map();

const HARD_CAP = 100000;

module.exports = ({ strapi }) => ({
  /**
   * @param {number | string} ownerId
   */
  invalidate(ownerId) {
    stores.delete(String(ownerId));
  },

  invalidateAll() {
    stores.clear();
  },

  // Loads (once) and caches every chunk for an owner as pre-normalized
  // Float32Array rows, so query-time similarity is pure dot products.
  /**
   * @param {number | string} ownerId
   */
  async getForOwner(ownerId) {
    const key = String(ownerId);
    const cached = stores.get(key);
    if (cached) return cached;

    const rows = await strapi.db
      .query("plugin::semantic-search.chunk")
      .findMany({
        where: { owner: ownerId },
        limit: HARD_CAP,
      });

    if (rows.length >= HARD_CAP) {
      console.warn(
        `[Semantic Search] owner ${ownerId}: chunk count hit the hard cap of ${HARD_CAP} — corpus is truncated`,
      );
    }

    const dims = rows.reduce(
      (m, r) =>
        Math.max(m, Array.isArray(r.embedding) ? r.embedding.length : 0),
      0,
    );
    const matrix = new Float32Array(rows.length * dims);
    const metas = new Array(rows.length);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      metas[i] = {
        parentDocId: row.parentDocId,
        title: row.titleReference,
        content: row.content,
        parentType: row.parentType,
      };

      const embedding = row.embedding;
      if (!Array.isArray(embedding) || embedding.length !== dims) continue;

      let norm = 0;
      for (let d = 0; d < dims; d++) norm += embedding[d] * embedding[d];
      norm = Math.sqrt(norm) || 1;

      const offset = i * dims;
      for (let d = 0; d < dims; d++) matrix[offset + d] = embedding[d] / norm;
    }

    const entry = { matrix, metas, dims, count: rows.length };
    stores.set(key, entry);
    return entry;
  },
});
