# BOOKR Adaptive Placement Test MVP

Adaptive English placement test MVP with React frontend, Node/Express backend and PostgreSQL database.

## Requirements

- Node.js 20+
- npm
- PostgreSQL

## Setup

Clone the repository:

```bash
git clone <REPO_URL>
cd <REPO_FOLDER>

## Mit tud eddig?

A projekt jelenleg egy működő adaptív nyelvi szintfelmérő MVP, amely CAT (Computer Adaptive Testing) logikát használ. A rendszer valós időben alkalmazkodik a válaszokhoz: difficulty-aware kérdésválasztás, theta-alapú proficiency becslés, skill balancing (grammar / reading / listening), confidence interval és intelligens stop condition is működik. Az item bank jelenleg 405 kérdésből áll, 9 szintre és 3 skillre elosztva, difficulty paraméterekkel kalibrálva.

Frontend oldalon elkészült egy modern, pilot-ready UI: adaptív teszt flow, multimédiás kérdések (audio/image/reading passage), CEFR eredménykijelzés, theta/progress chartok, skill coverage és részletes eredményoldal. A rendszer nem ismétel kérdéseket, maximum 40 kérdésig fut, és stabilitás/confidence alapján automatikusan lezárja a tesztet.

Backend oldalon már rendelkezésre áll részletes audit logging és export layer is: session export JSON formátumban, answer-by-answer theta trajectory, difficulty progression, CEFR evolution, accuracy, SEM és stop reason adatokkal. Ez már alkalmas pilot reportingra, későbbi calibration analysisre és DIMOP-kompatibilis assessment traceabilityre is.
