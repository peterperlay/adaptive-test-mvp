import ExcelJS from "exceljs";
import { getPool } from "../db.js";
import dotenv from "dotenv";

dotenv.config();
const EXCEL_PATH = "./data/Placement test_Question bank_L1-L9.xlsx";

function mapDifficulty(level) {
  const normalized = String(level).trim().replace(/^L/i, "");

  const map = {
    1: -2.5,
    2: -1.8,
    3: -1.2,
    4: -0.6,
    5: 0,
    6: 0.6,
    7: 1.2,
    8: 1.8,
    9: 2.5,
  };

  return map[normalized] ?? 0;
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

function buildImageUrl(value) {
  const url = String(value || "").trim();
  return url.startsWith("http") ? url : null;
}

function buildAudioUrl(value) {
  const url = String(value || "").trim();
  return url.startsWith("http") ? url : null;
}
function levelToCefr(level) {
  const normalized = String(level).trim().replace(/^L/i, "");

  const map = {
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
  };

  return map[normalized] ?? "5";
}



async function getDifficultyMapFromExistingBank(db) {
  const result = await db.query(`
    SELECT
      cefr_level,
      AVG(difficulty) AS avg_difficulty
    FROM questions
    WHERE difficulty IS NOT NULL
      AND cefr_level IS NOT NULL
    GROUP BY cefr_level
  `);

  const map = {};

  for (const row of result.rows) {
    map[row.cefr_level] = Number(row.avg_difficulty);
  }

  return map;
}
async function seed() {
  const db = getPool();

const workbook = new ExcelJS.Workbook();

await workbook.xlsx.readFile(EXCEL_PATH);
 const worksheet = workbook.getWorksheet("Sheet1");

if (!worksheet) {
  throw new Error("Sheet1 nevű sheet nem található az Excelben");
}

  const rows = [];

const difficultyMap =
  await getDifficultyMapFromExistingBank(db);

console.log(
  "Difficulty map from existing bank:",
  difficultyMap
);

worksheet.eachRow((row, rowNumber) => {
  if (rowNumber === 1) return;

  rows.push({
    Level: row.getCell(1).text,
    Skill: row.getCell(2).text,
    Question: row.getCell(3).text,
    Text: row.getCell(4).text,
    Image: row.getCell(5).text,
    AudioFile: row.getCell(6).text,
    "Correct Answer": row.getCell(7).text,
    "Answer Option 1": row.getCell(8).text,
    "Answer Option 2": row.getCell(9).text,
    "Answer Option 3": row.getCell(10).text,
    "Answer Option 4": row.getCell(11).text,
    Type: row.getCell(12).text,
  });
});

  console.log(`Found ${rows.length} rows`);

const levelCounts = {};

for (const row of rows) {
  const level = String(row.Level || "").trim() || "EMPTY";
  levelCounts[level] = (levelCounts[level] || 0) + 1;
}

console.log("LEVEL COUNTS FROM EXCEL:", levelCounts);

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
    const cefrLevel = levelToCefr(level);

    const matchedDifficulty =
     difficultyMap[cefrLevel] ??
     mapDifficulty(level);
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

    if (!correctAnswer || options.length < 2 || options.length > 4) {
  skippedCount++;

  console.warn(
    `⚠️ Row ${index + 2}: skipped, invalid option count (${options.length})`
  );

  continue;
}

const normalizedCorrectAnswer = correctAnswer.trim().toLowerCase();

const hasCorrectAnswer = options.some(
  (option) => option.trim().toLowerCase() === normalizedCorrectAnswer
);

if (!hasCorrectAnswer) {
  console.warn(
    `⚠️ Row ${index + 2}: correct answer mismatch, using first option as fallback`
  );
}

const questionText =
  normalizeType(row.Type) === "reading"
    ? ""
    : prompt;


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
        cefrLevel,
        matchedDifficulty,
      ]
    );

    const questionId = questionResult.rows[0].id;

    let correctOptionId = null;

    if (!hasCorrectAnswer) {
  correctOptionId = null;
}

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
  const fallbackOption = await db.query(
    `
    SELECT id
    FROM options
    WHERE question_id = $1
    ORDER BY id
    LIMIT 1
    `,
    [questionId]
  );

  correctOptionId = fallbackOption.rows[0]?.id;
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