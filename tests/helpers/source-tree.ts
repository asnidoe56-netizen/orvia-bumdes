import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const PROJECT_ROOT = join(__dirname, "..", "..");
export const SRC_ROOT = join(PROJECT_ROOT, "src");

/** Repo-relative path with forward slashes, so assertions read the same on Windows and Linux. */
function toPosixPath(absolutePath: string) {
  return relative(PROJECT_ROOT, absolutePath).split(sep).join("/");
}

function walk(directory: string, out: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(toPosixPath(full));
    }
  }
  return out;
}

let cachedTree: string[] | null = null;

/** Every .ts/.tsx file under src/, repo-relative and sorted. */
export function listSourceFiles() {
  cachedTree ??= walk(SRC_ROOT).sort();
  return cachedTree;
}

const fileCache = new Map<string, string>();

export function readSource(posixPath: string) {
  const cached = fileCache.get(posixPath);
  if (cached !== undefined) return cached;

  // Strip the UTF-8 BOM so `startsWith`/regex checks are not thrown off by it.
  // 220 of 316 source files in this repo carry one.
  const content = readFileSync(join(PROJECT_ROOT, posixPath), "utf8").replace(
    /^﻿/,
    "",
  );
  fileCache.set(posixPath, content);
  return content;
}

/** Files carrying the "use server" directive — i.e. every Server Action module. */
export function listServerActionFiles() {
  return listSourceFiles().filter((file) =>
    /^\s*["']use server["']/m.test(readSource(file)),
  );
}

/** Route Handlers: any src/app/**\/route.ts */
export function listApiRouteFiles() {
  return listSourceFiles().filter((file) => file.endsWith("/route.ts"));
}

/** Server Components that define a route: any src/app/**\/page.tsx */
export function listPageFiles() {
  return listSourceFiles().filter((file) => file.endsWith("/page.tsx"));
}

/** Client Components — the bundle-shipped surface. */
export function listClientComponentFiles() {
  return listSourceFiles().filter((file) =>
    /^\s*["']use client["']/m.test(readSource(file)),
  );
}

/** Exported async functions in a "use server" module are network-reachable endpoints. */
export function listExportedServerActions(posixPath: string) {
  const source = readSource(posixPath);
  const names: string[] = [];
  const pattern = /export\s+async\s+function\s+([A-Za-z0-9_$]+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }

  return names;
}
