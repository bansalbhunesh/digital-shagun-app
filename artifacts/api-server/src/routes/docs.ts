import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Router } from "express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Digital Shagun API",
      version: "0.1.0",
      description: "API documentation for the Digital Shagun application",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Development server",
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API docs
};

const specs = swaggerJsdoc(options);
const router = Router();

router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(specs));

export default router;
