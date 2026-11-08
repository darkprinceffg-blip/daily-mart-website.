# Daily Mart – Independent Single-Vendor Store
Node.js + Express + built-in SQLite. No third-party platform dependency.

## Run locally
1. Install Node.js 22.13 or newer (no extra build tools needed).
2. `npm install`
3. `cp .env.example .env` and set ADMIN_USER, ADMIN_PASS, SECRET (long random), WHATSAPP (digits only, e.g. 923285283176).
4. `npm start` → store: http://localhost:3000  Admin: http://localhost:3000/admin.html

## Deploy (VPS, e.g. Ubuntu)
1. Upload this folder, run `npm install --omit=dev`, create `.env`.
2. `npm i -g pm2 && NODE_ENV=production pm2 start "npm start" --name dailymart && pm2 save && pm2 startup`
3. Install nginx, proxy your domain to `127.0.0.1:3000`; run `certbot --nginx -d yourdomain.com` for HTTPS (required for secure admin login).
(Render/Railway also work: attach a persistent disk for `data.db` and `uploads/`.)

## Custom domain
Buy a domain, add an **A record** pointing to your server IP (and `www` CNAME to the domain). Wait for DNS, then set up nginx + certbot as above.

## Backups
Copy `data.db` and the `uploads/` folder regularly. They are your whole store.

## Notes
- Only the owner can change data: all write routes require the owner login. There is no customer/seller registration.
- Edit policy texts and contact info in `public/index.html` (PAGES object).
- The sample product is for demo; delete it in Admin.
