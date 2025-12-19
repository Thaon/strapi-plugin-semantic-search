"use strict";

module.exports = ({ strapi }) => {
  strapi.log.info(
    'Semantic Search plugin loaded. Use strapi.plugin("semantic-search").service("indexer").indexDocument() to index documents manually.'
  );
};
