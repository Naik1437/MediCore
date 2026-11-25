/**
 * Verification Script: Confirm Default Credentials Rejected
 *
 * Tests that default development passwords ('Password123!') are rejected
 * by the backend with HTTP 401 Unauthorized across all key roles.
 * NEVER prints new passwords or exposes secret credentials.
 */

const http = require('http');

const TARGET_HOST = process.env.VERIFY_HOST || '127.0.0.1';
const TARGET_PORT = parseInt(process.env.VERIFY_PORT || '4002', 10);

const TEST_ACCOUNTS = [
  'doctor@medicore.local',
  'patient@medicore.local',
  'admin@medicore.local',
  'nurse@medicore.local',
  'receptionist@medicore.local',
  'labtech@medicore.local',
  'billing@medicore.local'
];

function testLogin(email, password) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ email, password });
    const req = http.request(
      {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = {};
          try {
            parsed = JSON.parse(data);
          } catch (_) {}
          resolve({
            statusCode: res.statusCode,
            code: parsed?.error?.code || parsed?.code,
            message: parsed?.error?.message || parsed?.message,
          });
        });
      }
    );

    req.on('error', (err) => {
      resolve({ statusCode: 0, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, error: 'Connection timed out' });
    });

    req.write(payload);
    req.end();
  });
}

async function verify() {
  console.log(`[VERIFY] Probing authentication gate at http://${TARGET_HOST}:${TARGET_PORT}/api/v1/auth/login...`);
  console.log('[VERIFY] Testing rejection of default password "Password123!" on seeded accounts...\n');

  let passed = 0;
  let failed = 0;

  for (const email of TEST_ACCOUNTS) {
    const res = await testLogin(email, 'Password123!');
    if (res.statusCode === 401) {
      console.log(`  [PASS] ${email.padEnd(30)} -> HTTP 401 Unauthorized (${res.code || 'UNAUTHORIZED'})`);
      passed++;
    } else if (res.statusCode === 200) {
      console.log(`  [FAIL] ${email.padEnd(30)} -> HTTP 200 OK! Default credentials were accepted!`);
      failed++;
    } else {
      console.log(`  [WARN] ${email.padEnd(30)} -> HTTP ${res.statusCode} (${res.error || res.message || 'unknown'})`);
      failed++;
    }
  }

  console.log('\n------------------------------------------------------------');
  if (failed === 0 && passed > 0) {
    console.log(`[RESULT] SUCCESS: All ${passed} tested accounts rejected default credentials.`);
    process.exit(0);
  } else {
    console.log(`[RESULT] FAILED: ${failed} accounts did not return HTTP 401.`);
    process.exit(1);
  }
}

verify();
