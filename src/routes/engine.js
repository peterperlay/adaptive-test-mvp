import express from "express";
import { getPool } from "../db.js";

import { updateTheta, probabilityCorrect } from "../engine/irt.js";
import { selectNextQuestion } from "../engine/select.js";
import { estimateCEFR } from "../engine/cefr.js";

const router = express.Router();


// -----------------------------------------------------
// 1. GET NEXT QUESTION
// -----------------------------------------------------
router.get("/next-question/:userId", async (req, res) => {
  try {
    const db = getPool();

    const userResult = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [req.params.userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult.rows[0];

    const questionsResult = await db.query(
      "SELECT * FROM questions"
    );

    const next = selectNextQuestion(
      questionsResult.rows,
      user.ability_score
    );

    res.json({
      user: {
        id: user.id,
        theta: user.ability_score,
        cefr: user.cefr_estimate
      },
      nextQuestion: next
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// -----------------------------------------------------
// 2. SUBMIT ANSWER
// -----------------------------------------------------
router.post("/answer", async (req, res) => {
  try {
    const { userId, questionId, isCorrect } = req.body;

    const db = getPool();

    const userResult = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    const questionResult = await db.query(
      "SELECT * FROM questions WHERE id = $1",
      [questionId]
    );

    if (!userResult.rows.length || !questionResult.rows.length) {
      return res.status(404).json({ error: "User or question not found" });
    }

    const user = userResult.rows[0];
    const question = questionResult.rows[0];

    // 1. IRT update
    const newTheta = updateTheta(
      user.ability_score,
      question.difficulty,
      isCorrect
    );

    // 2. CEFR mapping
    const newCefr = estimateCEFR(newTheta);

    // 3. save user state
    await db.query(
      "UPDATE users SET ability_score = $1, cefr_estimate = $2 WHERE id = $3",
      [newTheta, newCefr, userId]
    );

    // 4. probability debug (optional)
    const p = probabilityCorrect(newTheta, question.difficulty);

    res.json({
      userId,
      questionId,
      isCorrect,
      theta: newTheta,
      cefr: newCefr,
      debug: {
        pCorrect: p
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// -----------------------------------------------------
// EXPORT (VERY IMPORTANT)
// -----------------------------------------------------
export default router;