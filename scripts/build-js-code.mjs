#!/usr/bin/env node
import crypto from "node:crypto";
import { builtinModules, createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptFile = fileURLToPath(import.meta.url);
const defaultRootDir = fileURLToPath(new URL("..", import.meta.url));
const rootDir = path.resolve(process.env.OPENXIANGDA_WORKSPACE_ROOT || defaultRootDir);
const args = process.argv.slice(2);
const require = createRequire(import.meta.url);
const ts = require("typescript");
const CACHE_VERSION = 4;
const builderFingerprint = crypto
  .createHash("sha256")
  .update(readFileSync(scriptFile))
  .digest("hex");
const workspaceBuilderFile = path.join(rootDir, "scripts", "build-js-code.mjs");
const workspaceBuilderMatches =
  existsSync(workspaceBuilderFile) &&
  crypto.createHash("sha256").update(readFileSync(workspaceBuilderFile)).digest("hex") ===
    builderFingerprint;
const cacheFileName =
  path.resolve(defaultRootDir) !== rootDir && !workspaceBuilderMatches
    ? "build-cache.cli-v4.json"
    : "build-cache.json";
const CACHE_FILE = path.join(rootDir, ".openxiangda", cacheFileName);
const CACHE_LOCK_FILE = `${CACHE_FILE}.lock`;
const TSCONFIG_FILE = path.join(rootDir, "tsconfig.js-code-nodes.json");
const forceBuild = args.includes("--force") || args.includes("--no-cache");

const sourceKinds = {
  "js-code-nodes": {
    name: "js-code-nodes",
    sourceRoot: path.join(rootDir, "src", "js-code-nodes"),
    outputRoot: path.join(rootDir, "dist", "js-code-nodes"),
    label: "JS_CODE",
  },
  automations: {
    name: "automations",
    sourceRoot: path.join(rootDir, "src", "automations"),
    outputRoot: path.join(rootDir, "dist", "automations"),
    label: "automation code",
  },
  functions: {
    name: "functions",
    sourceRoot: path.join(rootDir, "src", "functions"),
    outputRoot: path.join(rootDir, "dist", "functions"),
    label: "app function",
  },
};

function readArgs(name) {
  const result = [];
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith(prefix)) {
      result.push(arg.slice(prefix.length));
    } else if (arg === flag && args[index + 1] && !args[index + 1].startsWith("--")) {
      result.push(args[index + 1]);
      index += 1;
    }
  }
  return result;
}

function splitScriptSpecs(values) {
  return values.flatMap((value) => String(value).split(",")).map((value) => value.trim()).filter(Boolean);
}

function assertScriptCode(scriptCode) {
  if (
    !scriptCode ||
    scriptCode === "." ||
    scriptCode === ".." ||
    scriptCode.includes("/") ||
    scriptCode.includes("\\")
  ) {
    throw new Error(`invalid script code: ${scriptCode || "<empty>"}`);
  }
}

function listScriptCodes(kind) {
  if (!existsSync(kind.sourceRoot)) return [];
  return readdirSync(kind.sourceRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        ["index.ts", "index.tsx"].some((name) =>
          existsSync(path.join(kind.sourceRoot, entry.name, name)),
        ),
    )
    .map((entry) => entry.name)
    .sort();
}

function targetEntryFile(target) {
  const base = path.join(target.kind.sourceRoot, target.scriptCode);
  return ["index.ts", "index.tsx"]
    .map((name) => path.join(base, name))
    .find((file) => existsSync(file)) || path.join(base, "index.ts");
}

