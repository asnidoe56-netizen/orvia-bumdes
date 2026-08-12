import { describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";
import { readSource } from "../helpers/source-tree";

const SOURCE = "src/lib/auth/generate-temporary-password.ts";

/**
 * This generates the first password for every BUMDes user created by an admin
 * (src/app/bumdes/dashboard/users/actions.ts). Across 123 villages that is the
 * initial credential for a large number of finance operators.
 */

describe("generateTemporaryPassword — properties that hold today", () => {
  it("produces 14 characters", () => {
    expect(generateTemporaryPassword()).toHaveLength(14);
  });

  it("always includes each required character class", () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateTemporaryPassword();
      expect(password).toMatch(/[A-HJ-NP-Z]/);
      expect(password).toMatch(/[a-km-z]/);
      expect(password).toMatch(/[2-9]/);
      expect(password).toMatch(/[!@#$%]/);
    }
  });

  it("omits visually ambiguous characters", () => {
    // No I, O, l, 0, 1 — deliberate, since these get read off paper.
    for (let i = 0; i < 200; i += 1) {
      expect(generateTemporaryPassword()).not.toMatch(/[IOl01]/);
    }
  });

  it("does not repeat across calls", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateTemporaryPassword()),
    );
    expect(seen.size).toBe(500);
  });
});

describe("generateTemporaryPassword — weaknesses", () => {
  it("BUG: uses Math.random(), not a cryptographic RNG", () => {
    const source = readSource(SOURCE);

    expect(source).toMatch(/Math\.random\(\)/);
    expect(source).not.toMatch(/crypto|randomBytes|getRandomValues/);

    // Math.random() is seeded from a PRNG whose internal state can be
    // recovered from a modest number of outputs (V8 uses xorshift128+).
    // An admin who can mint several accounts can, in principle, predict the
    // next password issued. Fix: crypto.randomInt / crypto.getRandomValues.
  });

  it("BUG: shuffles with a comparator instead of Fisher-Yates", () => {
    const source = readSource(SOURCE);
    expect(source).toMatch(/\.sort\(\(\) => Math\.random\(\) - 0\.5\)/);
  });

  it("BUG: the biased shuffle leaves character classes unevenly placed", () => {
    // `.sort(() => Math.random() - 0.5)` is not a uniform permutation. The four
    // guaranteed characters are built in a fixed order (upper, lower, digit,
    // symbol) at indices 0..3, and the biased sort does not fully disperse them.
    // A uniform shuffle would put the symbol in the first 4 slots about
    // 4/14 ≈ 28.6% of the time.
    const SAMPLES = 4000;
    let symbolInFirstFour = 0;

    for (let i = 0; i < SAMPLES; i += 1) {
      const password = generateTemporaryPassword();
      if (/[!@#$%]/.test(password.slice(0, 4))) symbolInFirstFour += 1;
    }

    const rate = symbolInFirstFour / SAMPLES;

    // Observed rate sits well above the uniform expectation, confirming the
    // positional bias. Recorded as a range so the test is not flaky.
    expect(rate).toBeGreaterThan(0.35);

    // When this is switched to a real shuffle, `rate` drops toward 0.286 and
    // this assertion fails — that is the signal to delete this test.
  });
});
