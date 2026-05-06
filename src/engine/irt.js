// src/engine/irt.js

// 1PL (Rasch) model probability
export function probabilityCorrect(theta, difficulty) {
  return 1 / (1 + Math.exp(-(theta - difficulty)));
}

// Theta update based on response
export function updateTheta(theta, difficulty, isCorrect, learningRate = 0.2) {
  const pCorrect = probabilityCorrect(theta, difficulty);

  // prediction error
  const error = isCorrect ? (1 - pCorrect) : (0 - pCorrect);

  return theta + learningRate * error;
}