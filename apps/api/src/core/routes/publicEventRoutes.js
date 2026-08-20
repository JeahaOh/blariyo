const express = require('express');

function createPublicEventRoutes(controller) {
  const router = express.Router();
  router.post('/events', controller.ingest);
  return router;
}

module.exports = createPublicEventRoutes;