function parseScriptSpec(rawSpec, defaultKind) {
  const prefixed = String(rawSpec).match(/^(js-code-nodes|automations|functions)[:/](.+)$/);
  const requestedKind = prefixed?.[1] || defaultKind?.name;
  const scriptCode = prefixed?.[2] || String(rawSpec);
  assertScriptCode(scriptCode);

  if (prefixed && defaultKind && requestedKind !== defaultKind.name) {
    throw new Error(`script ${rawSpec} conflicts with --source ${defaultKind.name}`);
  }
  if (requestedKind) return { kind: sourceKinds[requestedKind], scriptCode };

  const matches = Object.values(sourceKinds).filter((kind) =>
    ["index.ts", "index.tsx"].some((name) =>
      existsSync(path.join(kind.sourceRoot, scriptCode, name)),
    ),
  );
  if (matches.length > 1) {
    console.warn(
      `[build-js-code] ${scriptCode} exists in multiple sources; using ${matches[0].name}. Pass --source or a functions:${scriptCode} style target to disambiguate.`,
    );
  }
  return { kind: matches[0] || sourceKinds["js-code-nodes"], scriptCode };
}

function resolveBuildSelection() {
  const sourceArgs = readArgs("source");
  const sourceNames = [...new Set(sourceArgs)];
  if (sourceNames.length > 1) throw new Error("--source may only select one source kind");
  const selectedKind = sourceNames[0] ? sourceKinds[sourceNames[0]] : undefined;
  if (sourceNames[0] && !selectedKind) {
    throw new Error(
      `unsupported source: ${sourceNames[0]}. Expected js-code-nodes, automations, or functions`,
    );
  }

  const specs = splitScriptSpecs([...readArgs("script"), ...readArgs("scripts")]);
  const targets = specs.length > 0
    ? specs.map((spec) => parseScriptSpec(spec, selectedKind))
    : (selectedKind ? [selectedKind] : Object.values(sourceKinds)).flatMap((kind) =>
        listScriptCodes(kind).map((scriptCode) => ({ kind, scriptCode })),
      );
  return {
    scoped: specs.length > 0,
    targets: [...new Map(targets.map((target) => [`${target.kind.name}/${target.scriptCode}`, target])).values()],
  };
}

function packageVersion(name) {
  try {
    return require(`${name}/package.json`).version || "unknown";
  } catch {
    return "unknown";
  }
}

const toolFingerprint = crypto
  .createHash("sha256")
  .update(
    JSON.stringify({
      cacheVersion: CACHE_VERSION,
      builder: builderFingerprint,
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      vite: packageVersion("vite"),
      typescript: packageVersion("typescript"),
      target: "node20",
      format: "cjs",
      sourcemap: true,
    }),
  )
  .digest("hex");

function emptyCache() {
  return {
    version: CACHE_VERSION,
    toolFingerprint,
    typecheck: null,
    typechecks: {},
    targets: {},
  };
}

function readCache(file = CACHE_FILE) {
  try {
    const cache = JSON.parse(readFileSync(file, "utf8"));
    if (cache.version !== CACHE_VERSION) return emptyCache();
    return {
      ...emptyCache(),
      ...cache,
      typechecks: cache.typechecks || {},
      targets: cache.targets || {},
    };
  } catch {
    return emptyCache();
  }
}

function walkFiles(dir, result = []) {
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(file, result);
    else if (entry.isFile()) result.push(file);
  }
  return result;
}

function relativeWorkspaceFile(file) {
  const relative = path.relative(rootDir, file);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (
    relative === "dist" ||
    relative.startsWith(`dist${path.sep}`) ||
    relative === "node_modules" ||
    relative.startsWith(`node_modules${path.sep}`) ||
    relative === ".openxiangda" ||
    relative.startsWith(`.openxiangda${path.sep}`)
  ) {
    return null;
  }
  return relative.split(path.sep).join("/");
}

