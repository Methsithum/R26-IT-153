# Smart-Uni-Guide - Project Folder Structure

Last updated: 2026-05-10

## Directory Tree

```
Smart-Uni-Guide/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config/
│   │   │   ├── database.py
│   │   │   └── settings.py
│   │   ├── models/
│   │   │   ├── dam.py
│   │   │   └── focus/                # sub-package for focused models
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   └── focus/                # feature-specific route modules
│   │   ├── schemas/
│   │   │   ├── che.py
│   │   │   └── focus/                # pydantic/validation schemas
│   │   └── services/
│   │       ├── uda.py
│   │       └── focus/                # service implementations
│   ├── datasets/
│   │   ├── example.py
│   │   └── focus/                    # dataset helpers/examples
│   ├── ml_scripts/focus
│   │               └── example.py
│   └── trained-models/focus
│                        └── ru.py
└── frontend/
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── App.css
    │   ├── App.jsx
    │   ├── index.css
    │   └── main.jsx
    ├── eslint.config.js
    ├── index.html
    ├── package.json
    ├── README.md
    └── vite.config.js
```

## Summary

### Backend (`/backend`)
- `app/` - Main application package
  - `config/` - Configuration (database, settings)
  - `models/` - Data and domain models (includes `focus/` subpackage)
  - `routes/` - API endpoints (includes `focus/` feature routes)
  - `schemas/` - Validation/data schemas
  - `services/` - Business logic and service layers
- `datasets/` - Dataset scripts and helpers
- `ml_scripts/` - Machine-learning scripts
- `trained-models/` - Stored trained models

### Frontend (`/frontend`)
- `src/` - React source code
  - `assets/` - Static assets (images, icons)
  - `App.jsx`, `main.jsx` - Entry components
- `public/` - Public/static files served by the dev server
- Config and metadata: `package.json`, `vite.config.js`, `eslint.config.js`

If you want, I can:
- add file-level links to key files,
- expand any `focus/` folders with their contents, or
- generate a visual diagram (SVG) from this tree.

