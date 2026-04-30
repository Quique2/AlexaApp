import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

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

app.listen(PORT, () => {
  console.log(`🍺  Rrëy API running on port ${PORT}`);
});

export default app;
