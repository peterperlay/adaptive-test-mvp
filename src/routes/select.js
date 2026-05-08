export function selectNextQuestion(questions, theta, answeredSkillCounts = {}) {
  if (!questions.length) {
    return null;
  }

  const TARGET_SKILL_COUNT = 4;

  let bestQuestion = null;
  let bestScore = Infinity;

const filteredQuestions = questions.filter((q) => {
  const seen = Number(q.times_seen || 0);
  const empirical = Number(q.empirical_difficulty || 0);

  // még nincs elég adat -> engedjük
  if (seen < 5) {
    return true;
  }

  // túl könnyű
  if (empirical < 0.08) {
    return false;
  }

  // túl nehéz
  if (empirical > 0.92) {
    return false;
  }

  return true;
});

  for (const question of filteredQuestions) {
    const skill = question.skill_tag || question.skill || "general";

    const difficultyDistance = Math.abs(
      Number(question.difficulty) - Number(theta)
    );

    const answeredForSkill = answeredSkillCounts[skill] || 0;

    const skillUnderrepresentedBonus =
      Math.max(0, TARGET_SKILL_COUNT - answeredForSkill) * 0.15;

    const exposurePenalty =
  Number(question.times_seen || 0) * 0.01;

const score =
  difficultyDistance -
  skillUnderrepresentedBonus +
  exposurePenalty;

    if (score < bestScore) {
      bestScore = score;
      bestQuestion = question;
    }
  }

  return bestQuestion;
}