function hashFileSet(files, context) {
  const hash = crypto.createHash("sha256");
  hash.update(`${toolFingerprint}\0${context}\0`);
  for (const file of [...new Set(files)].sort()) {
    const absolute = path.resolve(rootDir, file);
    hash.update(`${file}\0`);
    if (existsSync(absolute) && statSync(absolute).isFile()) hash.update(readFileSync(absolute));
    else hash.update("<missing>");
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sourceFileSetHash(files, context) {
  const hash = crypto.createHash("sha256");
  hash.update(`source-lineage-v1\0${context}\0`);
  for (const file of [...new Set(files)].sort()) {
    const absolute = path.resolve(rootDir, file);
    hash.update(`${file}\0`);
    if (existsSync(absolute) && statSync(absolute).isFile()) hash.update(readFileSync(absolute));
    else hash.update("<missing>");
    hash.update("\0");
  }
  return hash.digest("hex");
}

function configInputFiles() {
  return [
    "package.json",
    "tsconfig.js-code-nodes.json",
    "pnpm-lock.yaml",
    "package-lock.json",
    "yarn.lock",
    "bun.lock",
    "bun.lockb",
    relativeWorkspaceFile(scriptFile),
  ].filter(Boolean);
}

function typecheckInputHash() {
  const sourceFiles = walkFiles(path.join(rootDir, "src"))
    .filter((file) => /\.(?:[cm]?ts|tsx|json)$/.test(file))
    .map(relativeWorkspaceFile)
    .filter(Boolean);
  return hashFileSet([...configInputFiles(), ...sourceFiles], "typecheck");
}

function targetInputHash(target, dependencies) {
  const entry = relativeWorkspaceFile(targetEntryFile(target));
  return hashFileSet(
    [...configInputFiles(), entry, ...(dependencies || [])].filter(Boolean),
    `target:${target.kind.name}/${target.scriptCode}`,
  );
}

function outputFile(target) {
  return path.join(target.kind.outputRoot, target.scriptCode, "index.cjs");
}

function sha256File(file) {
  return crypto.createHash("sha256").update(readFileSync(file)).digest("hex");
}

function isTargetCacheHit(cache, target) {
  if (forceBuild || cache.toolFingerprint !== toolFingerprint) return false;
  const key = `${target.kind.name}/${target.scriptCode}`;
  const metadata = cache.targets[key];
  const output = outputFile(target);
  if (!metadata || !Array.isArray(metadata.dependencies) || !existsSync(output)) return false;
  return (
    metadata.inputHash === targetInputHash(target, metadata.dependencies) &&
    metadata.outputHash === sha256File(output)
  );
}

function formatTypeScriptDiagnostics(diagnostics) {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => rootDir,
    getNewLine: () => "\n",
  });
}

function scopedTypecheckKey(targets) {
  return targets
    .map((target) => `${target.kind.name}/${target.scriptCode}`)
    .sort()
    .join(",");
}

function scopedAmbientDeclarationFiles() {
  return walkFiles(path.join(rootDir, "src"))
    .filter((file) => file.endsWith(".d.ts"))
    .map(relativeWorkspaceFile)
    .filter(Boolean);
}

function createScopedTypecheckProgram(targets) {
  const loaded = ts.readConfigFile(TSCONFIG_FILE, ts.sys.readFile);
  if (loaded.error) {
    process.stderr.write(formatTypeScriptDiagnostics([loaded.error]));
    throw new Error("JS_CODE scoped TypeScript config validation failed");
  }
  const files = [
    ...targets.map((target) =>
      relativeWorkspaceFile(targetEntryFile(target)),
    ),
    ...scopedAmbientDeclarationFiles(),
  ].filter(Boolean);
  const parsed = ts.parseJsonConfigFileContent(
    { ...loaded.config, files, include: [] },
    ts.sys,
    rootDir,
    { noEmit: true },
    TSCONFIG_FILE,
  );
  if (parsed.errors.length > 0) {
    process.stderr.write(formatTypeScriptDiagnostics(parsed.errors));
    throw new Error("JS_CODE scoped TypeScript config validation failed");
  }
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
}

function scopedTypecheckInputHash(program, cacheKey) {
  const sourceFiles = program
    .getSourceFiles()
    .map((sourceFile) => relativeWorkspaceFile(sourceFile.fileName))
    .filter(Boolean);
  return hashFileSet([...configInputFiles(), ...sourceFiles], `typecheck:${cacheKey}`);
}

