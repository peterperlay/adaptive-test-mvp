import "dotenv/config";
import { getPool } from "./src/db.js";
import fs from "fs";

const db = getPool();

const questions = JSON.parse(
  fs.readFileSync("./cefr_450_questions.json", "utf8")
);

function cleanQuestionText(text) {
  return String(text || "")
    .replace(/^Choose the correct word:\s*/i, "")
    .replace(/^Which option is correct\?\s*/i, "")
    .replace(/^Choose the correct answer:\s*/i, "")
    .trim();
}

async function seed() {
  try {
    console.log(`Seeding ${questions.length} questions...`);

    await db.query("BEGIN");

    console.log("Starting truncate...");

    await db.query(`
      TRUNCATE TABLE options, questions
      RESTART IDENTITY CASCADE;
    `);

    console.log("Truncate done.");

    let count = 0;

    for (const q of questions) {
      count++;

      if (count % 25 === 0) {
        console.log(`Inserted ${count}/${questions.length}`);
      }

      const questionText = cleanQuestionText(q.text);

      const questionResult = await db.query(
        `
        INSERT INTO questions (
          text,
          question,
          difficulty,
          skill_tag
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [
          questionText,
          q.question,
          q.difficulty,
          q.skill_tag,
        ]
      );

      const questionId = questionResult.rows[0].id;

      let correctOptionId = null;

      for (const option of q.options) {
        const optionResult = await db.query(
          `
          INSERT INTO options (
            question_id,
            text
          )
          VALUES ($1, $2)
          RETURNING id
          `,
          [
            questionId,
            option.text,
          ]
        );

        if (option.isCorrect) {
          correctOptionId = optionResult.rows[0].id;
        }
      }

      await db.query(
        `
        UPDATE questions
        SET correct_option_id = $1
        WHERE id = $2
        `,
        [
          correctOptionId,
          questionId,
        ]
      );
    }

    await db.query("COMMIT");

    console.log("Seed completed successfully.");

    process.exit(0);
  } catch (err) {
    await db.query("ROLLBACK");

    console.error("Seed failed:", err);

    process.exit(1);
  }
}

seed();