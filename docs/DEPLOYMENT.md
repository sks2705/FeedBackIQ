# FeedbackIQ Production Cloud Deployment Runbook

This runbook details publishing Docker images from your local machine, provisioning an AWS EC2 virtual machine with an IAM Role and security group, configuring DNS and HTTPS with Caddy, performing database migrations, verifying image security, running backups/restores, and managing cost teardowns.

---

## PART A: Publish Docker Images from Local Machine

### 1. Multi-Architecture Build & Push (`linux/amd64`)
Production cloud VMs (such as AWS EC2 `t3.medium`) run on `linux/amd64` architecture. If you build images on an ARM computer (such as Apple Silicon M1/M2/M3 Mac), you must explicitly target `--platform linux/amd64` using Docker `buildx` so the containers run natively on the server architecture without emulation errors.

#### Step A: Authenticate to Container Registry
- **GitHub Container Registry (GHCR)**:
  ```bash
  echo $GHCR_PAT | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
  ```
- **Docker Hub**:
  ```bash
  docker login -u YOUR_DOCKERHUB_USERNAME
  ```

#### Step B: Set Image Variables & Tagging
Never tag production images using *only* `latest`. Always use explicit version numbers plus git commit SHAs (e.g. `v1.0.0-a1b2c3d`):
```bash
# Windows PowerShell:
$SHORT_SHA = (git rev-parse --short HEAD)
$TAG = "v1.0.0-$SHORT_SHA"
$PREFIX = "ghcr.io/yourusername" # or "yourdockerhubusername"

# Linux / macOS:
SHORT_SHA=$(git rev-parse --short HEAD)
TAG="v1.0.0-${SHORT_SHA}"
PREFIX="ghcr.io/yourusername"
```

#### Step C: Build and Push Cross-Platform Images
```bash
# Create buildx builder instance if not already existing
docker buildx create --name multiarch-builder --use --bootstrap

# Build and Push Web Image
docker buildx build \
  --platform linux/amd64 \
  --target runner \
  -t ${PREFIX}/feedbackiq-backend:${TAG} \
  -t ${PREFIX}/feedbackiq-backend:latest \
  ./backend --push

# Build and Push Migration Image
docker buildx build \
  --platform linux/amd64 \
  --target migrate \
  -t ${PREFIX}/feedbackiq-migrate:${TAG} \
  -t ${PREFIX}/feedbackiq-migrate:latest \
  ./backend --push

# Build and Push AI Service Image
docker buildx build \
  --platform linux/amd64 \
  -t ${PREFIX}/feedbackiq-ai:${TAG} \
  -t ${PREFIX}/feedbackiq-ai:latest \
  ./ai-service --push
```

---

### 2. Secret Audit & Registry Privacy

#### Verify Images Contain Zero Secrets
Run `docker history` locally to audit image build layers:
```bash
docker history ${PREFIX}/feedbackiq-backend:${TAG}
docker history ${PREFIX}/feedbackiq-ai:${TAG}
```
*Success Verification*: No environment secrets, password values, or AWS keys appear in any build layer. Secrets are provided strictly at runtime via `.env`.

#### Private Registry Access for Server
If your registry repository is private:
1. Generate a **Read-Only Personal Access Token (PAT)** (e.g. GitHub PAT with `read:packages` scope).
2. Log in on the server before pulling:
   ```bash
   echo "YOUR_READ_ONLY_PAT" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
   ```

---

## PART B: Server Infrastructure & Runbook

### Step 1: AWS Account Safety
1. **Root MFA**: Enable Multi-Factor Authentication (MFA) on your AWS Root Account via **AWS IAM Console -> Security Credentials -> Multi-factor authentication (MFA)**.
2. **Email Billing Budget Alert**: Navigate to **AWS Billing & Cost Management Console -> Budgets -> Create budget**. Set a zero-cost or $5/month threshold alert sent to your email address. Verify console labels against official AWS documentation: *"Managing your costs with AWS Budgets"*.
3. **Non-Root IAM Admin**: Create an IAM user with `AdministratorAccess` for daily operations; sign out of the root account.

---

