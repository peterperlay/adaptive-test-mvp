import { useState } from "react";
import "./App.css";

const API = "http://localhost:3000";

export default function App() {
  const userId = 1;

  const [screen, setScreen] = useState("landing");
  const [question, setQuestion] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const [showDetails, setShowDetails] = useState(false);
  const [testStartedAt, setTestStartedAt] = useState(null);
  const [testFinishedAt, setTestFinishedAt] = useState(null);

  async function getNextQuestion() {
    const res = await fetch(`${API}/engine/next-question/${userId}`);

    if (!res.ok) {
      throw new Error(`Next question API error: ${res.status}`);
    }

    return await res.json();
  }

  async function startTest() {
    try {
      setLoading(true);
      setScreen("test");
      setQuestion(null);
      setResult(null);
      setShowDetails(false);
      setTestStartedAt(Date.now());
      setTestFinishedAt(null);

      const data = await getNextQuestion();

      if (data.finished) {
        setResult(data);
        setTestFinishedAt(Date.now());
        setScreen("result");
      } else {
        setQuestion(data.nextQuestion);
      }
    } catch (error) {
      console.error("START TEST ERROR:", error);
      alert("Nem sikerült elindítani a tesztet.");
      setScreen("landing");
    } finally {
      setLoading(false);
    }
  }

  async function answerQuestion(optionId) {
    try {
      setLoading(true);

      const answerRes = await fetch(`${API}/engine/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          questionId: question.id,
          optionId,
        }),
      });

      if (!answerRes.ok) {
        throw new Error(`Answer API error: ${answerRes.status}`);
      }

      await answerRes.json();

      const nextData = await getNextQuestion();
      console.log("NEXT DATA AFTER ANSWER:", nextData);

      if (nextData.finished) {
        setResult(nextData);
        setQuestion(null);
        setTestFinishedAt(Date.now());
        setScreen("result");
      } else {
        setQuestion(nextData.nextQuestion);
      }
    } catch (error) {
      console.error("ANSWER ERROR:", error);
      alert("Nem sikerült beküldeni a választ.");
    } finally {
      setLoading(false);
    }
  }

  async function resetUser() {
    try {
      setLoading(true);

      const res = await fetch(`${API}/engine/reset/${userId}`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`Reset API error: ${res.status}`);
      }

      setQuestion(null);
      setResult(null);
      setEmail("");
      setShowDetails(false);
      setTestStartedAt(null);
      setTestFinishedAt(null);
      setScreen("landing");
    } catch (error) {
      console.error("RESET ERROR:", error);
      alert("Nem sikerült újraindítani a tesztet.");
    } finally {
      setLoading(false);
    }
  }

  function exitTest() {
    setScreen("landing");
    setQuestion(null);
    setResult(null);
    setShowDetails(false);
  }

  async function sendResultEmail() {
    try {
      if (!email) {
        alert("Kérlek, add meg az email címed.");
        return;
      }

      setLoading(true);

      const res = await fetch(`${API}/engine/send-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          result,
        }),
      });

      if (!res.ok) {
        throw new Error(`Email API error: ${res.status}`);
      }

      alert("Az eredményt sikeresen elküldtük emailben.");
    } catch (error) {
      console.error("SEND RESULT EMAIL ERROR:", error);
      alert("Nem sikerült elküldeni az emailt.");
    } finally {
      setLoading(false);
    }
  }

  function simulateResult() {
    setResult({
      answeredCount: 20,
      correctCount: 14,
      thetaHistory: [
        { questionNumber: 1, thetaAfter: -0.2, isCorrect: true },
        { questionNumber: 2, thetaAfter: 0.05, isCorrect: true },
        { questionNumber: 3, thetaAfter: -0.1, isCorrect: false },
        { questionNumber: 4, thetaAfter: 0.2, isCorrect: true },
        { questionNumber: 5, thetaAfter: 0.42, isCorrect: true },
      ],
      user: {
        cefr: "B1",
        theta: 0.42,
        sem: 0.28,
        ci95: [-0.13, 0.97],
      },
    });

    setTestStartedAt(Date.now() - 9 * 60 * 1000);
    setTestFinishedAt(Date.now());
    setScreen("result");
  }

  const confidence =
    typeof result?.user?.sem === "number"
      ? Math.max(0, Math.min(100, Math.round((1 - result.user.sem) * 100)))
      : null;

  const durationMinutes =
    testStartedAt && testFinishedAt
      ? Math.max(1, Math.round((testFinishedAt - testStartedAt) / 60000))
      : null;

  const thetaChartData = result?.thetaHistory?.length
    ? result.thetaHistory
    : [
        { questionNumber: 1, thetaAfter: -0.4, isCorrect: true },
        { questionNumber: 2, thetaAfter: -0.1, isCorrect: true },
        { questionNumber: 3, thetaAfter: -0.25, isCorrect: false },
        { questionNumber: 4, thetaAfter: 0.15, isCorrect: true },
        { questionNumber: 5, thetaAfter: 0.42, isCorrect: true },
      ];

  const thetaValues = thetaChartData.map((p) => Number(p.thetaAfter));
  const rawMinTheta = Math.min(...thetaValues);
  const rawMaxTheta = Math.max(...thetaValues);
  const padding = 0.2;
  const minTheta = Math.floor((rawMinTheta - padding) * 10) / 10;
  const maxTheta = Math.ceil((rawMaxTheta + padding) * 10) / 10;
  const thetaRange = Math.max(0.5, maxTheta - minTheta);

  const thetaPoints = thetaChartData.map((point, index) => {
    const x =
      thetaChartData.length <= 1
        ? 40
        : 40 + (index / (thetaChartData.length - 1)) * 420;

    const y =
      210 -
      ((Number(point.thetaAfter) - minTheta) / thetaRange) * 160;

    return {
      ...point,
      x,
      y,
    };
  });

  const thetaLinePoints = thetaPoints.map((p) => `${p.x},${p.y}`).join(" ");

  const levelDescriptions = {
    A1: {
      title: "Kezdő szint",
      text:
        "Az A1 szintű nyelvhasználó egyszerű szavakat és alapvető kifejezéseket ért meg. Rövid, hétköznapi helyzetekben tud kommunikálni, például bemutatkozni vagy egyszerű kérdéseket megválaszolni.",
    },
    A2: {
      title: "Alapfok",
      text:
        "Az A2 szintű nyelvhasználó már képes egyszerű beszélgetésekre ismerős témákban. Megérti a gyakran használt kifejezéseket és alapvető információkat.",
    },
    B1: {
      title: "Középszint",
      text:
        "A B1 szintű nyelvhasználó önállóan boldogul sok hétköznapi helyzetben. Megérti a fontosabb információkat, képes véleményt megfogalmazni és egyszerűbb összefüggő szövegeket alkotni.",
    },
    B2: {
      title: "Magabiztos középszint",
      text:
        "A B2 szintű nyelvhasználó összetettebb szövegeket is megért, és folyékonyabban kommunikál. Képes részletesen beszélni különböző témákról és érvelni a véleménye mellett.",
    },
    C1: {
      title: "Haladó szint",
      text:
        "A C1 szintű nyelvhasználó magas szinten használja az angolt. Összetett szövegeket is könnyedén értelmez, és rugalmasan, választékosan kommunikál szakmai vagy akadémiai helyzetekben is.",
    },
  };

  const currentCefr = result?.user?.cefr || "A2";
  const currentLevel = levelDescriptions[currentCefr] || levelDescriptions.A2;

  return (
    <div className="app-shell">
      {screen === "landing" && (
        <main className="landing-card">
          <div className="badge">BOOKR adaptív szintfelmérő</div>

          <h1>Mérd fel az angol szinted néhány perc alatt</h1>

          <p>
            Ez az adaptív szintfelmérő a válaszaid alapján becsli meg az angol
            nyelvi szintedet. A teszt a teljesítményedhez igazítja a kérdések
            nehézségét, így rövidebb idő alatt ad használható eredményt.
          </p>

          <div className="feature-grid">
            <div>
              <strong>Adaptív</strong>
              <span>A kérdések alkalmazkodnak a szintedhez.</span>
            </div>

            <div>
              <strong>Gyors</strong>
              <span>Általában 10–15 perc alatt kitölthető.</span>
            </div>

            <div>
              <strong>CEFR alapú</strong>
              <span>Az eredmények nemzetközi nyelvi szintekhez igazodnak.</span>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={startTest}
            disabled={loading}
          >
            {loading ? "Indítás..." : "Teszt indítása"}
          </button>
        </main>
      )}

      {screen === "test" && (
        <main className="test-card">
          <div className="test-header">
            <div>
              <div className="badge">Adaptív teszt</div>
              <h2>Válaszd ki a legjobb választ</h2>
            </div>

            <div className="header-actions">
              <button
                className="ghost-button"
                onClick={exitTest}
                disabled={loading}
              >
                Kilépés
              </button>

              <button
                className="ghost-button"
                onClick={simulateResult}
                disabled={loading}
              >
                Eredmény megjelenítése
              </button>
            </div>
          </div>

          {loading && <p className="muted">Betöltés...</p>}

          {!loading && question && (
            <>
              <div className="question-box">
                <p>{question.text}</p>
              </div>

              <div className="options">
                {question.options?.map((option) => (
                  <button
                    key={option.id}
                    className="option-button"
                    onClick={() => answerQuestion(option.id)}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            </>
          )}

          {!loading && !question && (
            <p className="muted">Nincs elérhető kérdés.</p>
          )}
        </main>
      )}

      {screen === "result" && (
        <main className="result-card">
          <div className="badge">Teszt befejezve</div>

          <h1>Az eredményed</h1>

          <div className="score-card">
            <span>Becsült nyelvi szint</span>
            <strong>{currentCefr}</strong>
          </div>

          <p>A válaszaid alapján ez a becsült angol nyelvi szinted.</p>

          <button
            className="details-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span>
              {showDetails ? "Kevesebb információ" : "Bővebb információ"}
            </span>
            <span>{showDetails ? "↑" : "↓"}</span>
          </button>

          {showDetails && (
            <div className="details-panel">
              <h2>Teljes kiértékelés</h2>

              <div className="level-explanation-box">
                <h3>
                  {currentCefr} — {currentLevel.title}
                </h3>

                <p>{currentLevel.text}</p>
              </div>

              <div className="metrics-grid">
                <div className="metric-card">
                  <span>Kitöltött kérdések</span>
                  <strong>{result?.answeredCount || "N/A"}</strong>
                </div>

                <div className="metric-card">
                  <span>Helyes válaszok</span>
                  <strong>
                    {typeof result?.correctCount === "number"
                      ? `${result.correctCount}/${result.answeredCount}`
                      : "N/A"}
                  </strong>
                </div>

                <div className="metric-card">
                  <span>Theta érték</span>
                  <strong>
                    {typeof result?.user?.theta === "number"
                      ? result.user.theta.toFixed(2)
                      : "N/A"}
                  </strong>
                </div>

                <div className="metric-card">
                  <span>Konfidencia</span>
                  <strong>
                    {confidence !== null ? `${confidence}%` : "N/A"}
                  </strong>
                </div>

                <div className="metric-card">
                  <span>Kitöltési idő</span>
                  <strong>
                    {durationMinutes !== null ? `${durationMinutes} perc` : "N/A"}
                  </strong>
                </div>
              </div>

              <div className="level-strip-card">
                <div className="theta-chart-header">
                  <span>Jelenlegi becsült szint</span>
                </div>

                <div className="level-strip-labels">
                  <span>A1</span>
                  <span>A2</span>
                  <span>B1</span>
                  <span>B2</span>
                  <span>C1</span>
                </div>

                <div className="level-strip">
                  <div
                    className="level-marker"
                    style={{
                      left: `${Math.min(
                        100,
                        Math.max(
                          0,
                          (((result?.user?.theta ?? 0) + 3) / 6) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="theta-chart">
                <div className="theta-chart-header">
                  <span>Theta változás a teszt során</span>
                </div>

                <svg className="theta-svg" viewBox="0 0 500 250">
                  {Array.from({ length: 6 }, (_, i) => {
                    const value = minTheta + (thetaRange / 5) * i;
                    const y =
                      210 -
                      ((value - minTheta) / thetaRange) * 160;

                    return (
                      <g key={value.toFixed(1)}>
                        <text
                          x="16"
                          y={y + 4}
                          style={{
                            fontFamily: "Nunito, Inter, sans-serif",
                            fontSize: 12,
                            fontWeight: 800,
                            fill: "#667085",
                          }}
                        >
                          {value.toFixed(1)}
                        </text>

                        <line
                          x1="40"
                          y1={y}
                          x2="460"
                          y2={y}
                          className="theta-grid-line"
                        />
                      </g>
                    );
                  })}

                  {thetaPoints.map((point, index) => (
                    <text
                      key={point.questionNumber}
                      x={point.x}
                      y="232"
                      textAnchor="middle"
                      style={{
                        fontFamily: "Nunito, Inter, sans-serif",
                        fontSize: 11,
                        fontWeight: 800,
                        fill: "#667085",
                      }}
                    >
                      {index + 1}
                    </text>
                  ))}

                  <line
                    x1="40"
                    y1="210"
                    x2="460"
                    y2="210"
                    stroke="#d8d1ff"
                    strokeWidth="3"
                  />

                  <line
                    x1="40"
                    y1="50"
                    x2="40"
                    y2="210"
                    stroke="#d8d1ff"
                    strokeWidth="3"
                  />

                  <polyline
                    points={thetaLinePoints}
                    fill="none"
                    stroke="#6f3cff"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {thetaPoints.map((point) => (
                    <circle
                      key={point.questionNumber}
                      cx={point.x}
                      cy={point.y}
                      r="8"
                      fill={point.isCorrect ? "#00d68f" : "#ff3ea5"}
                      stroke="white"
                      strokeWidth="4"
                    />
                  ))}

                  <text
                    x="250"
                    y="248"
                    textAnchor="middle"
                    style={{
                      fontFamily: "Nunito, Inter, sans-serif",
                      fontSize: 13,
                      fontWeight: 900,
                      fill: "#18213f",
                    }}
                  >
                    Kérdés száma
                  </text>

                  <text
                    x="-130"
                    y="-4"
                    transform="rotate(-90)"
                    textAnchor="middle"
                    style={{
                      fontFamily: "Nunito, Inter, sans-serif",
                      fontSize: 13,
                      fontWeight: 900,
                      fill: "#18213f",
                    }}
                  >
                    Theta érték
                  </text>
                </svg>

                <p className="muted">
                  A grafikon azt mutatja, hogyan változott a becsült theta érték
                  minden válaszadás után.
                </p>
              </div>

              <div className="evaluation-box">
                <h3>Értelmezés</h3>

                <p>
                  A teszt adaptív módon választotta ki a kérdéseket a korábbi
                  válaszok alapján. Az eredmény egy becslés, amely a válaszok
                  helyessége, a kérdések nehézsége és a modell bizonytalansága
                  alapján állt elő.
                </p>

                <p>
                  A konfidencia érték azt jelzi, mennyire stabil a becslés. A
                  pilot verzióban ez még tájékoztató jellegű, később részletesebb
                  készségbontás és fejlesztési javaslat is megjeleníthető.
                </p>
              </div>
            </div>
          )}

          <div className="email-box">
            <input
              type="email"
              placeholder="Add meg az email címed"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button
              className="primary-button"
              onClick={sendResultEmail}
              disabled={loading}
            >
              {loading ? "Küldés..." : "Eredmény elküldése"}
            </button>
          </div>

          <button className="ghost-button" onClick={resetUser}>
            Újrakezdés
          </button>
        </main>
      )}
    </div>
  );
}