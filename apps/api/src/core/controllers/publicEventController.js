class PublicEventController {
  constructor(publicEventService) {
    this.publicEventService = publicEventService;
  }

  ingest = async (req, res, next) => {
    try {
      await this.publicEventService.ingest(req.body);
      res.setHeader('Cache-Control', 'no-store');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = PublicEventController;
