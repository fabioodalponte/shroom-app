# Shroom - App Management

This is a code bundle for Shroom - App Management. The original project is available at https://www.figma.com/design/WG6jT1Dje9cim1JVr0wfFm/Shroom---App-Management.

## Documentation

- Supabase setup: `src/INSTRUCOES-SUPABASE.md`
- Camera + Cloudflare Tunnel setup: `src/SETUP-CAMERA-CLOUDFLARE.md`
- Coolify deploy + domain: `DEPLOY-COOLIFY.md`

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Deploy with Docker

This repository includes:
- `Dockerfile` (multi-stage build)
- `nginx.conf` (SPA fallback for React routes)
- `.dockerignore`
