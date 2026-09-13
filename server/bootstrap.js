"use strict";

const INDEX_STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS idx_sschunks_owner ON semantic_search_chunks(owner)",
  "CREATE INDEX IF NOT EXISTS idx_sschunks_parent ON semantic_search_chunks(parent_doc_id, parent_type)",
];

module.exports = async ({ strapi }) => {
  strapi.log.info(
    'Semantic Search plugin loaded. Use strapi.plugin("semantic-search").service("indexer").indexDocument() to index documents manually.',
  );

  // The chunk table has no indexes on its filter columns by default — every
  // query and every re-index delete would otherwise be a full table scan.
  try {
    const knex = strapi.db.connection;
    for (const statement of INDEX_STATEMENTS) {
      await knex.raw(statement);
    }
  } catch (err) {
    strapi.log.warn(
      `Semantic Search: could not create chunk indexes: ${err instanceof Error ? err.message : err}`,
    );
  }
};
