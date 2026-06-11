/* eslint-disable import/no-nodejs-modules */
/* eslint-disable @typescript-eslint/no-require-imports */
const child_process = typeof require !== 'undefined' ? require('child_process') : null;
const fs = typeof require !== 'undefined' ? require('fs') : null;
const path = typeof require !== 'undefined' ? require('path') : null;

const LinterService = {
    isSupported() {
        return !!(child_process && fs && path);
    },

    getAbsoluteVaultPath(dc) {
        if (!dc || !dc.app || !dc.app.vault || !dc.app.vault.adapter) return "";
        if (typeof dc.app.vault.adapter.getBasePath === 'function') {
            return dc.app.vault.adapter.getBasePath();
        }
        // Fallback if getBasePath is not a function
        return dc.app.vault.adapter.path || "";
    },

    async checkInstallation(dc, cacheDir) {
        if (!this.isSupported()) return { eslintInstalled: false, pluginInstalled: false };
        
        const vaultPath = this.getAbsoluteVaultPath(dc);
        const absoluteCachePath = path.join(vaultPath, cacheDir);
        
        const eslintDir = path.join(absoluteCachePath, 'node_modules', 'eslint');
        const pluginDir = path.join(absoluteCachePath, 'node_modules', 'eslint-plugin-obsidianmd');

        const eslintInstalled = await new Promise((resolve) => {
            fs.stat(eslintDir, (err, stats) => {
                resolve(!err && stats.isDirectory());
            });
        });

        const pluginInstalled = await new Promise((resolve) => {
            fs.stat(pluginDir, (err, stats) => {
                resolve(!err && stats.isDirectory());
            });
        });

        // Try reading installed plugin version from package.json
        let localVersion = null;
        if (pluginInstalled) {
            try {
                const pkgJsonPath = path.join(pluginDir, 'package.json');
                const pkgContent = await fs.promises.readFile(pkgJsonPath, 'utf8');
                const pkg = JSON.parse(pkgContent);
                localVersion = pkg.version;
            } catch (e) {
                console.error("Failed to read local plugin package.json:", e);
            }
        }

        return { eslintInstalled, pluginInstalled, localVersion };
    },

    async installESLint(dc, cacheDir, onStdout, onStderr) {
        if (!this.isSupported()) throw new Error("Node process execution is not supported in this environment.");

        const vaultPath = this.getAbsoluteVaultPath(dc);
        const absoluteCachePath = path.join(vaultPath, cacheDir);

        // Ensure cache dir exists
        await fs.promises.mkdir(absoluteCachePath, { recursive: true });

        // Initialize simple package.json if it doesn't exist
        const packageJsonPath = path.join(absoluteCachePath, 'package.json');
        const hasPackageJson = await new Promise((resolve) => {
            fs.access(packageJsonPath, fs.constants.F_OK, (err) => resolve(!err));
        });

        if (!hasPackageJson) {
            const initialPkg = {
                name: "eslint-verifier-cache",
                version: "1.0.0",
                private: true,
                dependencies: {}
            };
            await fs.promises.writeFile(packageJsonPath, JSON.stringify(initialPkg, null, 2));
        }

        return new Promise((resolve, reject) => {
            onStdout("Starting installation of eslint and eslint-plugin-obsidianmd...\n");
            
            // Construct environment path fallback to include node, NVM, and Homebrew paths
            const envPath = [
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                path.join(process.env.HOME || "/Users/blackbird", ".nvm/versions/node/v20.19.5/bin"),
                process.env.PATH || ""
            ].filter(Boolean).join(path.delimiter);

            // Run npm install in target folder
            const child = child_process.spawn('npm', [
                'install', 
                '--no-audit', 
                '--no-fund', 
                'eslint@latest', 
                'eslint-plugin-obsidianmd@latest'
            ], {
                cwd: absoluteCachePath,
                shell: true,
                env: {
                    ...process.env,
                    PATH: envPath
                }
            });

            child.stdout.on('data', (data) => {
                onStdout(data.toString());
            });

            child.stderr.on('data', (data) => {
                onStderr(data.toString());
            });

            child.on('close', (code) => {
                if (code === 0) {
                    onStdout("Installation completed successfully!\n");
                    resolve(true);
                } else {
                    reject(new Error(`Installation failed with exit code ${code}`));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    },

    async getLatestPluginVersion() {
        try {
            const res = await window.requestUrl({ url: 'https://registry.npmjs.org/eslint-plugin-obsidianmd/latest' });
            return res.json.version;
        } catch (err) {
            console.error("Failed to query NPM registry:", err);
            return null;
        }
    },

    async hasLintableFiles(dir, extensions = ['.js', '.jsx', '.mjs']) {
        if (!fs) return false;
        try {
            const files = await fs.promises.readdir(dir);
            for (const file of files) {
                if (file === 'node_modules' || file === '.git' || file === 'data') continue;
                const fullPath = path.join(dir, file);
                const stat = await fs.promises.stat(fullPath);
                if (stat.isDirectory()) {
                    const hasSome = await this.hasLintableFiles(fullPath, extensions);
                    if (hasSome) return true;
                } else if (stat.isFile()) {
                    const ext = path.extname(file).toLowerCase();
                    if (extensions.includes(ext)) {
                        return true;
                    }
                }
            }
        } catch (err) {
            console.error(`[ESLintVerifier] readdir/stat failed for path "${dir}":`, err);
        }
        return false;
    },

    async findFolderInVault(vaultPath, folderName) {
        if (!fs) return null;
        try {
            const items = await fs.promises.readdir(vaultPath);
            for (const item of items) {
                if (item === 'node_modules' || item === '.git' || item === 'data' || item.startsWith('.')) continue;
                const fullPath = path.join(vaultPath, item);
                const stat = await fs.promises.stat(fullPath);
                if (stat.isDirectory()) {
                    if (item.toLowerCase() === folderName.toLowerCase()) {
                        return fullPath;
                    }
                    const subResult = await this.findFolderInVault(fullPath, folderName);
                    if (subResult) return subResult;
                }
            }
        } catch (err) {
            console.error("findFolderInVault error:", err);
        }
        return null;
    },

    async runLint(dc, cacheDir, targetPath, fix = false, onStdout = null, onStderr = null) {
        if (!this.isSupported()) throw new Error("Node process execution is not supported.");

        const vaultPath = this.getAbsoluteVaultPath(dc);
        const absoluteCachePath = path.join(vaultPath, cacheDir);
        
        let targetSubPath = targetPath;
        let absoluteTargetPath = path.join(vaultPath, targetSubPath);

        // Check if directory exists, if not search for it recursively in the vault
        let exists = await new Promise((resolve) => {
            fs.access(absoluteTargetPath, fs.constants.F_OK, (err) => resolve(!err));
        });

        if (!exists && targetPath) {
            const pathParts = targetPath.split(/[/\\]+/).filter(Boolean);
            const searchName = pathParts[pathParts.length - 1];
            if (searchName) {
                if (onStdout) {
                    onStdout(`Target folder not found at "${targetPath}". Searching vault recursively for "${searchName}"...\n`);
                }
                const foundPath = await this.findFolderInVault(vaultPath, searchName);
                if (foundPath) {
                    absoluteTargetPath = foundPath;
                    targetSubPath = foundPath.substring(vaultPath.length).replace(/^[/\\]+/, '');
                    if (onStdout) {
                        onStdout(`Located target folder at: ${targetSubPath}\n`);
                    }
                    exists = true;
                }
            }
        }

        // Check if there are any lintable files in target directory. If not, look in common paths.
        let hasFiles = await this.hasLintableFiles(absoluteTargetPath);
        if (!hasFiles) {
            const commonPaths = [
                path.join('_RESOURCES', 'DATACORE', '_DONE', targetPath),
                path.join('_RESOURCES', 'DATACORE', targetPath),
                path.join('_RESOURCES', targetPath)
            ];
            for (const candidate of commonPaths) {
                const candidateAbs = path.join(vaultPath, candidate);
                if (await this.hasLintableFiles(candidateAbs)) {
                    targetSubPath = candidate;
                    absoluteTargetPath = candidateAbs;
                    hasFiles = true;
                    if (onStdout) {
                        onStdout(`Target folder resolved to component subdirectory: ${candidate}\n`);
                    }
                    break;
                }
            }
        }

        if (!hasFiles) {
            if (onStdout) {
                onStdout("No lintable files (.js, .jsx, .mjs) found in target directory. Skipping scan.\n");
            }
            return { results: [], rawStderr: "", resolvedPath: targetSubPath };
        }

        // Verify ESLint binary exists
        const eslintBin = path.join(absoluteCachePath, 'node_modules', 'eslint', 'bin', 'eslint.js');
        const hasBin = await new Promise((resolve) => {
            fs.access(eslintBin, fs.constants.F_OK, (err) => resolve(!err));
        });
        if (!hasBin) throw new Error("ESLint binary not found. Please install first.");

        // Check if manifest.json exists in target folder, if not create a temporary dummy
        const targetManifestPath = path.join(absoluteTargetPath, 'manifest.json');
        const hasManifest = await new Promise((resolve) => {
            fs.access(targetManifestPath, fs.constants.F_OK, (err) => resolve(!err));
        });

        if (!hasManifest) {
            const dummyManifest = {
                id: "eslint-verifier-dummy",
                name: "ESLint Verifier Dummy",
                version: "1.0.0",
                minAppVersion: "1.4.11",
                description: "Dummy manifest to satisfy eslint-plugin-obsidianmd load requirements.",
                author: "beto.group",
                isDesktopOnly: false
            };
            // Ensure target directory exists before writing manifest
            await fs.promises.mkdir(absoluteTargetPath, { recursive: true });
            await fs.promises.writeFile(targetManifestPath, JSON.stringify(dummyManifest, null, 2));
        }

        // Generate dynamic configuration file inside the cache folder (keeping it inside the ESLint folder)
        const configPath = path.join(absoluteCachePath, 'temp-eslint-config.mjs');
        
        // Escape paths for JS import string literals (Windows compatibility)
        const cachePluginPath = path.join(absoluteCachePath, 'node_modules', 'eslint-plugin-obsidianmd', 'dist', 'lib', 'index.js').replace(/\\/g, '/');
        const cacheJsPath = path.join(absoluteCachePath, 'node_modules', '@eslint/js', 'src', 'index.js').replace(/\\/g, '/');

        const configContent = `
import obsidianmd from '${cachePluginPath}';
import js from '${cacheJsPath}';

export default [
  {
    ignores: [
      '**/temp-eslint-config.mjs',
      '**/manifest.json',
      '**/node_modules/**',
      '**/data/**'
    ]
  },
  js.configs.recommended,
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        dc: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'warn',
      // Disable TypeScript parser rules for plain JS/JSX files
      'obsidianmd/no-plugin-as-component': 'off',
      'obsidianmd/no-view-references-in-plugin': 'off',
      'obsidianmd/no-unsupported-api': 'off',
      'obsidianmd/prefer-file-manager-trash-file': 'off',
      'obsidianmd/prefer-instanceof': 'off',
      '@typescript-eslint/no-deprecated': 'off'
    }
  }
];
`;
        await fs.promises.writeFile(configPath, configContent);

        return new Promise((resolve, reject) => {
            const args = [
                eslintBin,
                '--config', configPath,
                '--format', 'json',
                '--no-warn-ignored',
                '.'
            ];

            if (fix) {
                args.push('--fix');
            }

            // Construct environment path fallback to include node, NVM, and Homebrew paths
            const envPath = [
                "/opt/homebrew/bin",
                "/usr/local/bin",
                "/usr/bin",
                "/bin",
                path.join(process.env.HOME || "/Users/blackbird", ".nvm/versions/node/v20.19.5/bin"),
                process.env.PATH || ""
            ].filter(Boolean).join(path.delimiter);

            const child = child_process.spawn('node', args, {
                cwd: absoluteTargetPath,
                shell: false,
                env: {
                    ...process.env,
                    PATH: envPath
                }
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on('data', (data) => {
                const str = data.toString();
                stdout += str;
                if (onStdout) onStdout(str);
            });

            child.stderr.on('data', (data) => {
                const str = data.toString();
                stderr += str;
                if (onStderr) onStderr(str);
            });

            child.on('close', (code) => {
                // Clean up temporary files asynchronously
                fs.unlink(configPath, () => {});
                if (!hasManifest) {
                    fs.unlink(targetManifestPath, () => {});
                }

                if (code === 0 || code === 1) { // ESLint returns 1 if there are lint errors
                    try {
                        const parsed = JSON.parse(stdout.trim());
                        // Map absolute paths back to vault-relative paths for visual clarity
                        const results = parsed.map(fileResult => {
                            let absPath = fileResult.filePath;
                            if (!path.isAbsolute(absPath)) {
                                absPath = path.resolve(absoluteTargetPath, absPath);
                            }
                            let relPath = absPath;
                            if (relPath.startsWith(vaultPath)) {
                                relPath = relPath.substring(vaultPath.length).replace(/^[/\\]+/, '');
                            }
                            return {
                                ...fileResult,
                                filePath: absPath,
                                relativePath: relPath
                            };
                        });
                        resolve({ results, rawStderr: stderr, resolvedPath: targetSubPath });
                    } catch (e) {
                        reject(new Error(`Failed to parse ESLint JSON output: ${e.message}. Raw output: ${stdout}`));
                    }
                } else {
                    reject(new Error(`ESLint process exited with code ${code}. Error: ${stderr || stdout}`));
                }
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    },

    async deleteEnvironment(dc, cacheDir) {
        if (!this.isSupported()) throw new Error("Node process execution is not supported.");

        const vaultPath = this.getAbsoluteVaultPath(dc);
        const absoluteCachePath = path.join(vaultPath, cacheDir);

        const nodeModulesPath = path.join(absoluteCachePath, 'node_modules');
        const packageLockPath = path.join(absoluteCachePath, 'package-lock.json');
        const packageJsonPath = path.join(absoluteCachePath, 'package.json');

        await new Promise((resolve) => {
            fs.rm(nodeModulesPath, { recursive: true, force: true }, () => resolve());
        });
        await new Promise((resolve) => {
            fs.rm(packageLockPath, { force: true }, () => resolve());
        });
        await new Promise((resolve) => {
            fs.rm(packageJsonPath, { force: true }, () => resolve());
        });
        return true;
    }
};

return { LinterService };