function typecheckSelectedScripts(cache, targets) {
  const cacheKey = scopedTypecheckKey(targets);
  const program = createScopedTypecheckProgram(targets);
  const inputHash = scopedTypecheckInputHash(program, cacheKey);
  if (
    !forceBuild &&
    cache.toolFingerprint === toolFingerprint &&
    cache.typechecks?.[cacheKey]?.inputHash === inputHash
  ) {
    console.log(`[build-js-code] scoped TypeScript validation cache hit (${targets.length} selected)`);
    return { cacheHit: true, cacheKey, inputHash, mode: "scoped" };
  }

  console.log(`[build-js-code] validating TypeScript for ${targets.length} selected target(s)...`);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length > 0) {
    process.stderr.write(formatTypeScriptDiagnostics(diagnostics));
    throw new Error("JS_CODE scoped TypeScript validation failed");
  }
  console.log("[build-js-code] scoped TypeScript validation passed");
  return { cacheHit: false, cacheKey, inputHash, mode: "scoped" };
}

function typecheckAllScripts(cache) {
  const inputHash = typecheckInputHash();
  if (!forceBuild && cache.toolFingerprint === toolFingerprint && cache.typecheck?.inputHash === inputHash) {
    console.log("[build-js-code] TypeScript validation cache hit");
    return { cacheHit: true, inputHash, mode: "full" };
  }

  console.log("[build-js-code] validating TypeScript once for this batch...");
  const result = spawnSync(
    "pnpm",
    ["exec", "tsc", "-p", "tsconfig.js-code-nodes.json", "--noEmit"],
    { cwd: rootDir, stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("JS_CODE TypeScript validation failed");
  console.log("[build-js-code] TypeScript validation passed");
  // pnpm may materialize/update a lockfile on the first invocation. Record the
  // post-validation inputs so the next process can reuse this successful tsc.
  return { cacheHit: false, inputHash: typecheckInputHash(), mode: "full" };
}

function typecheckScripts(cache, targets, scoped) {
  return scoped
    ? typecheckSelectedScripts(cache, targets)
    : typecheckAllScripts(cache);
}

function collectBuildDependencies(buildResult, entry) {
  const files = new Set([relativeWorkspaceFile(entry)]);
  const outputs = Array.isArray(buildResult) ? buildResult : [buildResult];
  for (const output of outputs) {
    for (const item of output?.output || []) {
      for (const rawId of Object.keys(item.modules || {})) {
        const moduleId = rawId.replace(/^\0/, "").split("?")[0];
        if (!path.isAbsolute(moduleId)) continue;
        const relative = relativeWorkspaceFile(moduleId);
        if (relative) files.add(relative);
      }
    }
  }
  return [...files].filter(Boolean).sort();
}

async function buildScript(target) {
  const { kind, scriptCode } = target;
  const entry = targetEntryFile(target);
  if (!existsSync(entry)) throw new Error(`${kind.label} script not found: ${entry}`);
  const outDir = path.join(kind.outputRoot, scriptCode);
  const external = Array.from(
    new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]),
  );
  const buildResult = await build({
    configFile: false,
    root: rootDir,
    logLevel: "warn",
    resolve: { alias: { "@": path.join(rootDir, "src") } },
    build: {
      ssr: entry,
      outDir,
      emptyOutDir: true,
      target: "node20",
      minify: false,
      sourcemap: true,
      rollupOptions: {
        external,
        output: {
          format: "cjs",
          entryFileNames: "index.cjs",
          inlineDynamicImports: true,
          exports: "auto",
        },
      },
    },
  });
  const dependencies = collectBuildDependencies(buildResult, entry);
  const entryRelative = relativeWorkspaceFile(entry);
  const output = outputFile(target);
  return {
    inputHash: targetInputHash(target, dependencies),
    sourceHash: sourceFileSetHash(
      [entryRelative, ...dependencies].filter(Boolean),
      `target:${target.kind.name}/${target.scriptCode}`,
    ),
    outputHash: sha256File(output),
    dependencies,
    output: relativeWorkspaceFile(output) || path.relative(rootDir, output),
    builtAt: new Date().toISOString(),
  };
}

