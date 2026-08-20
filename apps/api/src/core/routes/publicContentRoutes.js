const express = require('express');

function createPublicContentRoutes(controller) {
  const router = express.Router();
  router.get('/boards', controller.getBoards);
  router.get('/boards/:boardSlug/posts', controller.getPosts);
  router.get('/boards/:boardSlug/posts/:postId', controller.getPostDetail);
  return router;
}

module.exports = createPublicContentRoutes;
