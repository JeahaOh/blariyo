const express = require('express');

function createPublicPolicyRoutes(controller) {
  const router = express.Router();
  router.get('/policies/:type', controller.getPolicy);
  return router;
}

module.exports = createPublicPolicyRoutes;
