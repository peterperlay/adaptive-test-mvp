import xlsx from "xlsx";
import dotenv from "dotenv";
import { getPool } from "./src/db.js";

dotenv.config();

const EXCEL_FILE = "./Placement test_Question bank_L1-L9.xlsx";

function mapDifficulty(level) {
  const map = {
    L1: -2.5,
    L2: -2,
    L3: -1.5,
    L4: -1,
    L5: -0.5,
    L6: 0,
    L7: 0.5,
    L8: 1,
    L9: 1.5,
    A1: -2,
    A2: -1,
    B1: 0,
    B2: 1,
    C1: 2,
  };

  return map[String(level).trim()] ?? 0;
}

function normalizeType(type) {
  const value = String(type || "").toLowerCase().trim();

  if (value.includes("image") || value.includes("picture")) {
    return "image";
  }

  if (value.includes("audio") || value.includes("listening")) {
    return "listening";
  }

  if (value.includes("reading") || value.includes("text")) {
    return "reading";
  }

  return "multiple_choice";
}

function buildImageUrl(filename) {
  if (!filename) return null;
  return `/media/images/${String(filename).trim()}`;
}

function buildAudioUrl(filename) {
  if (!filename) return null;
  return `/media/audio/${String(filename).trim()}`;
}

async function seed() {
  const db = getPool();

  const workbook = xlsx.readFile(EXCEL_FILE);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = xlsx.utils.sheet_to_json(sheet, {
    defval: "",
  });

  console.log(`Found ${rows.length} rows`);

  await db.query("DELETE FROM answers");
  await db.query("DELETE FROM options");
  await db.query("DELETE FROM questions");

  let insertedCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];

    const progress = Math.round(((index + 1) / rows.length) * 100);

    console.log(`\n========== ${progress}% ==========`);
    console.log(
      `[${index + 1}/${rows.length}] Processing:`,
      row.Question || row.Text || "NO QUESTION"
    );

    const level = row.Level;
    const skill = row.Skill;
    const type = normalizeType(row.Type);

    const prompt = String(row.Question || "").trim();
    const passage = String(row.Text || "").trim();
    const imageUrl = buildImageUrl(row.Image);
    const audioUrl = buildAudioUrl(row.AudioFile);

    const correctAnswer = String(row["Correct Answer"] || "").trim();

    const options = [
      row["Answer Option 1"],
      row["Answer Option 2"],
      row["Answer Option 3"],
      row["Answer Option 4"],
    ]
      .map((option) => String(option || "").trim())
      .filter(Boolean);

    if (!prompt && !passage) {
      skippedCount++;
      console.warn("⚠️ Skipping row without question/text");
      continue;
    }

    if (!correctAnswer || options.length < 2) {
      skippedCount++;
      console.warn("⚠️ Skipping row without valid answers");
      continue;
    }

    const questionText = prompt || passage;

    const questionResult = await db.query(
      `
      INSERT INTO questions (
        text,
        question,
        prompt,
        passage,
        image_url,
        audio_url,
        type,
        skill,
        skill_tag,
        cefr_level,
        difficulty
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id
      `,
      [
        questionText,
        questionText,
        prompt,
        passage,
        imageUrl,
        audioUrl,
        type,
        skill,
        skill,
        level,
        mapDifficulty(level),
      ]
    );

    const questionId = questionResult.rows[0].id;

    let correctOptionId = null;

    for (const optionText of options) {
      const optionResult = await db.query(
        `
        INSERT INTO options (
          question_id,
          text
        )
        VALUES ($1,$2)
        RETURNING id
        `,
        [questionId, optionText]
      );

      if (
        optionText.trim().toLowerCase() ===
        correctAnswer.trim().toLowerCase()
      ) {
        correctOptionId = optionResult.rows[0].id;
      }
    }

    if (!correctOptionId) {
      const correctOptionResult = await db.query(
        `
        INSERT INTO options (
          question_id,
          text
        )
        VALUES ($1,$2)
        RETURNING id
        `,
        [questionId, correctAnswer]
      );

      correctOptionId = correctOptionResult.rows[0].id;

      console.warn(
        `⚠️ Correct answer was not in options. Added as extra option for question ${questionId}`
      );
    }

    await db.query(
      `
      UPDATE questions
      SET correct_option_id = $1
      WHERE id = $2
      `,
      [correctOptionId, questionId]
    );

    insertedCount++;

    console.log(`✅ Inserted question ${questionId} (${type})`);
  }

  console.log("\n==============================");
  console.log("Excel seed done");
  console.log(`Inserted: ${insertedCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log("==============================");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});