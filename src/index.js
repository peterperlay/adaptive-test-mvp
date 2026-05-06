import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import { getPool } from "./db.js";
import engineRoutes from "./routes/engine.js";

app.use("/engine", engineRoutes);

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

// TEST DB
getPool().query("SELECT NOW()")
  .then(r => console.log("DB OK:", r.rows[0]))
  .catch(e => console.error("DB ERROR:", e));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  console.log("ENV CHECK:", process.env.DATABASE_URL);
});