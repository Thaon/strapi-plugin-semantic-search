"use strict";

module.exports = ({ strapi }) => ({
  async find(ctx) {
    const { user } = ctx.state;

    if (!user) {
      return ctx.unauthorized("You must be logged in to search");
    }

    const { query, contentType, limit, threshold } = ctx.query;
    if (!query) {
      return ctx.badRequest("Query param is required");
    }

    const options = {
      ownerId: user.id,
      ...(contentType && { contentType }),
      ...(limit && { limit: parseInt(limit, 10) }),
      ...(threshold && { threshold: parseFloat(threshold) }),
    };

    const results = await strapi
      .plugin("semantic-search")
      .service("search")
      .querySearch(query, options);

    return {
      data: results,
      meta: { count: results.length },
    };
  },
});
