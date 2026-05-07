import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const API = "http://localhost:3000";

export default function App() {
  const userId = 1;

  const [question, setQuestion] = useState(null);
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState([]);

  const [selectedOptionId, setSelectedOptionId] = useState(null);

  const [finished, setFinished] = useState(false);
  const [stopReason, setStopReason] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    fetchQuestion();
  }, []);

  const fetchQuestion = async () => {
    const res = await fetch(`${API}/engine/next-question/${userId}`);
    const data = await res.json();

    console.log("NEXT QUESTION RESPONSE:", data);

    setUser(data.user);
    setAnsweredCount(data.answeredCount || 0);
    setSelectedOptionId(null);

    if (data.finished === true || data.nextQuestion === null) {
      setFinished(true);
      setStopReason(
        data.stopReason ||
          data.message ||
          "Test finished"
      );

      setQuestion(null);

      return;
    }

    setFinished(false);
    setStopReason(null);

    setQuestion(data.nextQuestion);
  };

  const answer = async () => {
    if (!question || !selectedOptionId) return;

    setLoading(true);

    try {
      const res = await fetch(`${API}/engine/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          questionId: question.id,
          optionId: selectedOptionId,
        }),
      });

      const data = await res.json();

      setHistory((prev) => [
        ...prev,
        {
          index: prev.length + 1,
          theta: data.theta,
          correct: data.isCorrect,
          difficulty: question.difficulty,
        },
      ]);

      await fetchQuestion();
    } finally {
      setLoading(false);
    }
  };

  const resetTest = async () => {
    setLoading(true);

    try {
      await fetch(`${API}/engine/reset/${userId}`, {
        method: "POST",
      });

      setHistory([]);
      setFinished(false);
      setStopReason(null);
      setAnsweredCount(0);
      setSelectedOptionId(null);

      await fetchQuestion();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "Arial",
        maxWidth: 700,
      }}
    >
      <h1>Adaptive Test Engine</h1>

      {user && (
        <div style={{ marginBottom: 20 }}>
          <strong>Theta:</strong>{" "}
          {Number(user.theta).toFixed(2)}

          <br />

          <strong>CEFR:</strong> {user.cefr}

          <br />

          <strong>Answered:</strong>{" "}
          {answeredCount}
        </div>
      )}

      {finished && (
        <div
          style={{
            padding: 20,
            border: "1px solid #ccc",
            borderRadius: 10,
            background: "#f7f7f7",
            marginBottom: 30,
          }}
        >
          <h2>Test completed</h2>

          <p>
            <strong>Final theta:</strong>{" "}
            {user
              ? Number(user.theta).toFixed(2)
              : "-"}
          </p>

          <p>
            <strong>Final CEFR:</strong>{" "}
            {user?.cefr || "-"}
          </p>

          <p>
            <strong>Questions answered:</strong>{" "}
            {answeredCount}
          </p>

          <p>
            <strong>Stop reason:</strong>{" "}
            {stopReason || "Test finished"}
          </p>

          <button
            onClick={resetTest}
            disabled={loading}
            style={{
              marginTop: 10,
              padding: "12px 20px",
              border: "none",
              borderRadius: 8,
              background: "#624ee9",
              color: "white",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              fontSize: 16,
            }}
          >
            Restart test
          </button>
        </div>
      )}

      {!finished && question && (
        <div style={{ marginBottom: 20 }}>
          <h3>{question.text}</h3>

          <p>
            Difficulty: {question.difficulty} |
            Skill: {question.skill_tag}
          </p>

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 20,
            }}
          >
            {question.options?.map((option) => (
              <button
                key={option.id}
                onClick={() =>
                  setSelectedOptionId(option.id)
                }
                disabled={loading}
                style={{
                  padding: 14,
                  borderRadius: 8,
                  border:
                    selectedOptionId === option.id
                      ? "2px solid #624ee9"
                      : "1px solid #ccc",
                  background:
                    selectedOptionId === option.id
                      ? "#f3f0ff"
                      : "white",
                  cursor: loading
                    ? "not-allowed"
                    : "pointer",
                  textAlign: "left",
                  fontSize: 16,
                }}
              >
                {option.text}
              </button>
            ))}
          </div>

          <button
            onClick={answer}
            disabled={
              !selectedOptionId || loading
            }
            style={{
              marginTop: 20,
              padding: "12px 20px",
              border: "none",
              borderRadius: 8,
              background:
                !selectedOptionId || loading
                  ? "#aaa"
                  : "#624ee9",
              color: "white",
              cursor:
                !selectedOptionId || loading
                  ? "not-allowed"
                  : "pointer",
              fontSize: 16,
            }}
          >
            {loading
              ? "Submitting..."
              : "Submit Answer"}
          </button>
        </div>
      )}

      <div style={{ marginTop: 40 }}>
        <h2>Progress (Theta)</h2>

        <LineChart
          width={500}
          height={250}
          data={history}
        >
          <XAxis dataKey="index" />

          <YAxis />

          <Tooltip />

          <Line
            type="monotone"
            dataKey="theta"
            stroke="#8884d8"
          />
        </LineChart>
      </div>
    </div>
  );
}