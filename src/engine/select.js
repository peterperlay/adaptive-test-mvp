// src/engine/select.js

import { probabilityCorrect } from "./irt.js";

/**
 * Select question with highest information gain
 * (best around p ≈ 0.5)
 */
export function selectNextQuestion(questions, theta) {
  if (!questions || questions.length === 0) return null;

  return questions
    .map(q => {
      const p = probabilityCorrect(theta, q.difficulty);

      // information is highest when p ~ 0.5
      const info = 1 - Math.abs(0.5 - p);

      return {
        ...q,
        score: info
      };
    })
    .sort((a, b) => b.score - a.score)[0];
}