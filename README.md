# Resume Builder (standalone)

## Backend
```
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then paste your real GROQ_API_KEY into .env
python run.py          # runs on :5001
```

## Frontend
```
cd frontend
npm install
npm run dev            # runs on :3000
```

Open http://localhost:3000 — boot screen → welcome card → Resume app (Guest Mode tab does the AI generation against your Flask backend).

`resume.py`, `Resume.js`, and `ResumeGuestMode.js` are byte-for-byte your originals — nothing in them was touched.
