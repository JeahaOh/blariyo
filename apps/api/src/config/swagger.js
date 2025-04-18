const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Blariyo API',
      version: '1.0.0',
      description: 'Blariyo API 문서',
      contact: {
        name: 'API Support',
        email: 'jeaha1217@gmail.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '개발 서버'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: ['./src/routes/*.js'] // API 라우트 파일들의 경로
};

const specs = swaggerJsdoc(options);

module.exports = specs; 