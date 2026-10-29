# 🚀 Complete Oracle Cloud Infrastructure (OCI) Migration & Deployment Guide
> **Project:** Txtro (Real-Time Chat & Socket Application)  
> **Target:** 24/7/365 Always Free Cloud VPS Deployment  
> **Stack:** Ubuntu 24.04 LTS, Node.js 24 LTS, PM2, Nginx, Let's Encrypt SSL, MongoDB Atlas, Vercel  

---

## 📑 Table of Contents
1. [Why We Migrated from Render](#1-why-we-migrated-from-render)
2. [Oracle Cloud Account Creation & Always Free Tier](#2-oracle-cloud-account-creation--always-free-tier)
3. [Virtual Cloud Network (VCN) & Firewall Configuration](#3-virtual-cloud-network-vcn--firewall-configuration)
4. [Compute Instance (VPS) Provisioning](#4-compute-instance-vps-provisioning)
5. [Connecting to the Server via SSH (Windows)](#5-connecting-to-the-server-via-ssh-windows)
6. [Server Setup: Node.js 24 LTS & PM2 Installation](#6-server-setup-nodejs-24-lts--pm2-installation)
7. [Deploying Code & Process Daemonization](#7-deploying-code--process-daemonization)
8. [The Ubuntu Firewall Trap (iptables Fix)](#8-the-ubuntu-firewall-trap-iptables-fix)
9. [Domain, Nginx Reverse Proxy & Free SSL/HTTPS](#9-domain-nginx-reverse-proxy--free-sslhttps)
10. [Frontend Configuration & Vercel Deployment](#10-frontend-configuration--vercel-deployment)
11. [Performance, Load Testing & Security Guidelines](#11-performance-load-testing--security-guidelines)
12. [Day-2 Operations & Maintenance Cheat Sheet](#12-day-2-operations--maintenance-cheat-sheet)

---

## 1. Why We Migrated from Render

### The Problem with Render Free Tier
1. **The 750 Hours/Month Shared Pool:** Render allocates 750 free instance hours per calendar month for your entire account. If you run a backend service and another small service, or if month-end calculations roll over, your app gets **suspended** until the 1st of the next month.
2. **Cold Starts (50-Second Spin Downs):** Free web services on Render shut down ("sleep") after 15 minutes of inactivity. When a real user visits the site, they are forced to wait 50+ seconds for the server to boot.
3. **WebSocket Instability:** Socket.IO connections require a persistent, uninterrupted TCP connection. Render free containers periodically drop idle connections or reset them during auto-sleep.

### The Permanent Solution: Oracle Cloud Always Free
- **$0 Cost Forever:** Oracle Cloud Infrastructure (OCI) includes an **Always Free** tier that does not expire after a trial.
- **24/7/365 Non-Stop Running:** No hourly caps, no suspensions, no sleep cycles, and **zero cold starts**.
- **Full Root Control:** You have a dedicated Linux server (Ubuntu) with a static public IPv4 address, customizable Nginx reverse proxy, and free SSL certificates.

---

## 2. Oracle Cloud Account Creation & Always Free Tier

### Step 2.1: Sign-Up & Verification
1. Visit [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and sign up.
2. Provide your email, country, and contact details.
3. **Credit/Debit Card Verification:** Oracle requires a valid payment card to verify your identity and prevent spam. They place a temporary hold of roughly $1 (or ₹80-90 in India), which is reversed immediately. You will **never** be charged unless you manually upgrade to a paid account.

### Step 2.2: Choosing Your "Home Region" (Crucial Decision)
> **Warning:** You cannot change your Home Region after registration.

- Choose the region closest to you and your users (e.g., `India South (Hyderabad)` or `India West (Mumbai)`).
- All Always-Free resources (compute shapes, storage, networking) are allocated inside your Home Region.

### Step 2.3: Understanding Always-Free Shapes
Oracle offers two distinct Always-Free compute architectures:

1. **Ampere A1 Flex (ARM - 4 OCPUs, 24 GB RAM):**
   - High performance, but frequently shows: `Out of capacity for shape VM.Standard.A1.Flex in availability domain AD-1` because thousands of developers queue for it.
2. **AMD E2.1.Micro (x86_64 - 1 OCPU, 1 GB RAM):**
   - **Always in stock and immediately available.**
   - Uses standard Intel/AMD architecture (compatible with 100% of Node.js modules without ARM compilation issues).
   - Easily handles 500+ concurrent Socket.IO connections and thousands of daily web requests.
   - **We chose this shape (`VM.Standard.E2.1.Micro`).**

---

## 3. Virtual Cloud Network (VCN) & Firewall Configuration

Before creating the server, you need a virtual network with an Internet Gateway so the server can talk to the public internet.

### Step 3.1: Create VCN via the Wizard
*(Avoid creating the network inside the instance creation screen; it locks the public IP toggle).*

1. In the OCI Console, search for **Virtual Cloud Networks**.
2. Click **Start VCN Wizard**.
3. Select **Create VCN with Internet Connectivity** and click **Start VCN Wizard**.
4. Set:
   - **VCN Name:** `Txtro-VCN`
   - **Compartment:** Your root compartment
   - **VCN IPv4 CIDR Block:** `10.0.0.0/16`
   - **Public Subnet IPv4 CIDR Block:** `10.0.0.0/24`
5. Click **Next** → **Create**.

### Step 3.2: Open Ingress Rules (Cloud Firewall)
Oracle Cloud blocks all incoming traffic except SSH (port 22) by default. We must open ports for web traffic.

1. Go to **Networking** → **Virtual Cloud Networks** → Click `Txtro-VCN`.
2. Under **Security Lists**, click **Default Security List for Txtro-VCN**.
3. Under **Ingress Rules**, click **Add Ingress Rules**:
   - **Source Type:** `CIDR`
   - **Source CIDR:** `0.0.0.0/0`
   - **IP Protocol:** `TCP`
   - **Destination Port Range:** `80, 443, 8000`
   - **Description:** `Allow HTTP, HTTPS, and Backend Port 8000`
4. Click **Add Ingress Rules**.

---

## 4. Compute Instance (VPS) Provisioning

1. Go to **Compute** → **Instances** → Click **Create Instance**.
2. Configure:
   - **Name:** `instance-20261026-1605` (or any descriptive name)
   - **Image:** Click *Change image* → Select **Canonical Ubuntu 24.04** (x86_64).
   - **Shape:** Click *Change shape* → Select **Specialty and legacy** → Choose **VM.Standard.E2.1.Micro** (Always Free-eligible).
3. **Networking:**
   - Choose **Select existing virtual cloud network**: Select `Txtro-VCN`.
   - Choose **Select existing subnet**: Select `public subnet-Txtro-VCN`.
   - **Public IPv4 address:** Ensure **Automatically assign public IPv4 address** is checked.
4. **Save SSH Keys:**
   - Select **Generate a key pair for me**.
   - Click **Save private key** (downloads a `.key` file, e.g., `ssh-key-2026-10-26.key`).
   - Store this file safely in your `Downloads` or `.ssh` folder.
5. Click **Create**.
6. Wait 60–90 seconds until the status turns **Running (Green)**.
7. Note down your **Public IP Address** (e.g., `129.225.117.64`).

---

## 5. Connecting to the Server via SSH (Windows)

Open **PowerShell** on your local Windows PC and run:

```powershell
# Format: ssh -i <path-to-key> ubuntu@<public-ip>
ssh -i "$HOME\Downloads\ssh-key-2026-10-26.key" ubuntu@129.225.117.64
```

- When prompted: `Are you sure you want to continue connecting (yes/no/[fingerprint])?`, type `yes` and hit Enter.
- You are now inside your cloud server: `ubuntu@instance-20261026-1605:~$`.

---

## 6. Server Setup: Node.js 24 LTS & PM2 Installation

Run these commands in your SSH terminal:

### Step 6.1: Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
```

### Step 6.2: Install Node.js 24 LTS via NodeSource
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify installation:
```bash
node -v   # Returns v24.x.x
npm -v    # Returns v10.x.x or higher
```

### Step 6.3: Install PM2 Process Manager
PM2 keeps your Node.js application running indefinitely in the background and restarts it automatically if it crashes or the server reboots.

```bash
sudo npm install -g pm2
```

---

## 7. Deploying Code & Process Daemonization

### Step 7.1: Clone Repository
```bash
git clone https://github.com/SidharthSinghShrinet/Txtro.git
cd Txtro/server
npm install
```

### Step 7.2: Create the Production `.env` File
```bash
nano .env
```
Paste your production environment variables:
```env
PORT=8000
NODE_ENV=production
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xle7yjt.mongodb.net/BaatCheet
JWT_SECRET=YourSuperSecretKeyHere
JWT_EXPIRES_IN=24h
MAX_AGE=24
CLIENT_URL=https://txtro.vercel.app,http://localhost:5173
```
*(Press `Ctrl + O`, Enter to save, then `Ctrl + X` to exit)*.

### Step 7.3: Start with PM2 & Enable Auto-Boot on System Restart
```bash
# 1. Start the server
pm2 start server.js --name "txtro-backend"

# 2. Save the current process list
pm2 save

# 3. Generate systemd startup hook
pm2 startup
```
When you run `pm2 startup`, PM2 will output a command starting with `sudo env PATH=...`. Copy and paste that command into your terminal:
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## 8. The Ubuntu Firewall Trap (iptables Fix)

### The Hidden Trap Explained
Even though we opened port 8000 in Oracle Cloud Console (VCN Security List), accessing `http://129.225.117.64:8000` timed out with `ERR_CONNECTION_TIMED_OUT`.

**Why?**
Oracle’s Ubuntu 24.04 image contains a second, internal OS firewall called `iptables`. Rule #8 by default is:
```text
REJECT all -- 0.0.0.0/0 0.0.0.0/0 reject-with icmp-host-prohibited
```
If you append rules with `-A INPUT`, they get placed after Rule #8, so traffic is dropped before ever reaching your rule.

### The Fix
Insert the allow rules at **Line 1 (the very top)** so they are evaluated before any reject rules:

```bash
# 1. Insert rules at position 1
sudo iptables -I INPUT 1 -p tcp --dport 8000 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT

# 2. Persist rules across reboots
sudo netfilter-persistent save

# 3. Verify that rules appear at the top
sudo iptables -L INPUT --line-numbers -n
```

Once executed, `http://129.225.117.64:8000/api-docs/` loads immediately in your browser!

---

## 9. Domain, Nginx Reverse Proxy & Free SSL/HTTPS

### Why Do We Need This? (Mixed Content Security)
Your frontend is deployed on Vercel at `https://txtro.vercel.app`.
Modern browsers enforce strict security: **Any website loaded over `https://` is forbidden from making API requests or WebSocket connections to an unencrypted `http://` IP address.**

Furthermore, Let's Encrypt cannot issue SSL certificates to bare IP addresses—it requires a domain name.

### Step 9.1: Free Domain via `sslip.io` (No Signup Needed)
`sslip.io` is a free DNS service where any hostname formatted with an IP resolves directly to that IP:
- Hostname: `txtro-api.129.225.117.64.sslip.io`
- Automatically points to `129.225.117.64` instantly without signing up anywhere.

### Step 9.2: Install Nginx & Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 9.3: Configure Nginx as a Reverse Proxy with WebSocket Upgrades
Create `/etc/nginx/sites-available/txtro`:
```bash
sudo tee /etc/nginx/sites-available/txtro << 'EOF'
server {
    listen 80;
    server_name txtro-api.129.225.117.64.sslip.io;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;

        # WebSocket support (Required for Socket.IO)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

Enable the configuration:
```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/txtro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 9.4: Obtain Free Let's Encrypt SSL
```bash
sudo certbot --nginx -d txtro-api.129.225.117.64.sslip.io
```
- Enter your email address.
- Agree to Terms of Service (`Y`).
- Choose whether to share email (`Y` or `N`).

Certbot will automatically verify the domain, download the certificates, configure SSL in Nginx, and set up a background cron job for auto-renewal every 90 days.

Your backend is now live with HTTPS:
🔒 **`https://txtro-api.129.225.117.64.sslip.io/api-docs/`**

---

## 10. Frontend Configuration & Vercel Deployment

### Step 10.1: Update Vercel Environment Variables
1. Go to your **[Vercel Dashboard](https://vercel.com/)**.
2. Open your frontend project (**Txtro**).
3. Navigate to **Settings** → **Environment Variables**.
4. Set:
   - **Key:** `VITE_BACKEND_URL`
   - **Value:** `https://txtro-api.129.225.117.64.sslip.io/api/v1`
5. Click **Save**.

### Step 10.2: Redeploy Frontend
1. In Vercel, go to the **Deployments** tab.
2. Click the three dots (`...`) on the latest deployment and select **Redeploy**.
3. Once deployed, open your Vercel URL. All HTTP requests and WebSockets will connect to your Oracle Cloud backend with zero mixed-content errors!

### Step 10.3: Local Development Setting
When developing locally on your PC, update `client/.env`:
```env
# To connect your local frontend to your cloud backend:
VITE_BACKEND_URL=https://txtro-api.129.225.117.64.sslip.io/api/v1

# Or to run the backend locally on port 9000:
# VITE_BACKEND_URL=http://localhost:9000/api/v1
```

---

## 11. Performance, Load Testing & Security Guidelines

### Can You Run Performance Tests (e.g. 50 VU for 1 min)?
- **Oracle Cloud Restriction:** **None.** 50 Virtual Users (generating 50–300 requests/second) is considered standard benchmarking. It will not flag or suspend your account.
- **Resource Usage:**
  - Standard JSON / static routes: Very low CPU (~10-30%), response times < 20ms.
  - Password routes (`/login`, `/register`): Bcrypt is CPU-intensive by design. 50 simultaneous bcrypt comparisons will peg the CPU near 100% temporarily, but the server will not crash.

---

## 12. Day-2 Operations & Maintenance Cheat Sheet

### PM2 Commands (Run inside SSH)
| Action | Command |
| :--- | :--- |
| **Check App Status** | `pm2 status` |
| **View Live Logs** | `pm2 logs txtro-backend` |
| **Live CPU & Memory Dashboard** | `pm2 monit` |
| **Restart Backend** | `pm2 restart txtro-backend` |
| **Stop Backend** | `pm2 stop txtro-backend` |

### System & Nginx Commands (Run inside SSH)
| Action | Command |
| :--- | :--- |
| **Check CPU/RAM System Load** | `htop` |
| **Check Port Listeners** | `sudo ss -tulpn` |
| **Restart Nginx** | `sudo systemctl restart nginx` |
| **Test Nginx Config** | `sudo nginx -t` |
| **Check SSL Auto-Renewal Status** | `sudo systemctl status certbot.timer` |

### How to Update Your Server Code in the Future

#### Option A: Automated CI/CD (Recommended)
You do **not** need to SSH into the server anymore! Every time you commit and push backend code to GitHub:
```bash
git add .
git commit -m "feat: your new feature"
git push origin main
```
The **GitHub Actions pipeline** (`.github/workflows/deploy-backend.yml`) will automatically:
1. Connect to your Oracle VPS via SSH using your GitHub Secrets (`OCI_HOST`, `OCI_USERNAME`, `OCI_SSH_KEY`).
2. Pull the latest commits cleanly.
3. Install new dependencies (`npm install --omit=dev`).
4. Gracefully reload PM2 (`pm2 reload txtro-backend`).

#### Option B: Manual Update (Fallback)
If you ever want to update manually via SSH:
```bash
# 1. SSH into the server
ssh -i "$HOME\Downloads\ssh-key-2026-10-26.key" ubuntu@129.225.117.64

# 2. Pull changes and restart
cd ~/Txtro
git pull origin main
cd server
npm install
pm2 restart txtro-backend
```

🎉 **Your full-stack application is now permanently deployed, fully autonomous, and 100% free!**
