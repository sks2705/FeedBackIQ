# FeedbackIQ Live Verification Checklist

Run this 10-item manual inspection checklist on your live deployment before your final viva or presentation demo.

- [ ] **1. Mobile Phone Verification**: Open `https://feedbackiq.yourdomain.com` and `/admin` on a mobile device over cellular data; verify form layout, dark mode, responsive table, and navigation look clean.
- [ ] **2. Keyboard-Only Navigation**: Navigate through the public feedback form using only `Tab`, `Shift+Tab`, `Space`, `Enter`, and arrow keys without touching the mouse; verify focus outlines are clearly visible.
- [ ] **3. Dashboard Stats Accuracy**: Verify that total feedback, sentiment breakdown, priority counts, and category distribution on the Admin Dashboard match the numbers output by `live-check.mjs`.
- [ ] **4. AI Service Failure Handling**: Run `docker compose stop ai-service` on the server, submit a new feedback item from the public form, and verify that `analysisStatus` becomes `FAILED` with an error message shown in the admin panel.
- [ ] **5. AI Service Recovery & Reanalyze**: Run `docker compose start ai-service` on the server, open the failed feedback record detail view in the admin panel, click **Reanalyze Feedback**, and verify the status updates to `COMPLETED` with valid sentiment/category/priority.
- [ ] **6. Database Persistence Across Restarts**: Run `docker compose restart` on the server; verify all submitted feedback items, statuses, and user accounts remain intact after restart.
- [ ] **7. Network Port Scanning**: Run a port scanner (`nc -zv feedbackiq.yourdomain.com 5432 8000` or `Test-NetConnection` in PowerShell) from your laptop; verify only ports `80` and `443` answer publicly while `5432` and `8000` are rejected.
- [ ] **8. Private S3 Bucket Access Denial**: Copy the direct S3 URL of an uploaded screenshot (e.g. `https://feedbackiq-attachments-production.s3.amazonaws.com/uploads/uuid.png`) and open it in an incognito window; verify it returns an `AccessDenied` XML error.
- [ ] **9. Server Environment Permissions & Key Audit**: Run `ls -la ~/feedbackiq/.env` on the server to verify file permissions are `600` (`-rw-------`), and verify that `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are empty/omitted.
- [ ] **10. Billing Alert & Screenshots**: Verify that your AWS Email Billing Budget alert is active in the AWS Billing Console, and capture the 4 required README screenshots in `docs/images/`.
