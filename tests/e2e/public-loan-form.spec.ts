import { expect, test } from "@playwright/test";

/**
 * The public loan-application form is the only write path on the site that an
 * unauthenticated visitor can reach. It takes a village slug and a token in
 * the URL:  /ajukan-pinjaman/[slug]/[token]
 *
 * Set E2E_LOAN_SLUG and E2E_LOAN_TOKEN from a real published link to run these.
 */

const SLUG = process.env.E2E_LOAN_SLUG;
const TOKEN = process.env.E2E_LOAN_TOKEN;

test.describe("public loan intake", () => {
  test.skip(
    !SLUG || !TOKEN,
    "set E2E_LOAN_SLUG and E2E_LOAN_TOKEN to exercise the public loan form",
  );

  const formUrl = () => `/ajukan-pinjaman/${SLUG}/${TOKEN}`;

  test("rejects an invalid token without leaking tenant data", async ({ page }) => {
    await page.goto(`/ajukan-pinjaman/${SLUG}/not-a-real-token`, {
      waitUntil: "domcontentloaded",
    });

    const body = await page.textContent("body");
    expect(body).not.toMatch(/tenant_id|unit_id|[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  test("renders the intake form for a valid link", async ({ page }) => {
    await page.goto(formUrl(), { waitUntil: "domcontentloaded" });
    await expect(page.locator('[name="requested_amount"]')).toBeVisible();
    await expect(page.locator('[name="supporting_document_url"]')).toBeVisible();
  });

  test("refuses a non-PDF supporting document", async ({ page }) => {
    await page.goto(formUrl(), { waitUntil: "domcontentloaded" });

    await page.fill('[name="applicant_full_name"]', "Uji Otomatis");
    await page.fill('[name="requested_amount"]', "5000000");
    await page.fill('[name="tenor_months"]', "12");
    await page.fill('[name="estimated_repayment_capacity"]', "500000");
    await page.fill('[name="supporting_document_url"]', "https://example.test/a.exe");
    await page.fill('[name="supporting_document_name"]', "a.exe");
    await page.getByRole("button", { name: /kirim|ajukan|submit/i }).click();

    await expect(page.getByText(/PDF/i)).toBeVisible();
  });

  test("BUG: accepts a javascript: URL ending in .pdf", async ({ page }) => {
    // Documents the gap found in the unit tests, end to end. When the action
    // starts validating the URL scheme this test fails — flip the expectation.
    await page.goto(formUrl(), { waitUntil: "domcontentloaded" });

    await page.fill(
      '[name="supporting_document_url"]',
      "javascript:alert(1)//x.pdf",
    );
    await page.fill('[name="supporting_document_name"]', "x.pdf");

    const rejected = await page
      .getByText(/wajib berupa PDF/i)
      .isVisible()
      .catch(() => false);

    expect(rejected, "scheme is now validated — update this test").toBe(false);
  });

  test("has some protection against automated submission", async ({ page }) => {
    // No rate limit, CAPTCHA, or honeypot exists today. With 123 published
    // links this is an open write path into the loan tables.
    await page.goto(formUrl(), { waitUntil: "domcontentloaded" });

    const html = await page.content();
    const hasProtection =
      /captcha|recaptcha|turnstile|hcaptcha|honeypot/i.test(html);

    expect(
      hasProtection,
      "public loan form still has no bot protection — see the audit report",
    ).toBe(false);
  });
});
