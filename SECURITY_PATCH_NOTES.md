# Security Patch Notes (Git Hardening + Secrets)

This pack includes ready-to-use files and code snippets to harden your repo:

## Files

- `.env.example` — template for environment variables (copy to `.env`, keep `.env` out of git)
- `.gitignore` — blocks secrets, logs, builds
- `gitleaks.toml` — default secret scanning rules
- `install_security_tools.sh` — one-shot script to set up Husky + pre-commit gitleaks
- `public.config.js` — client-side config for `API_BASE` (no secrets)
- `server.secure.js` — example Express server with dotenv, helmet, rate limit, bcrypt, cookie JWT

## 1) Move secrets out of code

1. Copy `.env.example` to `.env` and fill values.
2. Update your existing `server.js` to read from `process.env` (see `server.secure.js` for reference).

## 2) Ignore secrets and noise

- Place `.gitignore` at repo root.
- Ensure `.env` is never committed.

## 3) Frontend base URL

- Serve `public.config.js` as a static file and read `window.APP_CONFIG.API_BASE` in your JS instead of hard-coding localhost.

## 4) Secret-scanning on every commit

- Run:
  ```bash
  bash ./install_security_tools.sh
  ```
- Try committing; gitleaks will block any staged secrets.

## 5) If secrets were ever committed

- Rotate ALL exposed keys (DB, JWT, API tokens).
- Clean history with BFG or git filter-repo, then force-push.

## 6) Passwords & tokens

- Hash passwords with `bcrypt` (see `server.secure.js` register/login).
- Store JWT in HttpOnly cookies, short expiry + refresh strategy.

## 7) HTTP security

- Use `helmet`, `cors` with allowlist from `ALLOWED_ORIGINS`, `express-rate-limit`.
- Enforce HTTPS and HSTS at reverse proxy (e.g., Nginx).

## 8) Network/IP hygiene

- Do not hard-code private IPs in code; use hostnames and protect DB behind VPN/security groups.
