# Deploy APEX-MOTOS

## Render backend

Root Directory:

```txt
backend
```

Build Command:

```txt
pip install -r requirements.txt
```

Start Command:

```txt
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Variables:

```env
DATABASE_URL=postgresql://...neon...?sslmode=require
SECRET_KEY=apex_motos_secret
PYTHON_VERSION=3.12.7
```

## Vercel frontend

Root Directory:

```txt
frontend
```

Build Command:

```txt
pnpm run build
```

Install Command:

```txt
corepack enable && pnpm install --no-frozen-lockfile
```

Output Directory: dejar vacio / Next.js default.

Variables:

```env
NEXT_PUBLIC_API_URL=https://apex-motos-api.onrender.com
NODE_VERSION=20
```

Usuario inicial:

```txt
admin
admin123
```
