class PublicPolicyController {
  constructor(publicPolicyService) {
    this.publicPolicyService = publicPolicyService;
  }

  getPolicy = async (req, res, next) => {
    try {
      const data = await this.publicPolicyService.getPolicy(req.params.type, req.query.version);
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
      res.json({ success: true, data, meta: { requestId: req.requestId } });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = PublicPolicyController;
