"use strict";

const bootstrap = require("./server/bootstrap");
const config = require("./server/config");
const contentTypes = require("./server/content-types");
const controllers = require("./server/controllers");
const routes = require("./server/routes");
const services = require("./server/services");

module.exports = () => ({
  bootstrap,
  config,
  contentTypes,
  controllers,
  routes,
  services,
});