### Step 2: Create EC2 IAM Role for S3 Access
1. Open [AWS IAM Console](https://console.aws.amazon.com/iam/) -> **Roles** -> **Create role**.
2. Select **AWS service** -> **EC2**.
3. Attach the `FeedbackIQS3Policy` policy created in `docs/CLOUD_STORAGE.md`.
4. Name the role `FeedbackIQEC2S3Role` and click **Create role**.

> [!NOTE]
> The server `.env` file will contain **NO AWS access keys**. The Web container fetches temporary S3 credentials directly from the EC2 Instance Metadata Service (IMDS).

---

### Step 3: Launch AWS EC2 Instance
1. Open [AWS EC2 Console](https://console.aws.amazon.com/ec2/) -> **Launch Instance**.
2. **AMI**: Ubuntu 24.04 LTS or 22.04 LTS (`64-bit (x86)`).
3. **Instance Type**: `t3.medium` (2 vCPU, 4 GB RAM) as measured in `docs/DOCKER.md`.
4. **Key Pair**: Select or create an SSH Ed25519 / RSA key pair (`feedbackiq-key.pem`).
5. **Storage**: 25 GB or 30 GB GP3 root volume.
6. **Network & Security Group**:
   - **SSH (Port 22)**: Source = **My IP** (Restrict strictly to your current IP).
   - **HTTP (Port 80)**: Source = **Anywhere (`0.0.0.0/0`)**.
   - **HTTPS (Port 443)**: Source = **Anywhere (`0.0.0.0/0`)**.
7. **Advanced Details**:
   - **IAM Instance Profile**: Attach `FeedbackIQEC2S3Role`.
   - **Metadata version**: Select **IMDSv2 (Required)**.
   - **Metadata response hop limit**: Set to **`2`**.
     *Why Hop Limit 2 is Required*: Docker containers run inside a separate container bridge network namespace. When a containerized process makes an HTTP request to the link-local metadata IP `http://169.254.169.254`, the IP hop count (TTL) is decremented by 1 when crossing the veth bridge. Setting the hop limit to `2` allows the containerized AWS SDK to read the role credentials securely.
8. **Elastic IP**: In EC2 Console -> **Elastic IPs**, allocate an Elastic IP and associate it with your EC2 instance so the public IP remains static across restarts.

---

### Step 4: Domain Name & DNS Setup
1. Log in to your domain registrar (e.g. Namecheap, Cloudflare, Route 53, or dynamic DNS provider).
2. Create an **A Record**:
   - **Name**: `feedbackiq` (or `@` for root domain)
   - **Value**: Public IP address of your EC2 instance
   - **TTL**: 300 seconds
3. Verify DNS resolution from your local machine:
   ```powershell
   # Windows PowerShell:
   Resolve-DnsName feedbackiq.yourdomain.com

   # Linux / macOS:
   dig +short feedbackiq.yourdomain.com
   # or
   nslookup feedbackiq.yourdomain.com
   ```
   *Why Domain & HTTPS is Required*: Browsers reject `http://` cookies marked with `HttpOnly; Secure` and `SameSite=Lax`. HTTPS via a valid domain is mandatory for secure authentication session cookies.

---

### Step 5: Basic Server Hardening

Connect to your EC2 instance via SSH:
```bash
ssh -i feedbackiq-key.pem ubuntu@YOUR_ELASTIC_IP
```

#### A. Create Non-Root Deploy User
```bash
sudo adduser deploy
sudo usermod -aG sudo deploy
sudo rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy/
```

#### B. Disable Password Auth & Root Login
Edit SSH configuration:
```bash
sudo nano /etc/ssh/sshd_config.d/50-cloud-init.conf
```
Ensure the following settings:
```ini
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```
Restart SSH service:
```bash
sudo systemctl restart ssh
```

#### C. Enable Automatic Security Updates & Create 2GB Swap File
```bash
# Enable unattended security updates
sudo apt-get update && sudo apt-get install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades

# Create 2GB Swap File
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> [!IMPORTANT]
> **Firewall Warning**: Docker container port bindings bypass `ufw` via direct `iptables` rules. Therefore, your **AWS Security Group is your primary external firewall**. Since only `caddy` publishes ports (`80` and `443`), PostgreSQL (`5432`) and AI Service (`8000`) are isolated on the internal network and completely unreachable from the internet.

---

### Step 6: Install Docker Engine & Compose Plugin

Install Docker from the official Docker apt repository (refer to official documentation: *"Install Docker Engine on Ubuntu"*):

```bash
# 1. Add Docker's official GPG key:
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 2. Add the repository to Apt sources:
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 3. Install Docker packages:
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 4. Add deploy user to docker group:
sudo usermod -aG docker deploy
```
Log out and log back in as `deploy`:
```bash
exit
ssh -i feedbackiq-key.pem deploy@YOUR_ELASTIC_IP

# Verify Docker installation
docker run --rm hello-world
```

---

### Step 7: Server Configuration & Directory Setup

1. Create application directory on server:
   ```bash
   mkdir -p ~/feedbackiq/caddy
   cd ~/feedbackiq
   ```

2. Copy `docker-compose.yml` and `caddy/Caddyfile` from your local machine to the server:
   ```powershell
   # Run from your local machine:
   scp -i feedbackiq-key.pem docker-compose.yml deploy@YOUR_ELASTIC_IP:~/feedbackiq/
   scp -i feedbackiq-key.pem caddy/Caddyfile deploy@YOUR_ELASTIC_IP:~/feedbackiq/caddy/
   ```

3. Create production `.env` file on server:
   ```bash
   nano ~/feedbackiq/.env
   ```
   Paste and customize the configuration (replace passwords and secret tokens):
   ```env
   POSTGRES_USER=feedbackiq
   POSTGRES_PASSWORD=generate_a_strong_password_here
   DATABASE_URL="postgresql://USER:PASSWORD@YOUR_DATABASE_HOST:5432/DATABASE?sslmode=require"
   # For Supabase, use the direct database host on port 5432 here, not the pooler on 6543.
   DIRECT_URL="postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?sslmode=require"
   JWT_SECRET=generate_a_random_32_character_token_here
   TRUST_PROXY=true

   S3_BUCKET=feedbackiq-attachments-production
   S3_REGION=us-east-1
   # NO AWS ACCESS KEYS HERE - IAM Role provides credentials!
   MAX_UPLOAD_MB=5

   APP_DOMAIN=feedbackiq.yourdomain.com
   ACME_EMAIL=admin@yourdomain.com

   IMAGE_PREFIX=ghcr.io/yourusername
   IMAGE_TAG=v1.0.0-a1b2c3d
   ```

4. Lock down `.env` permissions:
   ```bash
   chmod 600 ~/feedbackiq/.env
   ```

---

### Step 8: Deploy & Verify Live Containers

1. Pull images and launch containers:
   ```bash
   cd ~/feedbackiq
   docker compose pull
   docker compose up -d
   ```

2. Monitor Caddy TLS Certificate issuance logs:
   ```bash
   docker compose logs -f caddy
   ```
   *Success Output*: You will see `certificate obtained successfully` and `serving initial API` log entries from Let's Encrypt / ZeroSSL.

3. Verify container health status:
   ```bash
   docker compose ps
   ```
   *Expected Output*:
   - `ai-service`: `healthy`
   - `migrate`: `exited (0)` (completed successfully)
   - `backend`: `healthy`
   - `caddy`: `running`

---

### Step 9: Create Admin User on Live Instance

Run admin creation script inside the `web` container:
```bash
docker compose exec -it backend node scripts/create-admin.js admin@yourdomain.com AdminPassword123!
```
*Expected Output*: `Successfully created/updated Admin user: admin@yourdomain.com`

---

### Step 10: End-to-End Verification

#### A. Browser & Mobile Verification
1. Open `https://feedbackiq.yourdomain.com` on desktop and on a mobile phone over cellular data.
2. Verify TLS certificate icon (padlock) is valid.
3. Test HTTP to HTTPS redirect (`http://feedbackiq.yourdomain.com` automatically redirects to `https://`).
4. Submit a feedback item with a screenshot attachment.
5. Log in to Admin portal (`https://feedbackiq.yourdomain.com/admin/login`). Verify dashboard displays AI sentiment, category, priority, and the uploaded screenshot image.

#### B. Security Headers Verification
```powershell
curl.exe -I https://feedbackiq.yourdomain.com
```
*Expected Output*:
```http
HTTP/2 200
strict-transport-security: max-age=31536000; includeSubDomains
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
```

#### C. Network Port Isolation Verification
Run from your local computer:
```powershell
# Windows PowerShell:
Test-NetConnection -ComputerName feedbackiq.yourdomain.com -Port 443  # Succeeds (TcpTestSucceeded: True)
Test-NetConnection -ComputerName feedbackiq.yourdomain.com -Port 5432 # Fails (TcpTestSucceeded: False)
Test-NetConnection -ComputerName feedbackiq.yourdomain.com -Port 8000 # Fails (TcpTestSucceeded: False)
```
*(On Linux/macOS, test with `nc -zv feedbackiq.yourdomain.com 5432 8000`)*

#### D. Private S3 Bucket Verification
1. Open AWS S3 Console -> `feedbackiq-attachments-production` -> `uploads/`.
2. Locate the uploaded screenshot object key (e.g. `uploads/uuid.png`).
3. Click **Object actions** -> **Copy Object URL** and open it in an incognito window.
4. *Expected Output*: `AccessDenied` (XML error page), proving public access is blocked and attachments are accessible only via proxy `/api/attachments/:id`.

---

### Step 11: Automated Database Backup & Restore Procedure

#### A. One-Line Database Backup
For an external PostgreSQL provider, use its native backup/snapshot feature. If the provider exposes `pg_dump`, run it from the EC2 host with the provider's connection string:
```bash
pg_dump "$DATABASE_URL" | gzip > ~/db_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### B. Copy Backup to S3 Bucket
Upload backup file to private S3 bucket under `backups/`:
```bash
aws s3 cp ~/db_backup_*.sql.gz s3://feedbackiq-attachments-production/backups/
```

#### C. Restore Test Walkthrough
To test restoring from backup:
```bash
# 1. Uncompress backup file
gunzip -k db_backup_20261011_120000.sql.gz

# 2. Restore into PostgreSQL container
gunzip -c db_backup_20261011_120000.sql.gz | psql "$DATABASE_URL"
```

---

### Step 12: Zero-Downtime Deployment & Rollback Procedure

#### Upgrade to New Version (e.g. `v2.0.0`)
1. Build and push new tag from local machine:
   ```bash
   $TAG = "v2.0.0-$(git rev-parse --short HEAD)"
   docker buildx build --platform linux/amd64 --target runner -t ${PREFIX}/feedbackiq-backend:${TAG} ./backend --push
   docker buildx build --platform linux/amd64 --target migrate -t ${PREFIX}/feedbackiq-migrate:${TAG} ./backend --push
   docker buildx build --platform linux/amd64 -t ${PREFIX}/feedbackiq-ai:${TAG} ./ai-service --push
   ```
2. On server, update `IMAGE_TAG` in `~/feedbackiq/.env`:
   ```bash
   sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=${TAG}/" ~/feedbackiq/.env
   ```
3. Pull and restart live containers:
   ```bash
   docker compose pull
   docker compose up -d
   ```

#### Emergency Rollback to Previous Version
If `v2.0.0` fails, revert `IMAGE_TAG` to `v1.0.0-a1b2c3d` and redeploy in seconds:
```bash
sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=v1.0.0-a1b2c3d/" ~/feedbackiq/.env
docker compose up -d
```

---

### Step 13: Cost Control & Teardown Checklist

#### Temporary Stop Between Demos
When pausing between college demos:
```bash
# Stop EC2 instance via AWS CLI or EC2 Console
aws ec2 stop-instances --instance-ids i-0123456789abcdef0
```
*What still incurs costs while instance is stopped*:
- Elastic Block Store (EBS) 25 GB disk volume storage.
- Unattached Elastic IP address (charged hourly when instance is stopped).
- S3 bucket storage (~fraction of a cent).

#### Complete Teardown Checklist
To completely wipe all cloud resources and avoid recurring billing:
1. **EC2 Instance**: Terminate instance in AWS EC2 Console.
2. **Elastic IP**: Release Elastic IP address.
3. **S3 Bucket**: Empty all objects in `feedbackiq-attachments-production` bucket, then delete bucket.
4. **IAM Roles & Users**: Delete `FeedbackIQEC2S3Role` and `FeedbackIQS3Policy`.
5. **DNS**: Delete domain A record.
