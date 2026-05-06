import { useEffect, useState } from "react";

const API = "http://localhost:3000";

export default function App() {
  const [userId] = useState(1);
  const [user, setUser] = useState(null);
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(false);

  // -----------------------------
  // 1. kérdés lekérése
  // -----------------------------
  const fetchQuestion = async () => {
    const res = await fetch(`${API}/engine/next-question/${userId}`);
    const data = await res.json();

    setUser(data.user);
    setQuestion(data.nextQuestion);
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  // -----------------------------
  // 2. válasz küldés
  // -----------------------------
  const answer = async (isCorrect) => {
    setLoading(true);

    await fetch(`${API}/engine/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        questionId: question.id,
        isCorrect,
      }),
    });

    await fetchQuestion();
    setLoading(false);
  };

  // -----------------------------
  // UI
  // -----------------------------
  if (!question) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Adaptive Test Engine</h1>

      <div style={{ marginBottom: 20 }}>
        <strong>Theta:</strong> {user?.theta.toFixed(3)} <br />
        <strong>CEFR:</strong> {user?.cefr}
      </div>

      <div style={{ padding: 20, border: "1px solid #ccc" }}>
        <h3>{question.text}</h3>
        <p>
          Difficulty: {question.difficulty} | Skill: {question.skill_tag}
        </p>

        <button onClick={() => answer(true)} disabled={loading}>
          Correct
        </button>

        <button onClick={() => answer(false)} disabled={loading}>
          Wrong
        </button>
      </div>
    </div>
  );
}