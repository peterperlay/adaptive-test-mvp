import nodemailer from "nodemailer";
import express from "express";
import { getPool } from "../db.js";

import {
  updateTheta,
  probabilityCorrect,
  standardError,
  confidenceInterval,
} from "../engine/irt.js";

import { selectNextQuestion } from "../engine/select.js";
import { estimateCEFR } from "../engine/cefr.js";

const router = express.Router();

// -----------------------------------------------------
// INIT DB
// -----------------------------------------------------
router.get("/init-db", async (req, res) => {
  try {
    const db = getPool();

    await db.query(`
      CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  question TEXT NOT NULL,
  difficulty FLOAT NOT NULL,
  skill_tag TEXT,
  correct_option_id INTEGER
);
    `);

await db.query(`
  ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS question TEXT;
`);

    await db.query(`
      CREATE TABLE IF NOT EXISTS options (
        id SERIAL PRIMARY KEY,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        text TEXT NOT NULL
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        option_id INTEGER REFERENCES options(id) ON DELETE SET NULL,
        is_correct BOOLEAN NOT NULL,
        theta_before FLOAT,
        theta_after FLOAT,
        cefr_after TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    res.json({ message: "DB initialized" });
  } catch (err) {
    console.error("INIT DB ERROR:", err);

    res.status(500).json({
      error: "init failed",
      details: err.message,
    });
  }
});

// -----------------------------------------------------
// GET NEXT QUESTION
// -----------------------------------------------------
router.get("/next-question/:userId", async (req, res) => {
  try {
    const db = getPool();
    const userId = req.params.userId;

    const MIN_QUESTIONS = 20;
    const MAX_QUESTIONS = 35;

    const STABILITY_WINDOW = 5;
    const STABILITY_THRESHOLD = 0.05;

    const SEM_THRESHOLD = 0.35;

    const userResult = await db.query(
      `
      SELECT *
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const user = userResult.rows[0];

const historyResult = await db.query(
  `
  SELECT
    a.is_correct,
    a.theta_before,
    a.theta_after,
    a.created_at,
    q.difficulty
  FROM answers a
  JOIN questions q
    ON q.id = a.question_id
  WHERE a.user_id = $1
  ORDER BY a.created_at ASC
  `,
  [userId]
);



    const answers = historyResult.rows;

    const answeredCount = answers.length;
const correctCount = answers.filter((a) => a.is_correct).length;

const thetaHistory = answers.map((a, index) => ({
  questionNumber: index + 1,
  thetaBefore: Number(a.theta_before),
  thetaAfter: Number(a.theta_after),
  isCorrect: a.is_correct,
}));


    const sem = standardError(
      user.ability_score,
      answers
    );

    const ci95 = confidenceInterval(
      user.ability_score,
      sem
    );

    let shouldStop = false;
    let stopReason = null;

    // max question stop
    if (answeredCount >= MAX_QUESTIONS) {
      shouldStop = true;
      stopReason = "Maximum question limit reached";
    }

    // theta stabilization stop
    if (
      answeredCount >= MIN_QUESTIONS &&
      answers.length >= STABILITY_WINDOW + 1
    ) {
      const recent = answers.slice(
        -(STABILITY_WINDOW + 1)
      );

      const deltas = [];

      for (let i = 1; i < recent.length; i++) {
        deltas.push(
          Math.abs(
            Number(recent[i].theta_after) -
              Number(recent[i - 1].theta_after)
          )
        );
      }

      const averageDelta =
        deltas.reduce((sum, value) => sum + value, 0) /
        deltas.length;

      if (averageDelta < STABILITY_THRESHOLD) {
        shouldStop = true;
        stopReason =
          `Theta stable over last ${STABILITY_WINDOW} answers`;
      }
    }

    // SEM stop
    if (
      answeredCount >= MIN_QUESTIONS &&
      sem !== null &&
      sem <= SEM_THRESHOLD
    ) {
      shouldStop = true;
      stopReason =
        `Confidence threshold reached: SEM ${sem.toFixed(2)}`;
    }

    if (shouldStop) {
      return res.json({
        finished: true,
        stopReason,
        correctCount,
        thetaHistory,        
        answeredCount,

        user: {
          id: user.id,
          theta: user.ability_score,
          cefr: user.cefr_estimate,
          sem,
          ci95,
        },

        nextQuestion: null,
      });
    }

const questionsResult = await db.query(
  `
  SELECT q.*
  FROM questions q
  LEFT JOIN answers a
    ON a.question_id = q.id
   AND a.user_id = $1
  WHERE a.id IS NULL
  ORDER BY q.id ASC
  `,
  [userId]
);

    if (!questionsResult.rows.length) {
      return res.json({
        finished: true,
   correctCount,
        thetaHistory,
        stopReason:
          "No more questions available for this user",

        answeredCount,

     

        user: {
          id: user.id,
          theta: user.ability_score,
          cefr: user.cefr_estimate,
          sem,
          ci95,
        },

        nextQuestion: null,
      });
    }

    const next = selectNextQuestion(
      questionsResult.rows,
      user.ability_score
    );

    const optionsResult = await db.query(
      `
      SELECT id, text
      FROM options
      WHERE question_id = $1
      ORDER BY id
      `,
      [next.id]
    );

res.json({
  finished: false,

  answeredCount,
  correctCount,
  thetaHistory,

  user: {
        id: user.id,
        theta: user.ability_score,
        cefr: user.cefr_estimate,
        sem,
        ci95,
      },

      nextQuestion: {
        ...next,
        options: optionsResult.rows,
      },
    });

  } catch (err) {
    console.error(
      "ENGINE NEXT QUESTION ERROR:",
      err
    );

    res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// -----------------------------------------------------
// SUBMIT ANSWER
// -----------------------------------------------------
router.post("/answer", async (req, res) => {
  try {
    const {
      userId,
      questionId,
      optionId,
    } = req.body || {};

    if (!userId || !questionId || !optionId) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const db = getPool();

    const userResult = await db.query(
      `
      SELECT *
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const questionResult = await db.query(
      `
      SELECT *
      FROM questions
      WHERE id = $1
      `,
      [questionId]
    );

    if (
      !userResult.rows.length ||
      !questionResult.rows.length
    ) {
      return res.status(404).json({
        error: "User or question not found",
      });
    }

    const user = userResult.rows[0];
    const question = questionResult.rows[0];

const alreadyAnswered = await db.query(
  `
  SELECT id
  FROM answers
  WHERE user_id = $1
    AND question_id = $2
  LIMIT 1
  `,
  [userId, questionId]
);

if (alreadyAnswered.rows.length) {
  return res.status(409).json({
    error: "Question already answered by this user",
  });
}

    const thetaBefore = user.ability_score;

    const isCorrect =
      Number(optionId) ===
      Number(question.correct_option_id);

    const newTheta = updateTheta(
      thetaBefore,
      question.difficulty,
      isCorrect
    );

    const newCefr = estimateCEFR(newTheta);

    await db.query(
      `
      UPDATE users
      SET ability_score = $1,
          cefr_estimate = $2
      WHERE id = $3
      `,
      [
        newTheta,
        newCefr,
        userId,
      ]
    );

    await db.query(
      `
      INSERT INTO answers (
        user_id,
        question_id,
        option_id,
        is_correct,
        theta_before,
        theta_after,
        cefr_after
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        userId,
        questionId,
        optionId,
        isCorrect,
        thetaBefore,
        newTheta,
        newCefr,
      ]
    );

    const answeredItemsResult = await db.query(
      `
      SELECT q.difficulty
      FROM answers a
      JOIN questions q
        ON q.id = a.question_id
      WHERE a.user_id = $1
      `,
      [userId]
    );

    const sem = standardError(
      newTheta,
      answeredItemsResult.rows
    );

    const ci95 = confidenceInterval(
      newTheta,
      sem
    );

    const p = probabilityCorrect(
      newTheta,
      question.difficulty
    );

    res.json({
      userId,
      questionId,

      selectedOptionId: optionId,

      isCorrect,

      thetaBefore,

      theta: newTheta,

      cefr: newCefr,

      sem,

      ci95,

      debug: {
        pCorrect: p,
        correctOptionId:
          question.correct_option_id,
      },
    });

  } catch (err) {
    console.error(
      "ENGINE ANSWER ERROR:",
      err
    );

    res.status(500).json({
      error: "Server error",
      details: err.message,
    });
  }
});

// -----------------------------------------------------
// RESET USER TEST
// -----------------------------------------------------
router.post("/reset/:userId", async (req, res) => {
  try {
    const db = getPool();

    const userId = req.params.userId;

    await db.query(
      `
      DELETE FROM answers
      WHERE user_id = $1
      `,
      [userId]
    );

    await db.query(
      `
      UPDATE users
      SET ability_score = 0,
          cefr_estimate = 'B1'
      WHERE id = $1
      `,
      [userId]
    );

    res.json({
      message: "User reset successful",
    });

  } catch (err) {
    console.error(
      "RESET ERROR:",
      err
    );

    res.status(500).json({
      error: "Reset failed",
      details: err.message,
    });
  }
});

// -----------------------------------------------------
// SEND RESULT EMAIL
// -----------------------------------------------------
router.post("/send-result", async (req, res) => {
  try {
    const { email, result } = req.body || {};

    if (!email || !result) {
      return res.status(400).json({
        error: "Missing email or result",
      });
    }

    const cefr = result?.user?.cefr || "N/A";
    const theta = result?.user?.theta ?? "N/A";
    const answeredCount = result?.answeredCount ?? "N/A";
    const sem = result?.user?.sem ?? "N/A";

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Your BOOKR Adaptive Test Result",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h1>Your English level result</h1>

          <p>Thank you for completing the BOOKR Adaptive Placement Test.</p>

          <div style="padding: 20px; background: #f5f3ff; border-radius: 16px;">
            <h2 style="margin: 0;">Estimated CEFR level: ${cefr}</h2>
          </div>

          <p><strong>Answered questions:</strong> ${answeredCount}</p>
          <p><strong>Ability score:</strong> ${theta}</p>
          <p><strong>Standard error:</strong> ${sem}</p>

          <p>
            This result is an adaptive estimate based on your answers.
          </p>

          <p>BOOKR Team</p>
        </div>
      `,
    });

    res.json({
      message: "Result email sent",
    });
  } catch (err) {
    console.error("SEND RESULT EMAIL ERROR:", err);

    res.status(500).json({
      error: "Email sending failed",
      details: err.message,
    });
  }
});

export default router;