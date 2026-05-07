export function probabilityCorrect(theta, difficulty, discrimination = 1) {
  return 1 / (1 + Math.exp(-discrimination * (theta - difficulty)));
}

export function updateTheta(theta, difficulty, isCorrect, discrimination = 1) {
  const p = probabilityCorrect(theta, difficulty, discrimination);
  const response = isCorrect ? 1 : 0;

  const learningRate = 0.35;

  const newTheta = theta + learningRate * (response - p);

  return Math.max(-3, Math.min(3, newTheta));
}

export function itemInformation(theta, difficulty, discrimination = 1) {
  const p = probabilityCorrect(theta, difficulty, discrimination);

  return discrimination ** 2 * p * (1 - p);
}

export function standardError(theta, answeredQuestions = []) {
  if (!answeredQuestions.length) {
    return null;
  }

  const totalInformation = answeredQuestions.reduce((sum, item) => {
    return sum + itemInformation(theta, item.difficulty, item.discrimination || 1);
  }, 0);

  if (totalInformation <= 0) {
    return null;
  }

  return 1 / Math.sqrt(totalInformation);
}

export function confidenceInterval(theta, sem, z = 1.96) {
  if (sem === null || sem === undefined) {
    return null;
  }

  return {
    lower: theta - z * sem,
    upper: theta + z * sem,
  };
}