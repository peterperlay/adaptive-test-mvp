import express from "express";
import { getPool } from "../db.js";
import { updateTheta } from "../engine/irt.js";
import { estimateCEFR } from "../engine/cefr.js";
import { selectNextQuestion } from "../engine/select.js";

const router = express.Router();

/**
 * 1. create fake user
 */
router.post("/init", async (req, res) => {
  const db = getPool();

  const result = await db.query(`
    INSERT INTO users (email, ability_score, cefr_estimate)
    VALUES ($1, $2, $3)
    RETURNING *
  `, ["test@test.com", 0, "B1"]);

  res.json(result.rows[0]);
});

/**
 * 2. simulate answer
 */
router.post("/step", async (req, res) => {
  const { userId, questionId, isCorrect } = req.body;

  const db = getPool();

  const userRes = await db.query("SELECT * FROM users WHERE id=$1", [userId]);
  const questionRes = await db.query("SELECT * FROM questions WHERE id=$1", [questionId]);

  const user = userRes.rows[0];
  const question = questionRes.rows[0];

  const newTheta = updateTheta(user.ability_score, question.difficulty, isCorrect);
  const cefr = estimateCEFR(newTheta);

  await db.query(
    "UPDATE users SET ability_score=$1, cefr_estimate=$2 WHERE id=$3",
    [newTheta, cefr, userId]
  );

  const allQuestions = await db.query("SELECT * FROM questions");

  const next = selectNextQuestion(allQuestions.rows, newTheta);

  res.json({
    newTheta,
    cefr,
    nextQuestion: next
  });
});

export default router;