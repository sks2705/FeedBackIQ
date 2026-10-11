# FeedbackIQ 5-Minute Live Presentation & Viva Demo Script

**Live Demo URL**: [https://feedbackiq.yourdomain.com](https://feedbackiq.yourdomain.com)  
**Target Duration**: 5 Minutes

---

## 1. Demo Timeline & Click Walkthrough

### Step 1: Public Submission with Screenshot (1 Minute)
- **What to Click**:
  1. Open `https://feedbackiq.yourdomain.com` in your browser.
  2. In **Feedback Message**, type:  
     `Checkout page crashes with a blank screen when applying promo codes on mobile Safari.`
  3. In **Product Name**, type: `Checkout Flow`.
  4. Under **Attach Screenshot**, click **Choose File** and select a screenshot image (`bug_screenshot.png`).
  5. Click **Submit Feedback**.
- **What to Say**:  
  > *"Welcome to FeedbackIQ. Here is our public feedback intake portal. I am submitting an urgent bug report with an attached screenshot. Notice that as soon as I select the file, it is validated client-side for MIME type, magic bytes, and size before being uploaded via an S3 upload proxy."*

---

### Step 2: Feature Request & Security Submissions (45 Seconds)
- **What to Click**:
  1. Submit a second item:  
     `Please add dark mode theme options in settings to reduce eye strain.`  
     Product Name: `Admin Dashboard`.
  2. Submit a third item:  
     `Password reset link token remains valid for 48 hours without expiring.`  
     Product Name: `Account Security`.
- **What to Say**:  
  > *"Next, I am submitting two additional feedback items: a feature request for dark mode, and a critical security concern regarding unexpired password reset tokens."*

---

### Step 3: Admin Dashboard & Real-Time AI Intelligence (1 Minute)
- **What to Click**:
  1. Navigate to `/admin/login` and log in with `admin@yourdomain.com` / `AdminPassword123!`.
  2. Click on the newly submitted **Checkout Flow** bug item in the list table.
  3. Show the **AI Intelligence Panel** labels (Sentiment: `NEGATIVE`, Category: `BUG`, Priority: `CRITICAL`).
  4. Point to the **Attached Screenshot** card displaying the inline proxy image.
  5. Change status dropdown from `NEW` to `RESOLVED`.
- **What to Say**:  
  > *"Here in the Admin Dashboard, our AI pipeline evaluated the feedback in under 70 milliseconds. The RoBERTa model correctly identified the negative sentiment, our keyword rules categorized it as a BUG, and the priority matrix elevated it to CRITICAL due to checkout crashes. Notice how the screenshot is securely streamed through our proxy without exposing direct bucket URLs."*

---

### Step 4: Filtering, Analytics, & CSV Export (45 Seconds)
- **What to Click**:
  1. Click **Feedback List** in top navigation.
  2. Select **Category -> Security** in the filter bar.
  3. Click **Export CSV**. Open the downloaded CSV.
- **What to Say**:  
  > *"Admins can filter feedback dynamically by sentiment, category, priority, or date range. Exporting to CSV generates a sanitized report ready for team distribution."*

---

### Step 5: System Architecture & Infrastructure Resilience (1 Minute 30 Seconds)
- **What to Click**:
  1. Open terminal on server and run `docker compose ps`.
  2. Run `docker compose stop ai-service`.
  3. Submit a new feedback item on the live site:  
     `The search results take 10 seconds to load.`
  4. Show the item in Admin detail view: `analysisStatus` = `FAILED`.
  5. In terminal, run `docker compose start ai-service`.
  6. In browser, click **Reanalyze Feedback**. Show status update to `COMPLETED`.
- **What to Say**:  
  > *"FeedbackIQ is containerized using Docker Compose with HTTPS reverse proxying via Caddy. If our AI service container goes offline, the application gracefully degrades—saving the feedback as FAILED without crashing the user submission. Once the AI container restarts, admins can reanalyze records with a single click."*

---

## 2. Six Likely Viva / Interview Questions & Short Honest Answers

### Q1: Why use keyword rules for category classification instead of a fine-tuned classifier?
> **Answer**: Keyword rules provide deterministic, zero-latency categorization that requires zero training data or expensive GPU inference. For a college project budget ($0 API costs), rules ensure 100% predictable routing for explicit terms (`bug`, `crash`, `SQL injection`) while avoiding model hallucination.

### Q2: Why use extractive summarization instead of generative LLM summaries (e.g. GPT-4)?
> **Answer**: Extractive summarization ranks key sentences directly from input text using sentence scoring. It runs in <1ms on CPU, requires zero paid APIs, and eliminates LLM hallucinations or factual errors.

### Q3: How are secrets and the AWS S3 bucket protected?
> **Answer**: All secrets live in a `chmod 600` `.env` file on the server. On AWS EC2, the server uses an IAM Role via IMDSv2 metadata, meaning **no AWS keys exist on disk**. The S3 bucket blocks all public access; screenshots stream through an authenticated Next.js proxy route with strict security headers (`X-Content-Type-Options: nosniff`).

### Q4: Why deploy with Docker Compose on a single VM instead of Kubernetes or AWS ECS?
> **Answer**: Docker Compose on a single VM keeps infrastructure simple, cost-effective, and easy to maintain while preserving container isolation, resource limits, and log rotation. It provides identical local and production runtime parity.

### Q5: What are the main limitations of the system?
> **Answer**: The main limitations are: (1) Sentiment model and rules are tuned for English text; (2) In-memory rate limiting is single-instance; and (3) Extractive summaries perform best on multi-sentence paragraphs.

### Q6: What would you improve next?
> **Answer**: In a future phase, I would add: (1) Redis for distributed rate-limiting and job queues; (2) ClamAV malware scanning for uploaded screenshots; and (3) Multilingual sentiment transformers.

---

## 3. Emergency Fallback Plan (If Live Demo Fails)

If the live server URL fails during your presentation (e.g. cloud VM network issue or DNS outage):

1. **Local Docker Fallback**:
   - Open PowerShell on your laptop:
     ```powershell
     cd feedbackiq
     docker compose up -d
     ```
   - Open `https://localhost` in your browser.
2. **Offline Screenshots Fallback**:
   - Open the 4 fallback screenshots saved in `docs/images/`:
     - `01_public_form.png`
     - `02_admin_dashboard.png`
     - `03_feedback_detail.png`
     - `04_architecture.png`
