#!/usr/bin/env node
/**
 * Doctor - Pre-deployment validation script
 *
 * Validates:
 * 1. ESM consistency (package.json type, tsup format, dist/index.js presence)
 * 2. Env var parity (code process.env.* vs Terraform env_vars)
 * 3. Server listen address (0.0.0.0:PORT)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let exitCode = 0;
const errors = [];
const warnings = [];

function error(msg) {
  errors.push(msg);
  console.error(`❌ ERROR: ${msg}`);
  exitCode = 1;
}

function warn(msg) {
  warnings.push(msg);
  console.warn(`⚠️  WARNING: ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

function success(msg) {
  console.log(`✅ ${msg}`);
}

// ============================================================================
// 1. ESM Consistency Check
// ============================================================================

function checkESMConsistency() {
  console.log('\n📦 Checking ESM Consistency...\n');

  const appDirs = readdirSync(join(rootDir, 'apps'), { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const app of appDirs) {
    const appPath = join(rootDir, 'apps', app);

    // Check package.json
    const pkgPath = join(appPath, 'package.json');
    if (!existsSync(pkgPath)) {
      warn(`${app}: package.json not found`);
      continue;
    }

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

    // Check type: "module"
    if (pkg.type !== 'module') {
      error(`${app}: package.json missing "type": "module"`);
    }

    // Check tsup.config.ts
    const tsupPath = join(appPath, 'tsup.config.ts');
    if (existsSync(tsupPath)) {
      const tsupContent = readFileSync(tsupPath, 'utf-8');
      if (!tsupContent.includes("format: ['esm']")) {
        error(`${app}: tsup.config.ts should have format: ['esm']`);
      }
    } else {
      warn(`${app}: tsup.config.ts not found`);
    }

    // Check dist/index.js exists
    const distPath = join(appPath, 'dist', 'index.js');
    if (!existsSync(distPath)) {
      error(`${app}: dist/index.js not found - run build first`);
    } else {
      success(`${app}: ESM configuration valid`);
    }
  }
}

// ============================================================================
// 2. Environment Variable Parity Check
// ============================================================================

function checkEnvVarParity() {
  console.log('\n🔐 Checking Environment Variable Parity...\n');

  const appDirs = readdirSync(join(rootDir, 'apps'), { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const app of appDirs) {
    const appPath = join(rootDir, 'apps', app);
    const tfPath = join(rootDir, 'infra', 'terraform', 'services', app, 'main.tf');

    if (!existsSync(tfPath)) {
      info(`${app}: No Terraform config found (skipping)`);
      continue;
    }

    // Extract env vars from code (process.env.*)
    const codeEnvVars = new Set();
    const srcFiles = glob.sync(`${appPath}/src/**/*.ts`, { ignore: '**/node_modules/**' });

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8');
      const matches = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
      for (const match of matches) {
        codeEnvVars.add(match[1]);
      }
    }

    // Extract env vars from Terraform
    const tfContent = readFileSync(tfPath, 'utf-8');
    const tfEnvVars = new Set();

    // Match env_vars block entries
    const envVarMatches = tfContent.matchAll(/^\s+([A-Z_][A-Z0-9_]*)\s*=/gm);
    for (const match of envVarMatches) {
      tfEnvVars.add(match[1]);
    }

    // Compare
    const missingInTerraform = [...codeEnvVars].filter(v => !tfEnvVars.has(v));
    const unusedInCode = [...tfEnvVars].filter(v => !codeEnvVars.has(v));

    // Filter out common vars that might be set by Cloud Run or infra
    const ignoredVars = new Set(['PORT', 'NODE_ENV', 'PATH', 'HOME', 'USER']);

    const actualMissing = missingInTerraform.filter(v => !ignoredVars.has(v));

    if (actualMissing.length > 0) {
      warn(`${app}: Env vars in code but not in Terraform: ${actualMissing.join(', ')}`);
    }

    if (unusedInCode.length > 0) {
      info(`${app}: Env vars in Terraform but not used in code: ${unusedInCode.join(', ')}`);
    }

    if (actualMissing.length === 0) {
      success(`${app}: Env var parity OK (${codeEnvVars.size} vars checked)`);
    }
  }
}

// ============================================================================
// 3. Server Listen Address Check
// ============================================================================

function checkServerListen() {
  console.log('\n🌐 Checking Server Listen Address...\n');

  const appDirs = readdirSync(join(rootDir, 'apps'), { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const app of appDirs) {
    const appPath = join(rootDir, 'apps', app);
    const srcFiles = glob.sync(`${appPath}/src/**/*.ts`, { ignore: '**/node_modules/**' });

    let foundListen = false;
    let foundCorrectHost = false;

    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf-8');

      // Check for .listen() calls
      if (content.includes('.listen(')) {
        foundListen = true;

        // Check if it's listening on 0.0.0.0 or correct host
        if (
          content.includes("'0.0.0.0'") ||
          content.includes('"0.0.0.0"') ||
          content.includes('host: "0.0.0.0"') ||
          content.includes("host: '0.0.0.0'") ||
          content.match(/listen\(.*PORT.*,\s*['"]0\.0\.0\.0['"]/)
        ) {
          foundCorrectHost = true;
        }

        // Warn about localhost
        if (content.includes("'localhost'") || content.includes('"localhost"')) {
          error(`${app}: Server listening on 'localhost' - should be '0.0.0.0' for containers`);
        }

        // Warn about 127.0.0.1
        if (content.includes("'127.0.0.1'") || content.includes('"127.0.0.1"')) {
          error(`${app}: Server listening on '127.0.0.1' - should be '0.0.0.0' for containers`);
        }
      }
    }

    if (!foundListen) {
      warn(`${app}: No server .listen() found (might be using framework default)`);
    } else if (foundCorrectHost) {
      success(`${app}: Server listen address correct (0.0.0.0)`);
    } else {
      warn(`${app}: Could not verify listen address - check manually`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

console.log('🏥 Doctor - Pre-deployment Validation\n');
console.log('═'.repeat(60));

checkESMConsistency();
checkEnvVarParity();
checkServerListen();

console.log('\n' + '═'.repeat(60));
console.log('\n📊 Summary:\n');

if (errors.length === 0 && warnings.length === 0) {
  success('All checks passed! 🎉');
} else {
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} error(s) found`);
  }
  if (warnings.length > 0) {
    console.warn(`⚠️  ${warnings.length} warning(s) found`);
  }
}

console.log('');
process.exit(exitCode);
