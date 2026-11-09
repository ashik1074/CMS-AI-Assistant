import { expect, test, type Page } from '@playwright/test';

const composer = (page: Page) => page.getByRole('textbox', { name: 'Message AI Assistant' });
const lastAssistant = (page: Page) => page.getByTestId('assistant-message').last();

async function openSidebarIfMobile(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: 'Open sidebar' }).click();
}

test.beforeEach(async ({ page }) => {
  // Fast streaming keeps the suite quick. Settings are only seeded on first load of a fresh context.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('ai-chat:settings:v1', JSON.stringify({ theme: 'light', streamingSpeed: 'fast', enableSteps: true }));
      sessionStorage.setItem('seeded', '1');
    }
  });
  page.on('dialog', (d) => {
    throw new Error(`Unexpected dialog: ${d.message()}`);
  });
});

test('sends a message and streams the response progressively', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173')) external.push(r.url());
  });
  await page.goto('/#/assistant');
  await expect(page.getByRole('heading', { name: 'What can I help you with?' })).toBeVisible();

  await composer(page).fill('Write a detailed guide about accessibility');
  await composer(page).press('Enter');

  await expect(page.getByTestId('user-message')).toHaveText('Write a detailed guide about accessibility');
  await expect(page.getByRole('button', { name: 'Stop generating' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Processing steps' })).toBeVisible();

  // Progressive output: content grows over time rather than appearing at once.
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'streaming', { timeout: 10_000 });
  const early = (await lastAssistant(page).textContent())!.length;
  await page.waitForTimeout(300);
  const later = (await lastAssistant(page).textContent())!.length;
  expect(later).toBeGreaterThan(early);

  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'completed', { timeout: 20_000 });
  await expect(lastAssistant(page).getByText(/Thought for \d+ seconds?/)).toBeVisible();
  await expect(lastAssistant(page).getByRole('heading', { name: /accessible web applications/ })).toBeVisible();
  expect(external).toEqual([]);
});

test('stop generation keeps partial text and allows continuing', async ({ page }) => {
  await page.goto('/#/assistant');
  await composer(page).fill('Write a detailed guide about accessibility');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'streaming', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Stop generating' }).click();
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'cancelled');
  await expect(page.getByText('Response stopped before completion.')).toBeVisible();
  await expect(lastAssistant(page).getByText(/Thought for/)).toHaveCount(0);

  await composer(page).fill('Hello');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'completed', { timeout: 10_000 });
});

test('conversations persist after reload; deleted ones stay deleted', async ({ page, isMobile }) => {
  await page.goto('/#/assistant');
  await composer(page).fill('Hello');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'completed', { timeout: 10_000 });
  await (isMobile ? page.locator('header') : page.getByRole('navigation', { name: 'Chat history' })).getByRole('button', { name: 'New chat' }).click();
  await composer(page).fill('What is a headless CMS?');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'completed', { timeout: 15_000 });

  await page.reload();
  await expect(page.getByTestId('user-message')).toHaveText('What is a headless CMS?');
  await openSidebarIfMobile(page, isMobile);
  const nav = page.getByRole('navigation', { name: 'Chat history' });
  await expect(nav.getByText('Hello', { exact: true })).toBeVisible();

  await nav.getByRole('button', { name: 'More options for Hello' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Conversation deleted.')).toBeVisible();

  await page.reload();
  await openSidebarIfMobile(page, isMobile);
  await expect(nav.getByText('Hello', { exact: true })).toHaveCount(0);
  await expect(nav.getByText('What is a headless CMS?')).toBeVisible();
});

test('untrusted input cannot execute scripts', async ({ page }) => {
  await page.goto('/#/assistant');
  await composer(page).fill('<img src=x onerror="alert(1)"><script>alert(2)</script> [x](javascript:alert(3))');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'completed', { timeout: 10_000 });
  await expect(page.getByTestId('user-message')).toContainText('<script>alert(2)</script>');
  expect(await page.locator('[data-testid="message-list"] img, [data-testid="message-list"] script').count()).toBe(0);
});

test('corrupted storage does not crash the app', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ai-chat:conversations:v1', '{{{not json'));
  await page.goto('/#/assistant');
  await expect(page.getByRole('heading', { name: 'What can I help you with?' })).toBeVisible();
  await expect(page.getByText(/corrupted and has been reset/)).toBeVisible();
});

test('simulated failure shows an error with retry', async ({ page }) => {
  await page.goto('/#/assistant');
  await composer(page).fill('Simulate an error');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'failed', { timeout: 10_000 });
  await expect(lastAssistant(page).getByRole('button', { name: 'Retry' })).toBeVisible();
});

test("dark theme applies from settings", async ({ page }) => {
  await page.goto('/#/assistant');
  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await page.getByRole('dialog', { name: 'Settings' }).getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).not.toBe('rgb(255, 255, 255)');

});

test('layout has no horizontal overflow and the composer stays visible', async ({ page }) => {
  await page.goto('/#/assistant');
  await composer(page).fill('Compare REST, GraphQL and gRPC in a table');
  await composer(page).press('Enter');
  await expect(lastAssistant(page)).toHaveAttribute('data-status', 'completed', { timeout: 15_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await expect(composer(page)).toBeInViewport();
});

test('mobile drawer opens and closes', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile only');
  await page.goto('/#/assistant');
  const drawer = page.getByTestId('sidebar-drawer');
  await expect(drawer).not.toBeInViewport();
  await page.getByRole('button', { name: 'Open sidebar' }).click();
  await expect(drawer).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(drawer).not.toBeInViewport();
});

test('keyboard: Enter sends, Shift+Enter adds a newline, Tab reaches controls', async ({ page }) => {
  await page.goto('/#/assistant');
  await composer(page).focus();
  await page.keyboard.type('one');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('two');
  await expect(composer(page)).toHaveValue('one\ntwo');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('user-message')).toHaveText('one\ntwo');
});

test('opens on the Product List and creates a product through the Product Setup form', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Product List' })).toBeVisible();
  await expect(page.getByTestId('welcome-screen')).toHaveCount(0);

  await page.getByRole('link', { name: 'Product Setup' }).click();
  await page.getByLabel(/^Product Name/).fill('E2E Product');
  await page.getByLabel(/^Market Segment/).selectOption('CONSUMER');
  await page.getByLabel(/^Product Type/).selectOption('DEBIT');
  await page.getByLabel(/^Account Currency/).selectOption('BDT');
  await page.getByLabel(/^Card Validity/).selectOption('5');
  await page.getByLabel(/^Live From/).fill('2030-01-15');
  const next = page.getByRole('button', { name: 'Next Step' });
  for (let i = 0; i < 5; i++) await next.click();

  const scheme = page.getByTestId('scheme-config');
  await scheme.getByRole('combobox', { name: 'Scheme' }).selectOption({ label: 'VISA' });
  await scheme.getByLabel(/^Named card template/).selectOption({ label: 'Visa Classic Named' });
  await scheme.getByLabel('BIN', { exact: true }).selectOption({ label: 'Visa Classic BIN 421234' });
  await scheme.getByLabel('BIN range', { exact: true }).selectOption({ label: 'Range 0000000 to 4999999' });
  await next.click();
  await page.getByRole('button', { name: 'Submit Product' }).click();

  await expect(page.getByRole('row', { name: /E2E Product/ })).toContainText('Pending approval');

  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'AI Assistant' }).click();
  await expect(page.getByRole('heading', { name: 'What can I help you with?' })).toBeVisible();
});
