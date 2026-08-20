const express = require('express');
const adminImageUpload = require('../http/adminImageUpload');

function createAdminPostRoutes(controller, imageController) {
  const router = express.Router();
  router.post('/images', adminImageUpload, imageController.upload);
  router.get('/images/:imageId/preview', imageController.preview);
  router.delete('/images/:imageId', imageController.discard);
  router.post('/posts', controller.createPost);
  router.get('/posts', controller.searchPosts);
  router.patch('/posts/:postId', controller.updatePost);
  router.get('/posts/:postId', controller.getPost);
  router.post('/posts/:postId/publish', controller.publishPost);
  router.post('/posts/:postId/unschedule', controller.unschedulePost);
  router.post('/posts/:postId/hide', controller.hidePost);
  router.post('/posts/:postId/republish', controller.republishPost);
  router.delete('/posts/:postId', controller.removePost);
  return router;
}

module.exports = createAdminPostRoutes;
