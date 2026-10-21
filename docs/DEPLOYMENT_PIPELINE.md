# 🚀 CI/CD Deployment Architecture & Pipeline Documentation

This document explains the end-to-end continuous integration and deployment (CI/CD) workflow implemented in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) for the **Fee Management System**.

---

## 1. 📌 Architectural Overview

Instead of building the entire application directly on the AWS Lightsail production server, the system uses an **Offloaded Build Architecture**:

1. **Build in Cloud (GitHub Actions Runner)**:
   - Frontend compilation (Vite + React + TailwindCSS + LightningCSS) is resource-heavy (CPU and RAM intensive).
   - Running the build on GitHub's free cloud runner keeps the Lightsail instance lean and prevents server freezes or memory-exhaustion (OOM) crashes.
2. **Transfer Pre-built Artifacts**:
   - Only the compiled, minified static files (`frontend/dist/`) are securely transferred to the Lightsail server via `rsync` over SSH.
3. **Targeted Backend & Runtime Update (AWS Lightsail)**:
   - The Lightsail server only pulls the latest backend code from Git.
   - Checks whether dependencies changed using SHA256 lockfile hashing (skips redundant `npm ci` if dependencies haven't changed).
   - Moves static files to the web server directory (`/var/www/pydahfee`).
   - Gracefully reloads the backend Node.js API with **PM2**.

```
 +----------------------------------------------------------------------------------+
 |                           GitHub Actions (ubuntu-latest)                         |
 |                                                                                  |
 |   [Git Push to 'main']                                                           |
 |            |                                                                     |
 |            v                                                                     |
 |   1. Checkout Repo  -->  2. Setup Node 22  -->  3. npm ci & npm run build (Vite)  |
 |                                                                |                 |
 |                                                      Creates frontend/dist       |
 +----------------------------------------------------------------|-----------------+
                                                                  |
                                                                  | 4. rsync via SSH
                                                                  v
 +----------------------------------------------------------------------------------+
 |                        AWS Lightsail Production Instance                         |
 |                                                                                  |
 |   Temporary Staging: /tmp/frontend-dist/                                         |
 |                                                                                  |
 |   Remote SSH Script Execution:                                                   |
 |   ----------------------------------------------------------------------------   |
 |   5. cd /home/ec2-user/PydahFeeManagement                                       |
 |      git pull origin main                                                        |
 |                                                                                  |
 |   6. Backend Dependency Check (SHA256 hash comparison):                          |
 |      If changed -> npm ci --omit=dev; Update .npm-ci-lockhash                    |
 |      If unchanged -> Skip npm ci (instant deployment!)                           |
 |                                                                                  |
 |   7. Deploy Frontend Web Root:                                                   |
 |      sudo rsync -av --delete /tmp/frontend-dist/ -> /var/www/pydahfee/           |
 |                                                                                  |
 |   8. Restart Backend via PM2:                                                    |
 |      pm2 restart backend && pm2 save                                             |
 |                                                                                  |
 |   9. Cleanup temporary files (/tmp/frontend-dist)                                |
 +----------------------------------------------------------------------------------+
                                         |
                                         v
 +----------------------------------------------------------------------------------+
 |                          Production Traffic Routing (Nginx)                      |
 |                                                                                  |
 |   Client Browser                                                                 |
 |        |                                                                         |
 |        +---> Static Assets (/)  --------> Serves from /var/www/pydahfee/         |
 |        |                                                                         |
 |        +---> API Requests (/api/) ------> Proxied to PM2 Node.js (Port 5000)     |
 +----------------------------------------------------------------------------------+
```

---

## 2. ⚙️ Step-by-Step Breakdown of `.github/workflows/deploy.yml`

### Trigger & Concurrency Control
```yaml
on:
  push:
    branches:
      - main

concurrency:
  group: production
  cancel-in-progress: true
```
- **Trigger**: Runs automatically whenever changes are pushed or merged into the `main` branch.
- **Concurrency**: Grouped under `production` with `cancel-in-progress: true`. If multiple developers push simultaneously or commits are made in rapid succession, pending/older builds are cancelled to guarantee only the latest commit deploys.

---

### Step 1: Code Checkout & Node.js Setup (GitHub Runner)
```yaml
- name: Checkout Repository
  uses: actions/checkout@v4

- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
    cache-dependency-path: frontend/package-lock.json
```
- Spins up an Ubuntu runner.
- Clones the repository.
- Sets up **Node.js 22** and caches `npm` packages using `frontend/package-lock.json` hash to speed up future runs.

---

### Step 2: Build Frontend Bundle (GitHub Runner)
```yaml
- name: Install frontend dependencies
  working-directory: frontend
  run: npm ci

- name: Build frontend
  working-directory: frontend
  env:
    VITE_API_URL: /api
    VITE_CRM_FRONTEND_URL: https://crm.pydah.edu.in
    VITE_CRM_BACKEND_URL: https://crm.pydah.edu.in
  run: npm run build
```
- Runs clean install (`npm ci`) for all frontend packages.
- Executes `npm run build` (Vite) with production environment variables:
  - `VITE_API_URL: /api`: Frontend sends API queries to `/api` on the same domain (allowing Nginx reverse proxying).
  - `VITE_CRM_FRONTEND_URL`: Single Sign-On and CRM integration target.
  - `VITE_CRM_BACKEND_URL`: CRM backend validation endpoints.
- Generates optimized static HTML, JavaScript, CSS, and asset bundles inside `frontend/dist/`.

---

### Step 3: Configure SSH Authentication (GitHub Runner)
```yaml
- name: Configure SSH
  run: |
    set -e
    mkdir -p ~/.ssh
    echo "${{ secrets.SSH_KEY }}" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    ssh-keyscan -H "${{ secrets.HOST }}" >> ~/.ssh/known_hosts
```
- Safely extracts the private SSH key from GitHub Repository Secrets (`SSH_KEY`).
- Sets strict file permissions (`chmod 600`) required by OpenSSH.
- Scans and appends the server's public host key to `~/.ssh/known_hosts` to prevent interactive `Are you sure you want to continue connecting (yes/no)?` security prompts.

---

### Step 4: Transfer Frontend Artifacts to Server
```yaml
- name: Upload frontend build
  run: |
    rsync -avz \
      -e "ssh -i ~/.ssh/deploy_key" \
      frontend/dist/ \
      "${{ secrets.USERNAME }}@${{ secrets.HOST }}:/tmp/frontend-dist/"
```
- Uses `rsync` with compression (`-z`) and archive mode (`-a`) to transfer only the compiled `frontend/dist/` into a temporary directory `/tmp/frontend-dist/` on the remote Lightsail instance.

---

### Step 5: Execute Remote Deployment Script (AWS Lightsail)
The runner establishes an SSH session into the Lightsail instance and executes the deployment script:

#### A. Pull Latest Code for Backend
```bash
cd "/home/ec2-user/PydahFeeManagement"
git fetch origin main
git checkout main
# Discard local modifications to logs if any exist
git checkout -- backend/logs/ 2>/dev/null || true
git pull origin main
```
- Changes directory to the project repository path on the server (`/home/ec2-user/PydahFeeManagement`).
- Discards any changes created by runtime logs in `backend/logs/`.
- Pulls the newest backend code.

#### B. Smart Backend Dependency Installation (Hashing)
```bash
LOCK_HASH_FILE="${PROJECT_DIR}/backend/.npm-ci-lockhash"
CURRENT_HASH="$(sha256sum package-lock.json package.json 2>/dev/null | sha256sum | awk '{print $1}')"
PREV_HASH="$(cat "${LOCK_HASH_FILE}" 2>/dev/null || true)"

if [ ! -d node_modules ] || [ "${CURRENT_HASH}" != "${PREV_HASH}" ]; then
  echo "==> Installing backend dependencies..."
  npm ci --omit=dev
  echo "${CURRENT_HASH}" > "${LOCK_HASH_FILE}"
else
  echo "==> Backend dependencies unchanged, skipping npm ci"
fi
```
- **Performance Optimization**: Calculates a SHA-256 hash of `backend/package.json` and `backend/package-lock.json`.
- Compares it with the stored hash in `.npm-ci-lockhash`.
- If packages have **not** changed, it skips `npm ci`, saving 1–2 minutes per deployment.
- If dependencies **have** changed, it runs `npm ci --omit=dev` (production dependencies only).

#### C. Deploy Frontend to Production Web Root
```bash
sudo mkdir -p "/var/www/pydahfee"
sudo rsync -av --delete /tmp/frontend-dist/ "/var/www/pydahfee/"
```
- Copies the pre-compiled files from `/tmp/frontend-dist/` to the actual Nginx web root directory `/var/www/pydahfee/`.
- `--delete` removes old, unused hashed assets from prior versions, keeping the disk tidy.

#### D. Restart Backend Process (PM2)
```bash
pm2 restart backend
pm2 save
```
- Seamlessly restarts the backend Node.js process registered in PM2 under the name `backend`.
- Saves the active PM2 process configuration (`pm2 save`) so the backend automatically starts if the server reboots.

#### E. Server Cleanup
```bash
rm -rf /tmp/frontend-dist
```
- Cleans up the temporary staging directory on the Lightsail server.

---

### Step 6: Security Teardown (GitHub Runner)
```yaml
- name: Cleanup SSH key
  if: always()
  run: rm -f ~/.ssh/deploy_key
```
- Ensures the temporary SSH private key on the GitHub Actions runner is completely deleted, even if the workflow succeeded, failed, or was cancelled.

---

## 3. 🔐 Required GitHub Secrets

To make this workflow run, the following repository secrets are configured in **GitHub Repository Settings -> Secrets and variables -> Actions**:

| Secret Name | Description | Example / Format |
|---|---|---|
| `HOST` | Public IP or DNS of the AWS Lightsail instance | `13.xxx.xxx.xxx` or `fee.pydah.edu.in` |
| `USERNAME` | SSH user for the Lightsail instance | `ec2-user` (Amazon Linux) or `ubuntu` |
| `SSH_KEY` | Private SSH Key (`PEM` format) authorized on server (`~/.ssh/authorized_keys`) | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |

---

## 4. 🌐 Server Configuration Mapping

On the AWS Lightsail server, the application is wired as follows:

| Component | Path / Port | Role |
|---|---|---|
| **Repository Path** | `/home/ec2-user/PydahFeeManagement` | Git repo checkout, backend source code, migrations |
| **Frontend Web Root** | `/var/www/pydahfee/` | Nginx serves static assets directly from here |
| **Backend API** | Node.js / Express on `http://127.0.0.1:5000` | Managed by PM2 as `backend` |
| **Reverse Proxy** | Nginx | Routes `/` -> `/var/www/pydahfee` & `/api` -> `localhost:5000` |

### Hardened Production Nginx Configuration
```nginx
server {
    server_name fee.pydah.edu.in;

    # 1. Fix: Server information header exposed
    # Suppresses Nginx version number from 'Server' response header
    server_tokens off;

    # 2. Fix: X-Frame-Options (Clickjacking protection)
    add_header X-Frame-Options "SAMEORIGIN" always;

    # 3. Fix: X-Content-Type-Options (MIME confusion attack protection)
    add_header X-Content-Type-Options "nosniff" always;

    # 4. Fix: Content Security Policy (CSP - XSS & Clickjacking protection)
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://crm.pydah.edu.in https://checkout.razorpay.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://static.wixstatic.com https://api.qrserver.com https://*.amazonaws.com https://*.s3.amazonaws.com https://crm.pydah.edu.in; connect-src 'self' https://crm.pydah.edu.in https://api.razorpay.com https://*.amazonaws.com https://*.s3.amazonaws.com ws: wss:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com blob: data:; worker-src 'self' blob: https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'self';" always;

    # 5. Fix: HTTP Strict Transport Security (HSTS - Prevents SSL-stripping & MITM attacks)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Additional Defense-in-Depth Headers
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Frontend Static Files
    root /var/www/pydahfee;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Ensure backend version / technology fingerprinting is stripped
        proxy_hide_header X-Powered-By;
    }
}
```

---

## 5. 🛠️ Useful Server Commands for Troubleshooting

If you need to verify or troubleshoot the deployment directly on the Lightsail instance via SSH:

```bash
# Check PM2 backend status
pm2 status

# View live backend logs
pm2 logs backend

# Restart backend manually
pm2 restart backend

# Verify frontend files in web root
ls -la /var/www/pydahfee

# Test Nginx configuration and reload
sudo nginx -t
sudo systemctl reload nginx
```
