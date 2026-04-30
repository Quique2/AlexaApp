import { Router } from "express";
import materialsRouter from "./materials";
import inventoryRouter from "./inventory";
import ordersRouter from "./orders";
import receptionsRouter from "./receptions";
import productionRouter from "./production";
import suppliersRouter from "./suppliers";
import dashboardRouter from "./dashboard";
import configRouter from "./config";
import recipesRouter from "./recipes";

const router = Router();

router.use("/materials", materialsRouter);
router.use("/inventory", inventoryRouter);
router.use("/orders", ordersRouter);
router.use("/receptions", receptionsRouter);
router.use("/production", productionRouter);
router.use("/suppliers", suppliersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/config", configRouter);
router.use("/recipes", recipesRouter);

export default router;
