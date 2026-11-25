/**
 * MediCore Account Security & Session Revocation Generator
 *
 * Generates unique strong passwords and bcrypt hashes for seeded accounts.
 * Saves plain credentials to .env.seeded_accounts (git-ignored).
 * Emits SQL transaction to scripts/secure_seeded_accounts.sql.
 * NEVER prints credentials to standard output or logs.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SEEDED_ACCOUNTS = [
  { role: 'PATIENT', email: 'patient@medicore.local', envKey: 'PATIENT_PASSWORD' },
  { role: 'RECEPTIONIST', email: 'receptionist@medicore.local', envKey: 'RECEPTIONIST_PASSWORD' },
  { role: 'DOCTOR', email: 'doctor@medicore.local', envKey: 'DOCTOR_PASSWORD' },
  { role: 'NURSE', email: 'nurse@medicore.local', envKey: 'NURSE_PASSWORD' },
  { role: 'LAB_TECHNICIAN', email: 'labtech@medicore.local', envKey: 'LABTECH_PASSWORD' },
  { role: 'BILLING_OFFICER', email: 'billing@medicore.local', envKey: 'BILLING_PASSWORD' },
  { role: 'HOSPITAL_ADMIN', email: 'admin@medicore.local', envKey: 'ADMIN_PASSWORD' },
  { role: 'PATIENT', email: 'ben.sisko@synthetic-health.test', envKey: 'BEN_SISKO_PASSWORD' },
];

function generateStrongPassword() {
  // Generate >= 32 chars cryptographically strong password with mixed character classes
  const rawBytes = crypto.randomBytes(24).toString('base64url');
  return `Mc9!${rawBytes}#Z1`;
}

function run() {
  const rootDir = path.resolve(__dirname, '..');
  const envOutFile = path.join(rootDir, '.env.seeded_accounts');
  const sqlOutFile = path.join(__dirname, 'secure_seeded_accounts.sql');

  let envLines = [
    '# MediCore Rotated Seeded Account Credentials',
    `# Generated at: ${new Date().toISOString()}`,
    '# STRICTLY CONFIDENTIAL - DO NOT COMMIT OR EXPOSE',
    '',
  ];

  let sqlStatements = [
    '-- MediCore Seeded Account Hardening & Session Revocation',
    '-- Preserves all clinical, billing, and encounter data records.',
    'BEGIN;',
    '',
    '-- 1. Update password hashes for default seeded accounts',
  ];

  for (const acc of SEEDED_ACCOUNTS) {
    const plainPassword = generateStrongPassword();
    const hash = bcrypt.hashSync(plainPassword, 10);

    envLines.push(`${acc.envKey}=${plainPassword}`);
    sqlStatements.push(
      `UPDATE "User" SET "passwordHash" = '${hash}', "updatedAt" = NOW() WHERE "email" = '${acc.email}';`
    );
  }

  sqlStatements.push('');
  sqlStatements.push('-- 2. Invalidate all active user refresh sessions');
  sqlStatements.push('UPDATE "RefreshSession" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;');
  sqlStatements.push('');
  sqlStatements.push('COMMIT;');

  // Write output files securely
  fs.writeFileSync(envOutFile, envLines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(sqlOutFile, sqlStatements.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });

  // Safe summary without leaking any credentials
  console.log(`[PASS] Generated unique cryptographically strong passwords for ${SEEDED_ACCOUNTS.length} seeded accounts.`);
  console.log(`[PASS] Credentials securely written to .env.seeded_accounts (git-ignored).`);
  console.log(`[PASS] SQL transaction script written to scripts/secure_seeded_accounts.sql (git-ignored).`);
}

run();