function acquireCacheLock() {
  mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      const fd = openSync(CACHE_LOCK_FILE, "wx", 0o600);
      writeFileSync(fd, `${process.pid}\n`);
      return fd;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(CACHE_LOCK_FILE).mtimeMs > 30_000) unlinkSync(CACHE_LOCK_FILE);
      } catch (statError) {
        if (statError.code !== "ENOENT") throw statError;
      }
      if (Date.now() - startedAt > 15_000) throw new Error(`build cache lock timeout: ${CACHE_LOCK_FILE}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15);
    }
  }
}

function saveCache(typecheck, updatedTargets) {
  if (typecheck.cacheHit && updatedTargets.size === 0) return;
  const lockFd = acquireCacheLock();
  try {
    const stored = readCache();
    // A scoped build updates only part of the cache. Never carry metadata from
    // a different compiler/builder fingerprint into the new cache, otherwise
    // untouched targets could become false hits after this process stamps the
    // cache with the current fingerprint.
    const latest = stored.toolFingerprint === toolFingerprint
      ? stored
      : emptyCache();
    const validatedAt = new Date().toISOString();
    const mergedTypechecks = { ...latest.typechecks };
    if (!typecheck.cacheHit && typecheck.mode === "scoped") {
      mergedTypechecks[typecheck.cacheKey] = {
        inputHash: typecheck.inputHash,
        validatedAt,
      };
    }
    const merged = {
      ...latest,
      version: CACHE_VERSION,
      toolFingerprint,
      typecheck:
        !typecheck.cacheHit && typecheck.mode === "full"
          ? { inputHash: typecheck.inputHash, validatedAt }
          : latest.typecheck,
      typechecks: mergedTypechecks,
      targets: { ...latest.targets, ...Object.fromEntries(updatedTargets) },
    };
    const tempFile = `${CACHE_FILE}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
    let tempFd;
    try {
      tempFd = openSync(tempFile, "wx", 0o600);
      writeFileSync(tempFd, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
      fsyncSync(tempFd);
      closeSync(tempFd);
      tempFd = undefined;
      renameSync(tempFile, CACHE_FILE);
    } finally {
      if (tempFd !== undefined) closeSync(tempFd);
      try {
        unlinkSync(tempFile);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  } finally {
    closeSync(lockFd);
    try {
      unlinkSync(CACHE_LOCK_FILE);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

const { scoped, targets } = resolveBuildSelection();
if (targets.length === 0) {
  console.log(
    "no JS_CODE scripts found under src/js-code-nodes/<scriptCode>/index.ts, src/automations/<scriptCode>/index.ts, or src/functions/<functionCode>/index.ts",
  );
  process.exit(0);
}

const cache = readCache();
const typecheck = typecheckScripts(cache, targets, scoped);
const updatedTargets = new Map();
let builtCount = 0;
let cachedCount = 0;

for (const [index, target] of targets.entries()) {
  const key = `${target.kind.name}/${target.scriptCode}`;
  const progress = `[${index + 1}/${targets.length}]`;
  if (isTargetCacheHit(cache, target)) {
    cachedCount += 1;
    console.log(`[build-js-code] ${progress} cached ${key}`);
    continue;
  }
  console.log(`[build-js-code] ${progress} building ${key}`);
  updatedTargets.set(key, await buildScript(target));
  builtCount += 1;
  console.log(`[build-js-code] ${progress} built ${key} -> ${path.relative(rootDir, outputFile(target))}`);
}

saveCache(typecheck, updatedTargets);
console.log(`[build-js-code] complete: ${builtCount} built, ${cachedCount} cached, ${targets.length} total`);
