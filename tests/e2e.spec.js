/**
 * tests/e2e.spec.js
 * End-to-end browser tests using Playwright
 * Run with: npm run test:e2e
 *
 * Prerequisites: npm run dev must be running on http://localhost:3000
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

test.describe('Landing Page', () => {
  test('loads and shows correct title', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/Decipher/);
  });

  test('navigation bar is visible', async ({ page }) => {
    await page.goto(BASE_URL);
    const nav = page.locator('nav#mainNav');
    await expect(nav).toBeVisible();
  });

  test('hero section renders', async ({ page }) => {
    await page.goto(BASE_URL);
    const hero = page.locator('#landing');
    await expect(hero).toBeVisible();
  });
});

test.describe('Auth Modal', () => {
  test('Sign In button opens auth modal', async ({ page }) => {
    await page.goto(BASE_URL);
    const signInBtn = page.locator('#authBtn');
    await signInBtn.click();
    const modal = page.locator('#authModal');
    await expect(modal).toBeVisible({ timeout: 5000 });
  });

  test('auth modal can be closed with X button', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('#authBtn').click();
    const closeBtn = page.locator('#amCloseBtn');
    await expect(closeBtn).toBeVisible({ timeout: 5000 });
    await closeBtn.click();
    const modal = page.locator('#authModal');
    await expect(modal).not.toHaveClass(/auth-modal-open/);
  });
});

test.describe('Studio View', () => {
  test('navigates to Studio view', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('#navStudio, [data-view="studioView"]').first().click();
    const studio = page.locator('#studioView');
    await expect(studio).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Quiz View', () => {
  test('navigates to Dojo (Quiz) view', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.locator('#navDojo, [data-view="dojoView"]').first().click();
    const dojo = page.locator('#dojoView');
    await expect(dojo).toBeVisible({ timeout: 5000 });
  });
});

test.describe('404 Page', () => {
  test('unknown URL shows 404 page', async ({ page }) => {
    await page.goto(BASE_URL + '/this-page-does-not-exist');
    await expect(page.locator('body')).toContainText('404');
  });
});
