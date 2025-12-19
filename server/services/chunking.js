"use strict";

module.exports = ({ strapi }) => ({
  splitText(text, chunkSize = null, chunkOverlap = null) {
    const config = strapi.config.get("plugin::semantic-search");
    const size = chunkSize || config.chunkSize || 1000;
    const overlap = chunkOverlap || config.chunkOverlap || 150;

    if (!text || text.trim().length === 0) {
      return [];
    }

    const cleanedText = text.trim();

    // If text is smaller than chunk size, return as single chunk
    if (cleanedText.length <= size) {
      return [cleanedText];
    }

    const chunks = [];
    let start = 0;

    while (start < cleanedText.length) {
      let end = start + size;

      // Try to break at sentence boundary
      if (end < cleanedText.length) {
        const lastPeriod = cleanedText.lastIndexOf(".", end);
        const lastNewline = cleanedText.lastIndexOf("\n", end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + size / 2) {
          end = breakPoint + 1;
        }
      }

      const chunk = cleanedText.slice(start, end).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      start = end - overlap;

      // Prevent infinite loop
      if (start >= cleanedText.length - overlap) {
        break;
      }
    }

    return chunks;
  },
});
