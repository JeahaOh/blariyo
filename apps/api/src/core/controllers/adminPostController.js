class AdminPostController {
  constructor(adminPostService, adminPostCommandService, adminPostLifecycleService) {
    this.adminPostService = adminPostService;
    this.adminPostCommandService = adminPostCommandService;
    this.adminPostLifecycleService = adminPostLifecycleService;
  }

  searchPosts = async (req, res, next) => {
    try {
      const result = await this.adminPostService.searchPosts(req.query);
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({
        success: true,
        data: result.data,
        meta: { requestId: req.requestId, ...result.pagination },
      });
    } catch (error) {
      next(error);
    }
  };

  getPost = async (req, res, next) => {
    try {
      const data = await this.adminPostService.getPost(req.params.postId);
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };

  createPost = async (req, res, next) => {
    try {
      const data = await this.adminPostCommandService.create(
        req.body,
        req.adminActor,
        req.get('Idempotency-Key')
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(201).json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };

  updatePost = async (req, res, next) => {
    try {
      const data = await this.adminPostCommandService.update(
        req.params.postId,
        req.body,
        req.adminActor
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };

  publishPost = async (req, res, next) => {
    try {
      const data = await this.adminPostLifecycleService.publish(
        req.params.postId,
        req.body,
        req.adminActor,
        req.get('Idempotency-Key')
      );
      this.commandResponse(res, req, data);
    } catch (error) {
      next(error);
    }
  };

  unschedulePost = async (req, res, next) => {
    try {
      const data = await this.adminPostLifecycleService.unschedule(
        req.params.postId,
        req.body,
        req.adminActor,
        req.get('Idempotency-Key')
      );
      this.commandResponse(res, req, data);
    } catch (error) {
      next(error);
    }
  };

  hidePost = async (req, res, next) => {
    try {
      const data = await this.adminPostLifecycleService.hide(
        req.params.postId,
        req.body,
        req.adminActor,
        req.get('Idempotency-Key')
      );
      this.commandResponse(res, req, data);
    } catch (error) {
      next(error);
    }
  };

  republishPost = async (req, res, next) => {
    try {
      const data = await this.adminPostLifecycleService.republish(
        req.params.postId,
        req.body,
        req.adminActor,
        req.get('Idempotency-Key')
      );
      this.commandResponse(res, req, data);
    } catch (error) {
      next(error);
    }
  };

  removePost = async (req, res, next) => {
    try {
      const data = await this.adminPostLifecycleService.remove(
        req.params.postId,
        req.body,
        req.adminActor,
        req.get('Idempotency-Key')
      );
      this.commandResponse(res, req, data);
    } catch (error) {
      next(error);
    }
  };

  commandResponse(res, req, data) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ success: true, data, meta: { requestId: req.requestId } });
  }
}

module.exports = AdminPostController;
