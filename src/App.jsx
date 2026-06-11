const { useState, useEffect, useRef } = dc;

function ESLintVerifier({ folderPath, LinterService }) {
    const [activeTab, setActiveTab] = useState('verifier');
    const [envStatus, setEnvStatus] = useState({ eslintInstalled: false, pluginInstalled: false, localVersion: null, checking: true });
    const [latestVersion, setLatestVersion] = useState(null);
    const [targetPath, setTargetPath] = useState("");
    const [scanning, setScanning] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [consoleLogs, setConsoleLogs] = useState([]);
    const [lintResults, setLintResults] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState("");
    const [ruleFilter, setRuleFilter] = useState("all");
    const [isDragging, setIsDragging] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedIssues, setCopiedIssues] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleteHovered, setIsDeleteHovered] = useState(false);

    const consoleEndRef = useRef(null);
    const cacheDir = folderPath + "/data/cache";

    // Append logs helper
    const log = (msg, isErr = false) => {
        setConsoleLogs((prev) => [...prev, { text: msg, isErr, time: new Date().toLocaleTimeString() }]);
    };

    // Load setup environment
    const checkEnvironment = async () => {
        setEnvStatus(prev => ({ ...prev, checking: true }));
        try {
            const status = await LinterService.checkInstallation(dc, cacheDir);
            setEnvStatus({ ...status, checking: false });
            
            // Check latest registry version in background
            const latest = await LinterService.getLatestPluginVersion();
            setLatestVersion(latest);

            if (latest && status.eslintInstalled && status.pluginInstalled && status.localVersion) {
                if (latest !== status.localVersion) {
                    log(`A newer version of eslint-plugin-obsidianmd is available (local: v${status.localVersion}, latest: v${latest}). Pulling latest version...`);
                    setInstalling(true);
                    try {
                        await LinterService.installESLint(dc, cacheDir, 
                            (stdout) => setConsoleLogs(prev => [...prev, { text: stdout, isErr: false }]),
                            (stderr) => setConsoleLogs(prev => [...prev, { text: stderr, isErr: true }])
                        );
                        const updatedStatus = await LinterService.checkInstallation(dc, cacheDir);
                        setEnvStatus({ ...updatedStatus, checking: false });
                        log(`Successfully updated eslint-plugin-obsidianmd to v${updatedStatus.localVersion}`);
                    } catch (err) {
                        log(`Failed to update to latest plugin version: ${err.message}`, true);
                    } finally {
                        setInstalling(false);
                    }
                }
            }
        } catch (e) {
            log("Error checking cache status: " + e.message, true);
            setEnvStatus(prev => ({ ...prev, checking: false }));
        }
    };

    useEffect(() => {
        checkEnvironment();
    }, []);

    // Auto-scroll console logs
    useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [consoleLogs]);

    // Install ESLint Environment
    const handleInstall = async () => {
        if (installing) return;
        setInstalling(true);
        setConsoleLogs([]);
        log("Initializing local Node package installations...\n");
        try {
            await LinterService.installESLint(dc, cacheDir, 
                (stdout) => setConsoleLogs(prev => [...prev, { text: stdout, isErr: false }]),
                (stderr) => setConsoleLogs(prev => [...prev, { text: stderr, isErr: true }])
            );
            await checkEnvironment();
        } catch (e) {
            log("Installation failed: " + e.message, true);
        } finally {
            setInstalling(false);
        }
    };

    // Delete ESLint Environment Cache
    const handleDeleteEnv = async () => {
        if (installing) return;
        setInstalling(true);
        setConsoleLogs([]);
        log("Deleting local ESLint environment cache...");
        try {
            await LinterService.deleteEnvironment(dc, cacheDir);
            log("Cache successfully deleted.");
            await checkEnvironment();
        } catch (e) {
            log("Failed to delete environment cache: " + e.message, true);
        } finally {
            setInstalling(false);
        }
    };

    // Run ESLint scans
    const handleLint = async (fix = false) => {
        if (!targetPath) {
            log("Please select or drop a target folder to scan.", true);
            return;
        }
        setScanning(true);
        setSelectedFile(null);
        setFileContent("");
        setConsoleLogs([]);
        log(`Executing lint scan on: ${targetPath}${fix ? ' (with --fix enabled)' : ''}`);
        try {
            const { results, resolvedPath } = await LinterService.runLint(dc, cacheDir, targetPath, fix,
                (stdout) => setConsoleLogs(prev => [...prev, { text: stdout, isErr: false }]),
                (stderr) => setConsoleLogs(prev => [...prev, { text: stderr, isErr: true }])
            );
            if (resolvedPath && resolvedPath !== targetPath) {
                setTargetPath(resolvedPath);
            }
            setLintResults(results);
            log(`Lint scan completed. Found ${results.reduce((acc, r) => acc + r.errorCount, 0)} errors and ${results.reduce((acc, r) => acc + r.warningCount, 0)} warnings.`);
        } catch (e) {
            log("Lint execution failed: " + e.message, true);
            new window.Notice("Lint failed. View console logs for details.");
        } finally {
            setScanning(false);
        }
    };

    // File Drag & Drop Handlers
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        let dropPath = null;
        if (e.dataTransfer.files?.length > 0) {
            // Dragged from OS explorer
            const file = e.dataTransfer.files[0];
            dropPath = file.path;
            
            // Map absolute paths back to vault-relative paths if dropped path lies inside vault
            const vaultPath = LinterService.getAbsoluteVaultPath(dc);
            if (dropPath.startsWith(vaultPath)) {
                dropPath = dropPath.substring(vaultPath.length).replace(/^[/\\]+/, '');
            }
        } else {
            // Dragged from Obsidian sidebar
            const textData = e.dataTransfer.getData("text/plain");
            if (textData.startsWith("obsidian://")) {
                try {
                    const url = new URL(textData);
                    const fileParam = url.searchParams.get("file") || url.searchParams.get("path");
                    if (fileParam) dropPath = decodeURIComponent(fileParam);
                } catch (err) {
                    console.error("Error parsing obsidian:// drop data:", err);
                }
            } else {
                const match = textData.match(/\[\[(.*?)\]\]/);
                dropPath = match && match[1] ? match[1] : textData;
            }
        }

        if (dropPath) {
            // Clean paths from trailing viewer notes if any
            if (dropPath.endsWith('.md')) {
                dropPath = dropPath.substring(0, dropPath.lastIndexOf("/"));
            }
            setTargetPath(dropPath);
            log(`Dropped target set to: ${dropPath}`);
        }
    };

    // Load file content for source code preview
    const loadSourcePreview = async (filePath) => {
        try {
            const file = dc.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                const text = await dc.app.vault.read(file);
                setFileContent(text);
            }
        } catch (e) {
            console.error("Failed to read file content for preview:", e);
            setFileContent("");
        }
    };

    // Open file in Obsidian editor at exact line
    const openInObsidian = async (filePath, line = 1, col = 1) => {
        try {
            const file = dc.app.vault.getAbstractFileByPath(filePath);
            if (file) {
                const leaf = dc.app.workspace.getLeaf('tab');
                await leaf.openFile(file);
                
                // Position editor cursor
                const view = leaf.view;
                if (view && typeof view.setEphemeralState === 'function') {
                    view.setEphemeralState({
                        line: line - 1,
                        col: col - 1
                    });
                }
            }
        } catch (e) {
            log("Failed to open note in editor: " + e.message, true);
        }
    };

    // Copy lint issues as formatted text to clipboard
    const copyIssuesText = async () => {
        if (!lintResults) return;
        const text = lintResults
            .filter(f => f.errorCount > 0 || f.warningCount > 0)
            .map(fileResult => {
                const fileHeader = `File: ${fileResult.relativePath}`;
                const messages = fileResult.messages
                    .filter(msg => ruleFilter === 'all' || msg.ruleId === ruleFilter)
                    .map(msg => `  [${msg.severity === 2 ? 'ERROR' : 'WARNING'}] Line ${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId || 'syntax'})`)
                    .join('\n');
                return `${fileHeader}\n${messages}`;
            })
            .filter(str => str.includes('\n'))
            .join('\n\n');

        if (!text) {
            log("No lint issues to copy.");
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            setCopiedIssues(true);
            window.setTimeout(() => setCopiedIssues(false), 2000);
            log("Lint issues copied to clipboard.");
        } catch (err) {
            log("Failed to copy issues: " + err.message, true);
        }
    };


    // Stats calculations
    const totalFilesScanned = lintResults ? lintResults.length : 0;
    const totalErrors = lintResults ? lintResults.reduce((acc, r) => acc + r.errorCount, 0) : 0;
    const totalWarnings = lintResults ? lintResults.reduce((acc, r) => acc + r.warningCount, 0) : 0;

    // Rules summary extraction for filter select
    const getScannedRules = () => {
        if (!lintResults) return [];
        const rules = new Set();
        lintResults.forEach(r => {
            r.messages.forEach(msg => {
                if (msg.ruleId) rules.add(msg.ruleId);
            });
        });
        return Array.from(rules).sort();
    };

    const scannedRules = getScannedRules();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--background-primary)',
            color: 'var(--text-normal)',
            fontFamily: 'var(--font-interface), sans-serif',
            overflow: 'hidden'
        }}>
            {/* Header Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: '1px solid var(--background-modifier-border)',
                backgroundColor: 'var(--background-secondary)',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        fontSize: '24px',
                        color: 'var(--interactive-accent)',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <dc.Icon icon="shield-alert" />
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '18px', letterSpacing: '-0.02em' }}>ESLint Verifier</div>
                    <div style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--background-modifier-border)',
                        color: 'var(--text-muted)'
                    }}>
                        {envStatus.localVersion ? `v${envStatus.localVersion}` : 'Not Installed'}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={() => setActiveTab('verifier')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'verifier' ? 'var(--background-modifier-hover)' : 'transparent',
                            color: activeTab === 'verifier' ? 'var(--text-normal)' : 'var(--text-muted)',
                            fontWeight: '500',
                            fontSize: '13px'
                        }}
                    >
                        Verifier
                    </button>
                    <button 
                        onClick={() => setActiveTab('console')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'console' ? 'var(--background-modifier-hover)' : 'transparent',
                            color: activeTab === 'console' ? 'var(--text-normal)' : 'var(--text-muted)',
                            fontWeight: '500',
                            fontSize: '13px'
                        }}
                    >
                        Log Console
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            backgroundColor: activeTab === 'settings' ? 'var(--background-modifier-hover)' : 'transparent',
                            color: activeTab === 'settings' ? 'var(--text-normal)' : 'var(--text-muted)',
                            fontWeight: '500',
                            fontSize: '13px'
                        }}
                    >
                        Cache Settings
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {activeTab === 'verifier' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '24px', gap: '20px' }}>
                        {/* Env Warning banner */}
                        {!envStatus.checking && !envStatus.eslintInstalled && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 20px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                color: 'var(--text-normal)',
                                flexShrink: 0
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ color: '#ef4444', display: 'flex' }}><dc.Icon icon="alert-circle" /></div>
                                    <div style={{ fontSize: '13px' }}>Local ESLint environment not found in package cache. Click setup to install dependencies.</div>
                                </div>
                                <button 
                                    onClick={handleInstall}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        border: 'none',
                                        backgroundColor: '#ef4444',
                                        color: '#ffffff',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                    }}
                                >
                                    Install Environment
                                </button>
                            </div>
                        )}

                        {/* Top controls: Drag drop & selects */}
                        <div style={{
                            display: 'flex',
                            gap: '16px',
                            flexShrink: 0
                        }}>
                            {/* Drag-drop or select box */}
                            <div 
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                style={{
                                    flex: 1,
                                    border: isDragging ? '2px dashed var(--interactive-accent)' : '2px dashed var(--background-modifier-border)',
                                    borderRadius: '8px',
                                    padding: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: isDragging ? 'rgba(139, 92, 246, 0.05)' : 'var(--background-secondary)',
                                    transition: 'all 0.2s ease',
                                    cursor: 'default',
                                    minHeight: '120px'
                                }}
                            >
                                <div style={{ fontSize: '32px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex' }}>
                                    <dc.Icon icon="folder" />
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-normal)', textAlign: 'center', marginBottom: '6px' }}>
                                    Drag & Drop Component Folder Here
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    Or choose a folder from the selector below
                                </div>
                            </div>

                            {/* Manual execution panel */}
                            <div style={{
                                width: '320px',
                                backgroundColor: 'var(--background-secondary)',
                                borderRadius: '8px',
                                border: '1px solid var(--background-modifier-border)',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Target Folder</label>
                                    <input 
                                        type="text"
                                        value={targetPath}
                                        onChange={(e) => setTargetPath(e.target.value)}
                                        placeholder="e.g. _RESOURCES/DATACORE/MyComponent"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--background-modifier-border)',
                                            backgroundColor: 'var(--background-primary)',
                                            color: 'var(--text-normal)',
                                            fontSize: '13px',
                                            outline: 'none',
                                            marginBottom: '12px'
                                        }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        onClick={() => handleLint(false)}
                                        disabled={scanning || installing || !envStatus.eslintInstalled}
                                        style={{
                                            flex: 1,
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: 'none',
                                            backgroundColor: 'var(--interactive-accent)',
                                            color: 'var(--text-on-accent)',
                                            fontWeight: '600',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            opacity: (scanning || installing || !envStatus.eslintInstalled) ? 0.6 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        {scanning ? 'Scanning...' : (
                                            <>
                                                <dc.Icon icon="play" />
                                                Run Lint
                                            </>
                                        )}
                                    </button>

                                    <button 
                                        onClick={() => handleLint(true)}
                                        disabled={scanning || installing || !envStatus.eslintInstalled}
                                        style={{
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid var(--background-modifier-border)',
                                            backgroundColor: 'var(--background-primary)',
                                            color: 'var(--text-normal)',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            opacity: (scanning || installing || !envStatus.eslintInstalled) ? 0.6 : 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title="Autofix Lint Issues"
                                    >
                                        <dc.Icon icon="wrench" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scan Results Layout */}
                        {lintResults && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '16px' }}>
                                {/* Results Stats Header */}
                                <div style={{
                                    display: 'flex',
                                    gap: '16px',
                                    flexShrink: 0
                                }}>
                                    <div style={{ flex: 1, backgroundColor: 'var(--background-secondary)', border: '1px solid var(--background-modifier-border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ fontSize: '24px', color: 'var(--text-muted)', display: 'flex' }}><dc.Icon icon="file-text" /></div>
                                        <div>
                                            <div style={{ fontSize: '20px', fontWeight: '700' }}>{totalFilesScanned}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Files Scanned</div>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, backgroundColor: 'var(--background-secondary)', border: '1px solid var(--background-modifier-border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ fontSize: '24px', color: totalErrors > 0 ? '#ef4444' : 'var(--text-muted)', display: 'flex' }}><dc.Icon icon="x-circle" /></div>
                                        <div>
                                            <div style={{ fontSize: '20px', fontWeight: '700', color: totalErrors > 0 ? '#ef4444' : 'var(--text-normal)' }}>{totalErrors}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Errors Found</div>
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, backgroundColor: 'var(--background-secondary)', border: '1px solid var(--background-modifier-border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div style={{ fontSize: '24px', color: totalWarnings > 0 ? '#f59e0b' : 'var(--text-muted)', display: 'flex' }}><dc.Icon icon="alert-triangle" /></div>
                                        <div>
                                            <div style={{ fontSize: '20px', fontWeight: '700', color: totalWarnings > 0 ? '#f59e0b' : 'var(--text-normal)' }}>{totalWarnings}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Warnings Found</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Results list & Preview */}
                                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '16px' }}>
                                    {/* Left side: Results Browser */}
                                    <div style={{
                                        flex: 1,
                                        backgroundColor: 'var(--background-secondary)',
                                        border: '1px solid var(--background-modifier-border)',
                                        borderRadius: '8px',
                                        overflowY: 'auto',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}>
                                        {/* Filter header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '8px', flexShrink: 0 }}>
                                            <div style={{ fontSize: '13px', fontWeight: '600' }}>Lint Output Issues</div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={copyIssuesText}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--background-modifier-border)',
                                                        backgroundColor: 'var(--background-primary)',
                                                        color: 'var(--text-normal)',
                                                        fontSize: '11px',
                                                        fontWeight: '500',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    <dc.Icon icon={copiedIssues ? "check" : "copy"} />
                                                    {copiedIssues ? "Copied!" : "Copy Issues"}
                                                </button>
                                                <select 
                                                    value={ruleFilter} 
                                                    onChange={(e) => setRuleFilter(e.target.value)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--background-modifier-border)',
                                                        backgroundColor: 'var(--background-primary)',
                                                        color: 'var(--text-normal)',
                                                        fontSize: '11px',
                                                        outline: 'none'
                                                    }}
                                                >
                                                    <option value="all">All Rules</option>
                                                    {scannedRules.map(rule => (
                                                        <option key={rule} value={rule}>{rule}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* File cards */}
                                        {lintResults.filter(f => f.errorCount > 0 || f.warningCount > 0).map(fileResult => {
                                            const filteredMessages = ruleFilter === 'all' 
                                                ? fileResult.messages 
                                                : fileResult.messages.filter(msg => msg.ruleId === ruleFilter);

                                            if (filteredMessages.length === 0) return null;

                                            return (
                                                <div key={fileResult.filePath} style={{
                                                    backgroundColor: 'var(--background-primary)',
                                                    border: '1px solid var(--background-modifier-border)',
                                                    borderRadius: '6px',
                                                    padding: '12px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '8px'
                                                }}>
                                                    {/* File Header */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            <div style={{ color: 'var(--text-muted)', display: 'flex' }}><dc.Icon icon="file" /></div>
                                                            {fileResult.relativePath}
                                                        </div>
                                                        <button 
                                                            onClick={() => openInObsidian(fileResult.relativePath)}
                                                            style={{
                                                                padding: '4px 8px',
                                                                border: 'none',
                                                                backgroundColor: 'transparent',
                                                                color: 'var(--text-muted)',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                fontSize: '11px'
                                                            }}
                                                            title="Open file in editor"
                                                        >
                                                            <dc.Icon icon="external-link" />
                                                        </button>
                                                    </div>

                                                    {/* Issues List */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {filteredMessages.map((msg, idx) => (
                                                            <div 
                                                                key={idx} 
                                                                onClick={() => {
                                                                    setSelectedFile({
                                                                        path: fileResult.relativePath,
                                                                        msg: msg
                                                                    });
                                                                    loadSourcePreview(fileResult.relativePath);
                                                                }}
                                                                className="eslint-issue-card"
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    padding: '8px 10px',
                                                                    borderRadius: '4px',
                                                                    backgroundColor: 'var(--background-secondary)',
                                                                    borderLeft: `3px solid ${msg.severity === 2 ? '#ef4444' : '#f59e0b'}`,
                                                                    cursor: 'pointer',
                                                                    fontSize: '12px',
                                                                    transition: 'background-color 0.15s ease'
                                                                }}
                                                            >
                                                                <div style={{ flex: 1, paddingRight: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', marginRight: '8px' }}>{msg.line}:{msg.column}</span>
                                                                    <span style={{ fontWeight: '500' }}>{msg.message}</span>
                                                                </div>
                                                                <div style={{
                                                                    fontSize: '10px',
                                                                    fontFamily: 'monospace',
                                                                    color: 'var(--text-muted)',
                                                                    backgroundColor: 'var(--background-modifier-border)',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px'
                                                                }}>
                                                                    {msg.ruleId || 'syntax'}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {lintResults.filter(f => f.errorCount > 0 || f.warningCount > 0).length === 0 && (
                                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                                ✨ No linting errors or warnings found!
                                            </div>
                                        )}
                                    </div>

                                    {/* Right side: Code Preview */}
                                    <div style={{
                                        width: '40%',
                                        backgroundColor: 'var(--background-secondary)',
                                        border: '1px solid var(--background-modifier-border)',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        {selectedFile ? (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                {/* Preview Header */}
                                                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--background-modifier-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                                    <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Code Inspector</div>
                                                    <button 
                                                        onClick={() => openInObsidian(selectedFile.path, selectedFile.msg.line, selectedFile.msg.column)}
                                                        style={{
                                                            padding: '4px 8px',
                                                            borderRadius: '4px',
                                                            border: 'none',
                                                            backgroundColor: 'var(--interactive-accent)',
                                                            color: 'var(--text-on-accent)',
                                                            fontSize: '11px',
                                                            fontWeight: '600',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Go to Line {selectedFile.msg.line}
                                                    </button>
                                                </div>

                                                {/* Code Snippet Preview */}
                                                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontFamily: 'monospace', fontSize: '12px', lineBreak: 'anywhere', whiteSpace: 'pre' }}>
                                                    {fileContent ? (
                                                        fileContent.split('\n').map((lineText, idx) => {
                                                            const lineNum = idx + 1;
                                                            const isTargetLine = lineNum === selectedFile.msg.line;
                                                            return (
                                                                <div 
                                                                    key={idx} 
                                                                    style={{
                                                                        display: 'flex',
                                                                        backgroundColor: isTargetLine ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                                                                        borderLeft: isTargetLine ? '3px solid #ef4444' : '3px solid transparent',
                                                                        padding: '2px 0'
                                                                    }}
                                                                >
                                                                    <span style={{ width: '40px', color: 'var(--text-muted)', textAlign: 'right', paddingRight: '12px', userSelect: 'none' }}>{lineNum}</span>
                                                                    <span style={{ color: isTargetLine ? 'var(--text-normal)' : 'var(--text-muted)' }}>{lineText}</span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div style={{ color: 'var(--text-muted)' }}>Loading file content...</div>
                                                    )}
                                                </div>

                                                {/* Error Message Footer */}
                                                <div style={{
                                                    padding: '16px',
                                                    borderTop: '1px solid var(--background-modifier-border)',
                                                    backgroundColor: 'var(--background-primary)',
                                                    flexShrink: 0
                                                }}>
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                                                        <div style={{ color: selectedFile.msg.severity === 2 ? '#ef4444' : '#f59e0b', fontSize: '14px', display: 'flex' }}>
                                                            <dc.Icon icon={selectedFile.msg.severity === 2 ? 'x-circle' : 'alert-triangle'} />
                                                        </div>
                                                        <div style={{ fontSize: '12px', fontWeight: '700' }}>
                                                            {selectedFile.msg.severity === 2 ? 'Error' : 'Warning'} on Line {selectedFile.msg.line}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-normal)', marginBottom: '8px' }}>
                                                        {selectedFile.msg.message}
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                                        Rule ID: {selectedFile.msg.ruleId || 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '32px', marginBottom: '8px', display: 'flex' }}><dc.Icon icon="eye" /></div>
                                                <div style={{ fontSize: '13px' }}>Click on a lint error card to inspect the source code preview.</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'console' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>Execution Output Logs</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={async () => {
                                        try {
                                            const fullLog = consoleLogs.map(logItem => {
                                                const timePrefix = logItem.time ? `[${logItem.time}] ` : '';
                                                return timePrefix + logItem.text;
                                            }).join('\n');
                                            await navigator.clipboard.writeText(fullLog);
                                            setCopied(true);
                                            window.setTimeout(() => setCopied(false), 2000);
                                        } catch (err) {
                                            console.error("Failed to copy logs:", err);
                                        }
                                    }}
                                    disabled={consoleLogs.length === 0}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--background-modifier-border)',
                                        backgroundColor: 'var(--background-secondary)',
                                        color: 'var(--text-normal)',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        opacity: consoleLogs.length === 0 ? 0.5 : 1,
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <dc.Icon icon={copied ? "check" : "copy"} />
                                    {copied ? "Copied!" : "Copy Log"}
                                </button>
                                <button
                                    onClick={() => setConsoleLogs([])}
                                    disabled={consoleLogs.length === 0}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--background-modifier-border)',
                                        backgroundColor: 'var(--background-secondary)',
                                        color: 'var(--text-normal)',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        opacity: consoleLogs.length === 0 ? 0.5 : 1,
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <dc.Icon icon="trash-2" />
                                    Clear Console
                                </button>
                            </div>
                        </div>
                        <div style={{
                            flex: 1,
                            backgroundColor: '#0a0a0c',
                            border: '1px solid var(--background-modifier-border)',
                            borderRadius: '8px',
                            padding: '20px',
                            overflowY: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            color: '#10b981', // green terminal
                            lineHeight: '1.5',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                        }}>
                            {consoleLogs.map((logItem, idx) => (
                                <div key={idx} style={{ color: logItem.isErr ? '#f87171' : '#34d399', whiteSpace: 'pre-wrap' }}>
                                    {logItem.time && <span style={{ color: '#6b7280', marginRight: '8px', userSelect: 'none' }}>[{logItem.time}]</span>}
                                    {logItem.text}
                                </div>
                            ))}
                            {consoleLogs.length === 0 && (
                                <div style={{ color: '#6b7280' }}>Console is quiet. Start an operation to see execution outputs.</div>
                            )}
                            <div ref={consoleEndRef} />
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto', gap: '20px' }}>
                        <div style={{
                            backgroundColor: 'var(--background-secondary)',
                            border: '1px solid var(--background-modifier-border)',
                            borderRadius: '8px',
                            padding: '24px',
                            maxWidth: '640px'
                        }}>
                            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: '600' }}>Package Setup Cache</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '8px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>ESLint Library</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{envStatus.eslintInstalled ? 'Installed (latest)' : 'Not Installed'}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '8px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Obsidian ESLint Plugin</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{envStatus.pluginInstalled ? `Installed (v${envStatus.localVersion})` : 'Not Installed'}</div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--background-modifier-border)', paddingBottom: '8px' }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Latest Plugin Version (NPM)</div>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: (latestVersion && envStatus.localVersion && latestVersion !== envStatus.localVersion) ? '#f59e0b' : 'var(--text-normal)' }}>
                                        {latestVersion || 'Unknown'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={handleInstall}
                                    disabled={installing}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        backgroundColor: 'var(--interactive-accent)',
                                        color: 'var(--text-on-accent)',
                                        fontWeight: '600',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        opacity: installing ? 0.6 : 1
                                    }}
                                >
                                    {installing ? 'Running Installation...' : 'Install / Update Environment'}
                                </button>
                                <button
                                    onClick={checkEnvironment}
                                    disabled={envStatus.checking}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--background-modifier-border)',
                                        backgroundColor: 'transparent',
                                        color: 'var(--text-normal)',
                                        fontWeight: '500',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Refresh Cache Status
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={installing || envStatus.checking}
                                    style={{
                                        padding: '10px 20px',
                                        borderRadius: '6px',
                                        border: '1px solid #ef4444',
                                        backgroundColor: isDeleteHovered ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                        color: '#ef4444',
                                        fontWeight: '500',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        opacity: (installing || envStatus.checking) ? 0.6 : 1,
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={() => setIsDeleteHovered(true)}
                                    onMouseLeave={() => setIsDeleteHovered(false)}
                                >
                                    Delete Environment
                                </button>
                            </div>

                            {latestVersion && envStatus.localVersion && latestVersion !== envStatus.localVersion && (
                                <div style={{
                                    marginTop: '16px',
                                    padding: '12px',
                                    borderRadius: '6px',
                                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                    color: '#f59e0b',
                                    fontSize: '12px',
                                    lineHeight: '1.4'
                                }}>
                                    💡 A newer version of the Obsidian ESLint Plugin (v{latestVersion}) is available on npm. Click <strong>Install / Update Environment</strong> above to fetch the latest version and run your checks against it!
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Custom Confirm Modal */}
            {showDeleteConfirm && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'var(--background-secondary)',
                        border: '1px solid var(--background-modifier-border)',
                        borderRadius: '8px', padding: '24px', maxWidth: '400px', width: '90%',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        fontFamily: 'var(--font-interface), sans-serif'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#ef4444', fontSize: '16px', fontWeight: '600' }}>Confirm Cache Deletion</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-normal)', marginBottom: '20px', lineHeight: '1.5' }}>
                            Are you sure you want to delete the local ESLint environment cache? This will clean up all installed node modules.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--background-modifier-border)',
                                    backgroundColor: 'transparent', color: 'var(--text-normal)', cursor: 'pointer', fontSize: '13px'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    handleDeleteEnv();
                                }}
                                style={{
                                    padding: '8px 16px', borderRadius: '6px', border: 'none',
                                    backgroundColor: '#ef4444', color: '#ffffff', cursor: 'pointer', fontSize: '13px', fontWeight: '600'
                                }}
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

return { ESLintVerifier };
