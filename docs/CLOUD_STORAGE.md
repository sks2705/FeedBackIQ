# AWS S3 Cloud Storage Integration Guide

This guide documents the Amazon S3 setup for FeedbackIQ screenshot attachments, including bucket policy configuration, key scheme, local development credentials, and production IAM role deployment.

---

## 1. AWS Console Bucket Setup Steps

### Step A: Create Private S3 Bucket
1. Open the [AWS S3 Console](https://s3.console.aws.amazon.com/).
2. Click **Create bucket**.
3. **Bucket name**: Enter a globally unique bucket name (e.g., `feedbackiq-attachments-production`).
4. **AWS Region**: Select your region (e.g., `us-east-1`).
5. **Block Public Access settings for this bucket**:
   - Check **Block *all* public access** (`ON`).
6. **Bucket Versioning**: Keep Disabled (or Enabled based on compliance).
7. **Default Encryption**:
   - Encryption type: **Server-side encryption with Amazon S3 managed keys (SSE-S3)** (`ON`).
8. Click **Create bucket**.

*Success State*: The bucket status displays **"Bucket and objects not public"** and default SSE-S3 encryption is enabled.

---

## 2. IAM Policy and Local Development User

### Step B: Create Least-Privilege IAM Policy
1. Open the [AWS IAM Console](https://console.aws.amazon.com/iam/).
2. Navigate to **Policies** -> **Create policy**.
3. Select **JSON** tab and paste the following policy (replace `feedbackiq-attachments-production` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowFeedbackIQStorageOperations",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::feedbackiq-attachments-production",
        "arn:aws:s3:::feedbackiq-attachments-production/*"
      ]
    }
  ]
}
```

4. Name the policy `FeedbackIQS3Policy` and click **Create policy**.

### Step C: Create Local Development IAM User
> [!WARNING]
> **SECURITY WARNING**: Never paste AWS access keys or secrets into chat, git commits, public issue trackers, or screenshots. Access keys must only reside in your local, git-ignored `web/.env` file.

1. In IAM Console, navigate to **Users** -> **Add users**.
2. Username: `feedbackiq-dev-local`.
3. Select **Access key - Programmatic access**.
4. Attach the `FeedbackIQS3Policy` policy directly to the user.
5. Save the generated **Access Key ID** and **Secret Access Key** into your local `web/.env` file:
   ```env
   S3_BUCKET=feedbackiq-attachments-production
   S3_REGION=us-east-1
   S3_ACCESS_KEY_ID=AKIA...
   S3_SECRET_ACCESS_KEY=wJalrX...
   MAX_UPLOAD_MB=5
   ```

---

## 3. Server Deployment (IAM Role Replacement)

In production cloud environments (AWS EC2, ECS, EKS, App Runner, Lambda):
- **Omit `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`** from environment variables.
- Attach an **IAM Instance Profile / Task Role** containing `FeedbackIQS3Policy` directly to the computing resource.
- The `@aws-sdk/client-s3` automatically uses the **AWS SDK Default Credential Chain**, picking up temporary credentials securely without any hardcoded credentials.

---

## 4. Object Key Naming Scheme & Security

- **Server-Generated Key Scheme**: `uploads/<uuid>.<ext>` (e.g. `uploads/a1b2c3d4-e5f6-7890-1234-56789abcdef0.png`).
- User-supplied filenames are **never** used in the S3 object key, preventing path traversal attacks.
- Display filenames are sanitized before being served inline (`inline; filename="..."`).
- **Proxy Streaming**: All attachments are fetched via authenticated backend proxy endpoint `/api/attachments/:id` with strict security headers (`X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'`). The browser never connects to S3 directly.
