import http from 'http';
import https from 'https';

const baseUrl = (process.env.BASE_URL || 'https://localhost').replace(/\/$/, '');
const adminEmail = process.env.ADMIN_EMAIL || 'admin@feedbackiq.local';
const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

// Tiny valid 1x1 PNG image byte array
const TINY_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

let createdFeedbackIds = [];
let cookieHeader = '';
let stepNumber = 1;
let hasFailures = false;

function logStep(pass, title, detail, probableFault = null) {
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`[STEP ${stepNumber++}] ${status}: ${title}`);
  if (detail) {
    console.log(`         Details: ${detail}`);
  }
  if (!pass && probableFault) {
    console.log(`         Probable Fault Component: ${probableFault}`);
    hasFailures = true;
  }
}

async function runLiveCheck() {
  console.log(`\n==================================================`);
  console.log(`  FeedbackIQ Live Production Diagnostic Check`);
  console.log(`  Target URL: ${baseUrl}`);
  console.log(`==================================================\n`);

  // Bypass TLS self-signed certificate rejection for local dev testing
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  // --- Step 1: Health Check ---
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    const health = await res.json().catch(() => ({}));
    const isOk =
      res.ok &&
      health.database === 'ok' &&
      health.aiService === 'ok' &&
      health.storage === 'ok';

    logStep(
      isOk,
      'GET /api/health Check',
      `DB=${health.database}, AI=${health.aiService}, Storage=${health.storage}`,
      'Next.js Web / PostgreSQL / FastAPI / S3 Storage'
    );
  } catch (err) {
    logStep(false, 'GET /api/health Check', err.message, 'Caddy Reverse Proxy / Network');
  }

  // --- Step 2: HTTP to HTTPS Redirect & Security Headers ---
  try {
    const httpUrl = baseUrl.replace(/^https:/, 'http:');
    let redirectOk = false;
    let secHeadersOk = false;

    // Test HTTP redirect
    const httpRes = await new Promise((resolve) => {
      const client = httpUrl.startsWith('https') ? https : http;
      client.get(httpUrl, (r) => resolve(r)).on('error', () => resolve(null));
    });

    if (httpRes && (httpRes.statusCode === 301 || httpRes.statusCode === 302 || httpRes.statusCode === 308)) {
      redirectOk = true;
    }

    const httpsRes = await fetch(`${baseUrl}/api/health`);
    const hsts = httpsRes.headers.get('strict-transport-security');
    const nosniff = httpsRes.headers.get('x-content-type-options');
    const serverHeader = httpsRes.headers.get('server');

    secHeadersOk = Boolean(hsts) && nosniff === 'nosniff' && !serverHeader;

    logStep(
      redirectOk && secHeadersOk,
      'HTTP Redirect & Security Headers Check',
      `Redirect=${redirectOk}, HSTS=${Boolean(hsts)}, X-Content-Type-Options=${nosniff}, ServerHeaderMasked=${!serverHeader}`,
      'Caddy Reverse Proxy Configuration'
    );
  } catch (err) {
    logStep(false, 'HTTP Redirect & Security Headers Check', err.message, 'Caddy Reverse Proxy');
  }

  // --- Step 3: Negative Bug Submission ---
  let bugId = null;
  try {
    const bugRes = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '[LIVE-CHECK] The login button crashes with a blank screen when clicked on mobile Safari.',
        productName: 'Mobile Web App',
        source: 'web',
      }),
    });

    const payload = await bugRes.json().catch(() => ({}));
    const data = payload.data || {};
    bugId = data.id;
    if (bugId) createdFeedbackIds.push(bugId);

    const valid =
      bugRes.status === 201 &&
      data.analysisStatus === 'COMPLETED' &&
      data.sentiment === 'NEGATIVE' &&
      data.category === 'BUG' &&
      data.priority &&
      Boolean(data.summary);

    logStep(
      valid,
      'Submit Negative Bug Report',
      `ID=${data.id}, Category=${data.category}, Sentiment=${data.sentiment}, Priority=${data.priority}`,
      'FastAPI AI Service / Rules Pipeline'
    );
  } catch (err) {
    logStep(false, 'Submit Negative Bug Report', err.message, 'FastAPI AI Service');
  }

  // --- Step 4: Polite Feature Request & Positive Comment ---
  let featureId = null;
  try {
    const featRes = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '[LIVE-CHECK] Please add dark mode support to the setting page, thank you!',
        productName: 'User Portal',
        source: 'web',
      }),
    });

    const featPayload = await featRes.json().catch(() => ({}));
    const featData = featPayload.data || {};
    featureId = featData.id;
    if (featureId) createdFeedbackIds.push(featureId);

    const valid =
      featRes.status === 201 &&
      featData.category === 'FEATURE_REQUEST' &&
      (featData.sentiment === 'POSITIVE' || featData.sentiment === 'NEUTRAL');

    logStep(
      valid,
      'Submit Feature Request',
      `Category=${featData.category}, Sentiment=${featData.sentiment}`,
      'FastAPI AI Service'
    );
  } catch (err) {
    logStep(false, 'Submit Feature Request', err.message, 'FastAPI AI Service');
  }

  // --- Step 5: Invalid Input Handling (Expect 400) ---
  try {
    const invalid1 = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '123456789', productName: 'App' }),
    });

    const invalid2 = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '[LIVE-CHECK] Valid message', productName: '', userEmail: 'not-an-email' }),
    });

    const pass = invalid1.status === 400 && invalid2.status === 400;
    logStep(
      pass,
      'Invalid Input Rejection (400)',
      `ShortMsgStatus=${invalid1.status}, BadEmailStatus=${invalid2.status}`,
      'Next.js Zod Input Validation'
    );
  } catch (err) {
    logStep(false, 'Invalid Input Rejection (400)', err.message, 'Next.js Web Route Handler');
  }

  // --- Step 6: Valid PNG Upload vs Invalid Text Upload ---
  let attachmentFeedbackId = null;
  try {
    // 6a. Upload valid PNG bytes
    const blob = new Blob([TINY_PNG_BYTES], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'screenshot.png');

    const uploadRes = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      body: formData,
    });

    const uploadPayload = await uploadRes.json().catch(() => ({}));
    const uploadData = uploadPayload.data || {};
    const key = uploadData.objectKey;

    // 6b. Submit feedback with uploaded attachment key
    const fbRes = await fetch(`${baseUrl}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '[LIVE-CHECK] Screenshot attached for UI visual defect.',
        productName: 'UI Portal',
        attachmentKey: key,
        attachmentName: 'screenshot.png',
        attachmentType: 'image/png',
        attachmentSize: TINY_PNG_BYTES.length,
      }),
    });

    const fbPayload = await fbRes.json().catch(() => ({}));
    if (fbPayload.data?.id) {
      attachmentFeedbackId = fbPayload.data.id;
      createdFeedbackIds.push(attachmentFeedbackId);
    }

    // 6c. Upload text file renamed to .png (expect 415 rejection)
    const textBlob = new Blob([Buffer.from('Hello plain text content')], { type: 'image/png' });
    const textFormData = new FormData();
    textFormData.append('file', textBlob, 'fake_image.png');

    const badUploadRes = await fetch(`${baseUrl}/api/uploads`, {
      method: 'POST',
      body: textFormData,
    });

    const pass = uploadRes.status === 201 && fbRes.status === 201 && badUploadRes.status === 415;

    logStep(
      pass,
      'Valid PNG Upload & Fake PNG Rejection',
      `PngUploadStatus=${uploadRes.status}, BadUploadStatus=${badUploadRes.status}`,
      'S3 Storage Service / Magic Bytes Validator'
    );
  } catch (err) {
    logStep(false, 'Valid PNG Upload & Fake PNG Rejection', err.message, 'AWS S3 / Upload Handler');
  }

  // --- Step 7: Anonymous Unauthenticated Protection (Expect 401) ---
  try {
    const anonFb = await fetch(`${baseUrl}/api/feedback`);
    const anonAtt = await fetch(`${baseUrl}/api/attachments/12345678-1234-1234-1234-123456789012`);

    const pass = anonFb.status === 401 && anonAtt.status === 401;
    logStep(
      pass,
      'Anonymous GET Access Protection (401)',
      `AnonFeedbackStatus=${anonFb.status}, AnonAttachmentStatus=${anonAtt.status}`,
      'Authentication Middleware / Auth Guard'
    );
  } catch (err) {
    logStep(false, 'Anonymous GET Access Protection (401)', err.message, 'Next.js Auth Module');
  }

  // --- Step 8: Admin Login, Summary Delta, & Status Update ---
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
      cookieHeader = setCookie.split(';')[0];
    }

    // Fetch summary stats
    const summaryRes = await fetch(`${baseUrl}/api/analytics/summary`, {
      headers: { Cookie: cookieHeader },
    });
    const summaryData = (await summaryRes.json().catch(() => ({}))).data || {};

    // Update status of one created feedback
    let statusUpdateOk = false;
    if (bugId) {
      const patchRes = await fetch(`${baseUrl}/api/feedback/${bugId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader,
        },
        body: JSON.stringify({ status: 'RESOLVED' }),
      });
      statusUpdateOk = patchRes.status === 200;
    }

    const pass = loginRes.ok && summaryRes.ok && statusUpdateOk;

    logStep(
      pass,
      'Admin Login, Analytics Summary, & Status Resolution',
      `LoginStatus=${loginRes.status}, TotalCount=${summaryData.total}, ResolvedUpdated=${statusUpdateOk}`,
      'Next.js Auth / PostgreSQL Analytics Query'
    );
  } catch (err) {
    logStep(false, 'Admin Login, Analytics Summary, & Status Resolution', err.message, 'Next.js Auth / PostgreSQL');
  }

  // --- Step 9: Export CSV Includes Created Items ---
  try {
    const exportRes = await fetch(`${baseUrl}/api/feedback/export`, {
      headers: { Cookie: cookieHeader },
    });

    const csvText = await exportRes.text();
    const hasCreatedItems = createdFeedbackIds.every((id) => csvText.includes(id) || csvText.includes('[LIVE-CHECK]'));

    const pass = exportRes.ok && hasCreatedItems;

    logStep(
      pass,
      'Export CSV Verification',
      `ExportStatus=${exportRes.status}, ContainsLiveCheckRows=${hasCreatedItems}`,
      'Next.js CSV Exporter'
    );
  } catch (err) {
    logStep(false, 'Export CSV Verification', err.message, 'Next.js Export Handler');
  }

  console.log(`\n==================================================`);
  if (hasFailures) {
    console.log(`  RESULT: DIAGNOSTIC FAILED - FIX ISSUES ABOVE`);
    console.log(`==================================================\n`);
    process.exit(1);
  } else {
    console.log(`  RESULT: ALL DIAGNOSTIC STEPS PASSED SUCCESSFULLY!`);
    console.log(`==================================================\n`);
    process.exit(0);
  }
}

runLiveCheck();
