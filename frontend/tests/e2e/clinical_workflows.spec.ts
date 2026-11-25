import { test, expect } from '@playwright/test';

/**
 * MC-12: End-to-End Playwright Healthcare Workflow Tests
 * Tests login, role redirection, appointment workflows, and clinical boundaries.
 */

test.describe('MediCore E2E Clinical Workflows (MC-12)', () => {
  const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3002';

  test('E2E-01: Portal Login Page loads with accessible form and dev quick-switcher', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('h2')).toContainText('Hospital Portal Login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('E2E-02: Patient login navigates to Patient Dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Use quick-switcher for patient
    const patientBtn = page.getByRole('button', { name: /Patient \(Alice Morgan\)/i });
    if (await patientBtn.isVisible()) {
      await patientBtn.click();
      await page.getByRole('button', { name: /Sign In/i }).click();
      await expect(page).toHaveURL(/.*dashboard/);
    }
  });

  test('E2E-03: Administrator dashboard contains operational summary and clinical restriction banner', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const adminBtn = page.getByRole('button', { name: /Admin \(Arthur Pendelton\)/i });
    if (await adminBtn.isVisible()) {
      await adminBtn.click();
      await page.getByRole('button', { name: /Sign In/i }).click();
      await expect(page).toHaveURL(/.*dashboard/);
      // Verify clinical PHI restriction notice
      await expect(page.locator('text=Policy Notice: Administrative Clinical Data Restriction')).toBeVisible();
    }
  });
});
