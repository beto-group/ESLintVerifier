async function View({ folderPath }) {
    if (!folderPath) throw new Error("View requires folderPath prop");

    const SafeView = () => {
        const [app, setApp] = dc.useState(null);

        dc.useEffect(() => {
            const load = async () => {
                try {
                    const appPath = folderPath + '/src/App.jsx';
                    const servicePath = folderPath + '/src/utils/LinterService.js';
                    const { LinterService } = await dc.require(servicePath);
                    const { ESLintVerifier } = await dc.require(appPath);
                    setApp({ ESLintVerifier, LinterService });
                } catch (e) {
                    console.error("Failed to load ESLint Verifier component:", e);
                }
            };
            load();
        }, []);

        if (!app) {
            return (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)',
                    backgroundColor: 'var(--background-primary)',
                    fontFamily: 'var(--font-interface), sans-serif'
                }}>
                    Loading ESLint Verifier...
                </div>
            );
        }

        const { ESLintVerifier, LinterService } = app;
        return <FullTabWrapper ESLintVerifier={ESLintVerifier} LinterService={LinterService} folderPath={folderPath} />;
    };

    const FullTabWrapper = ({ ESLintVerifier, LinterService, folderPath }) => {
        const rootRef = dc.useRef(null);
        const [hijacked, setHijacked] = dc.useState(false);

        // Layer 1 — CSS Suppression & Height Restoration
        dc.useEffect(() => {
            const FULLTAB_ID = 'fulltab-159-eslint-verifier';
            let styleEl = activeDocument.getElementById(FULLTAB_ID);
            if (!styleEl) {
                styleEl = activeDocument.createElement('style');
                styleEl.id = FULLTAB_ID;
                styleEl.textContent = `
                    body > .app-container .status-bar,
                    .status-bar, .inline-title, .view-footer,
                    .workspace-leaf-content-footer, .mod-footer,
                    .embedded-backlinks { display: none !important; }
                    .workspace-leaf-content { padding: 0 !important; margin: 0 !important; }
                    .markdown-preview-view, .markdown-preview-section { padding: 0 !important; max-width: 100% !important; }
                    .markdown-preview-sizer { padding: 0 !important; margin: 0 !important; min-height: unset !important; }
                    
                    /* Custom hover rule for lint issues list items */
                    .eslint-issue-card:hover {
                        background-color: var(--background-modifier-hover) !important;
                    }
                    
                    /* Force workspace-leaf viewport layers to take full height when ESLint Verifier is active */
                    .workspace-leaf.eslint-verifier-active-leaf,
                    .workspace-leaf.eslint-verifier-active-leaf .workspace-leaf-content,
                    .workspace-leaf.eslint-verifier-active-leaf .view-content,
                    .workspace-leaf.eslint-verifier-active-leaf .markdown-source-view,
                    .workspace-leaf.eslint-verifier-active-leaf .cm-editor,
                    .workspace-leaf.eslint-verifier-active-leaf .cm-scroller,
                    .workspace-leaf.eslint-verifier-active-leaf .markdown-preview-view,
                    .workspace-leaf.eslint-verifier-active-leaf .markdown-preview-sizer {
                        height: 100% !important;
                        max-height: 100% !important;
                        min-height: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: hidden !important;
                    }
                `;
                activeDocument.head.appendChild(styleEl);
            }
            return () => {
                const el = activeDocument.getElementById(FULLTAB_ID);
                if (el) el.remove();
            };
        }, []);

        // Layer 2 — DOM Reparenting & Class Injection
        dc.useEffect(() => {
            const root = rootRef.current;
            if (!root) return;
            let attempts = 0;
            const hijack = () => {
                try {
                    const leaf = root.closest('.workspace-leaf');
                    if (leaf) {
                        leaf.classList.add('eslint-verifier-active-leaf');
                    }
                    const scroller = leaf?.querySelector('.cm-scroller') || leaf?.querySelector('.markdown-preview-view') || leaf?.querySelector('.view-content');
                    if (scroller) {
                        scroller.appendChild(root);
                        
                        if (window.getComputedStyle(scroller).position === 'static') {
                            Object.assign(scroller.style, { position: 'relative' });
                        }
                        
                        Object.assign(root.style, {
                            position: 'absolute', top: '0', left: '0',
                            width: '100%', height: '100%', zIndex: '10',
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden', visibility: 'visible',
                        });
                        setHijacked(true);
                        return true;
                    }
                } catch {
                    /* ignore */
                }
                return false;
            };
            
            if (hijack()) return;
            const poller = window.setInterval(() => {
                if (hijack() || attempts++ > 100) window.clearInterval(poller);
            }, 16);
            return () => window.clearInterval(poller);
        }, []);

        const stopEvents = {
            onPointerDown: (e) => e.stopPropagation(),
            onMouseDown: (e) => e.stopPropagation(),
            onMouseUp: (e) => e.stopPropagation(),
            onClick: (e) => e.stopPropagation(),
            onKeyDown: (e) => e.stopPropagation(),
            onKeyUp: (e) => e.stopPropagation(),
            onTouchStart: (e) => e.stopPropagation(),
            onTouchEnd: (e) => e.stopPropagation(),
        };

        return (
            <div
                ref={rootRef}
                id="eslint-verifier-root"
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    visibility: hijacked ? 'visible' : 'hidden'
                }}
                {...stopEvents}
            >
                <ESLintVerifier folderPath={folderPath} LinterService={LinterService} />
            </div>
        );
    };

    return <SafeView />;
}

return { View };
