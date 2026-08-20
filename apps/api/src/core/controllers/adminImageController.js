class AdminImageController {
  constructor(adminImageService) {
    this.adminImageService = adminImageService;
  }

  upload = async (req, res, next) => {
    try {
      const data = await this.adminImageService.upload(req.files, req.adminActor);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(201).json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };

  preview = async (req, res, next) => {
    try {
      const image = await this.adminImageService.preview(req.params.imageId);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Content-Type', image.mimeType);
      res.setHeader('Content-Length', image.body.length);
      res.send(image.body);
    } catch (error) {
      next(error);
    }
  };

  discard = async (req, res, next) => {
    try {
      const data = await this.adminImageService.discard(req.params.imageId, req.adminActor);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(202).json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AdminImageController;
