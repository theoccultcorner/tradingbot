import { Router } from "express";
import { getServerActivity } from "../services/activityService.js";

export function createActivityRouter() {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const result = await getServerActivity({ limit: request.query.limit });
      response.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
