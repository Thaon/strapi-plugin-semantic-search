"use strict";

module.exports = {
  kind: "collectionType",
  collectionName: "semantic_search_chunks",
  info: {
    singularName: "chunk",
    pluralName: "chunks",
    displayName: "Semantic Search Chunk",
    description: "Stores text chunks with their embedding vectors",
  },
  options: {
    draftAndPublish: false,
  },
  pluginOptions: {
    "content-manager": {
      visible: false,
    },
    "content-type-builder": {
      visible: false,
    },
  },
  attributes: {
    content: {
      type: "text",
      required: true,
    },
    embedding: {
      type: "json",
      required: true,
    },
    parentDocId: {
      type: "string",
      required: true,
    },
    parentType: {
      type: "string",
      required: true,
    },
    titleReference: {
      type: "string",
    },
    owner: {
      type: "integer",
      required: true,
    },
  },
};
