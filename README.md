# Express Boilerplate

A clean, scalable Express.js project structure.

## Getting Started

```bash
npm install
cp .env.example .env
npm run dev
```

## Project Structure

```
src/
├── config/        # DB, env, logger setup
├── controllers/   # Route handlers (HTTP layer)
├── middlewares/   # Auth, validation, error handling
├── models/        # Database models
├── routes/        # Route definitions
├── services/      # Business logic
└── utils/         # Helpers and utilities
tests/
├── unit/
└── integration/
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start with nodemon |
| `npm start` | Start in production |
| `npm test` | Run tests |
