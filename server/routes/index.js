"use strict";

module.exports = {
  search: {
    type: "content-api",
    routes: [
      {
        method: "GET",
        path: "/search",
        handler: "search.find",
        config: {
          policies: [],
          auth: {
            scope: ["find"],
          },
        },
      },
    ],
  },
};
