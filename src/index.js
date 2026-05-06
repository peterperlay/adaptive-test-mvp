import express from "express";
import dotenv from "dotenv";
import cors from "cors";  
import engineRoutes from "./routes/engine.js";
import authRoutes from "./routes/auth.js";

dotenv.config();

const app = express();

// 🔥 KRITIKUS: JSON BODY PARSER
app.use(cors());
app.use(express.json());

// -----------------------------------------------------
// HEALTH CHECK (nagyon hasznos debughoz)
// -----------------------------------------------------
app.get("/", (req, res) => {
  res.json({ status: "OK", service: "adaptive-test-mvp" });
});

// -----------------------------------------------------
// ROUTES
// -----------------------------------------------------
app.use("/engine", engineRoutes);
app.use("/auth", authRoutes);

// -----------------------------------------------------
// START SERVER
// -----------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
  console.log("ENV DB:", process.env.DATABASE_URL ? "loaded" : "missing");
});