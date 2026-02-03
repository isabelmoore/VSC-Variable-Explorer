start(onMessage) {
    this.messageCallback = onMessage;

    if (this.process) {
        console.log('Python process already running');
        return;
    }
    this.outputBuffer = '';

    // Get Python path with better fallback logic
    let pythonPath = vscode.workspace.getConfiguration('python').get('defaultInterpreterPath');
    if (!pythonPath) {
        pythonPath = vscode.workspace.getConfiguration('variableExplorer').get('pythonPath');
    }
    if (!pythonPath) {
        pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    }

    // === DEBUG LOGGING ===
    console.log('========== VARIABLE EXPLORER DEBUG ==========');
    console.log('Python path:', pythonPath);

    const backendScript = path.join(this.context.extensionPath, 'python', 'variable_inspector.py');
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    console.log('Backend script:', backendScript);
    console.log('Workspace folder:', workspaceFolder);

    const extraPaths = vscode.workspace.getConfiguration('python').get('analysis.extraPaths') || [];
    const extensionPythonPath = path.join(this.context.extensionPath, 'python');

    const resolvedPaths = extraPaths.map(p => {
        if (path.isAbsolute(p)) {
            return p;
        }
        return workspaceFolder ? path.join(workspaceFolder, p) : p;
    });

    // Add all subdirectories of workspace to PYTHONPATH (recursive)
    if (workspaceFolder) {
        try {
            const startTime = Date.now();
            let dirCount = 0;
            
            const addSubdirs = (dir, depth = 0) => {
                if (depth > 5) return;
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory() && 
                        !entry.name.startsWith('.') && 
                        !entry.name.startsWith('__') &&
                        entry.name !== 'node_modules' &&
                        entry.name !== 'venv' &&
                        entry.name !== '.git') {
                        const subdir = path.join(dir, entry.name);
                        resolvedPaths.push(subdir);
                        dirCount++;
                        addSubdirs(subdir, depth + 1);
                    }
                }
            };
            addSubdirs(workspaceFolder);
            
            console.log(`Scanned ${dirCount} directories in ${Date.now() - startTime}ms`);
        } catch (e) {
            console.error('Error reading workspace subdirectories:', e);
        }
    }

    const pythonPathParts = [...resolvedPaths, extensionPythonPath];
    if (process.env.PYTHONPATH) {
        pythonPathParts.push(process.env.PYTHONPATH);
    }
    const pythonPathEnv = pythonPathParts.join(path.delimiter);

    console.log('PYTHONPATH entries:');
    pythonPathParts.forEach((p, i) => console.log(`  ${i}: ${p}`));
    console.log('==============================================');
    
    // Also show a VS Code notification
    vscode.window.showInformationMessage(`Variable Explorer: Using Python at ${pythonPath}`);

    const spawnOptions = {
        cwd: workspaceFolder || undefined,
        env: { ...process.env, PYTHONPATH: pythonPathEnv }
    };

    // ... rest of the function stays the same
