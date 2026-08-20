class PublicContentController {
  constructor(publicContentService) {
    this.publicContentService = publicContentService;
  }

  getBoards = async (req, res, next) => {
    try {
      const data = await this.publicContentService.getActiveBoards();
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };

  getPosts = async (req, res, next) => {
    try {
      const result = await this.publicContentService.getPostList(
        req.params.boardSlug,
        req.query.page
      );
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json({
        success: true,
        data: result.data,
        meta: { requestId: req.requestId, ...result.pagination },
      });
    } catch (error) {
      next(error);
    }
  };

  getPostDetail = async (req, res, next) => {
    try {
      const data = await this.publicContentService.getPostDetail(
        req.params.boardSlug,
        req.params.postId
      );
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = PublicContentController;
