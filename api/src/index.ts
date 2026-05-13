import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import prisma from "./lib/prisma";
import { recalculateInventoryAlertStatus } from "./lib/jit";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_, res) => {
  res.json({ status: "ok", service: "rrey-api", timestamp: new Date().toISOString() });
});

app.use("/api", routes);
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`🍺  Rrëy API running on port ${PORT}`);
  // Recalculate all inventory alert statuses on startup to clear stale isCritical flags
  try {
    const inventories = await prisma.inventory.findMany({ select: { id: true } });
    await Promise.all(inventories.map((inv) => recalculateInventoryAlertStatus(inv.id)));
    console.log(`✅  Recalculated alert status for ${inventories.length} inventory items`);
  } catch (err) {
    console.error("⚠️  Startup inventory recalculation failed:", err);
  }
});

export default app;
