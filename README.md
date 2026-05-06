# 🛡️ PhishGuard AI

**Explainable ML Phishing URL Detector**

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org/)

---

## 📁 Project Structure

```
├── App.jsx / main.jsx / index.html   →  React app entry points
├── Home.jsx / Batch.jsx / FpLab.jsx  →  Page components
├── ModelExplorer.jsx / EdaDashboard.jsx
├── Adversarial.jsx / TypoSquat.jsx / About.jsx
├── package.json / vite.config.js      →  Frontend build config
├── notebooks/
│   └── PhishGuard_Training_Evaluation.ipynb
└── backend/
    ├── api.py                         →  FastAPI server (port 8000)
    ├── requirements.txt               →  Python dependencies
    ├── src/
    │   ├── features.py                →  URL feature extractor (14 features)
    │   ├── train.py                   →  Dataset generation + model training
    │   └── evaluate.py                →  Metrics + SHAP analysis
    ├── models/                        →  Saved .pkl files (created by train.py)
    ├── data/                          →  CSV splits (created by train.py)
    ├── tests/                         →  Test utilities
    └── check_data.py / diagnose.py    →  Diagnostic scripts
```

---

## 🚀 Quick Start

### 1️⃣ Python Backend

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

---

### 2️⃣ React Frontend

```bash
cd ..          # project root
npm install
npm run dev    # → http://localhost:5173
```

---

> **Note:** The Vite dev server proxies `/api/*` → `http://localhost:8000` automatically.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

