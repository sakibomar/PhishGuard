# PhishGuard AI — Explainable ML Phishing URL Detector

## Project Structure
```
├── App.jsx / main.jsx / index.html   React app entry points
├── *.jsx                              Page components (Home, Batch, …)
├── package.json / vite.config.js      Frontend build config
└── backend/
    ├── api.py                         FastAPI server (port 8000)
    ├── requirements.txt               Python dependencies
    ├── src/
    │   ├── features.py                URL feature extractor (14 features)
    │   ├── train.py                   Dataset generation + model training
    │   └── evaluate.py                Metrics + SHAP analysis
    ├── models/                        Saved .pkl files (created by train.py)
    └── data/                          CSV splits (created by train.py)
```

## Quick Start

### 1 — Python backend

```bash
cd backend
pip install -r requirements.txt

# Train models (~2 min)
python -m src.train

# Optional: evaluate + SHAP plots
python -m src.evaluate

# Start API server
python -m uvicorn api:app --reload --port 8000
```

### 2 — React frontend (new terminal)

```bash
cd ..          # project root
npm install
npm run dev    # → http://localhost:5173
```

The Vite dev server proxies `/api/*` → `http://localhost:8000` automatically.



| Method | Path | Body |
|--------|------|------|
| `GET`  | `/health` | — |
| `POST` | `/predict` | `{ "url": "...", "model": "rf" }` |
| `POST` | `/predict/batch` | `{ "urls": [...], "model": "rf" }` |

Models: `dummy` · `
