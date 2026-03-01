export async function fetchEnvFile(quickVarKey: string, repoName: string) {
    // Mock QuickVar API
    console.log(`[Env] Fetching QuickVar for ${repoName}...`);
    return `PORT=3000\nDATABASE_URL=postgres://localhost:5432/${repoName}\nAPI_KEY=mock_key`;
}

export function generateMultiRepoTomlFile(
    repos: any[],
    jiraKey: string,
    envVarsMap: Record<string, string>,
    purpose: string,
    bddDocs: string,
    preferredIde: string = "code"
) {
    const tomlLines: string[] = [];

    // Header comments
    tomlLines.push(`# PROJECT_NAME = project name (extracted from repo URL, changes per repo)`);
    tomlLines.push(`# GIT_TOKEN = user's Git OAuth token`);
    tomlLines.push(`# LATEST_PYTHON = latest Python version on system`);
    tomlLines.push(`cmds = [`);
    tomlLines.push(`  "mkdir -p ~/workspaces;",`);

    // We assume an auto directory is created or exists based on the image's "auto/$PROJECT_NAME" paths
    tomlLines.push(`  "mkdir -p auto;",`);

    repos.forEach((repo, index) => {
        const repoNumber = index + 1;
        const repoName = repo.url.split("/").pop()?.replace(".git", "") || `repo_${repoNumber}`;
        const safeUrl = repo.url.includes("https://") ? repo.url.replace("https://", "https://oauth2:$GIT_TOKEN@") : repo.url;

        tomlLines.push(`  "# Setup repository ${repoNumber}: ${repoName}",`);
        tomlLines.push(`  "PROJECT_NAME_${repoNumber}=\\"${repoName}\\";",`);

        // Clone
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "git clone -b python ${safeUrl} auto/$PROJECT_NAME_${repoNumber};",`);
        } else {
            tomlLines.push(`  "git clone ${safeUrl} auto/$PROJECT_NAME_${repoNumber};",`);
        }

        // Enter dir
        tomlLines.push(`  "cd auto/$PROJECT_NAME_${repoNumber};",`);

        // Checkout Branch
        tomlLines.push(`  "git checkout -b Feature/${jiraKey} origin/development || git checkout -b Feature/${jiraKey} origin/dev || git checkout -b Feature/${jiraKey} main || git checkout -b Feature/${jiraKey} master;",`);
        tomlLines.push(`  "git push -u origin Feature/${jiraKey};",`);

        // Shift Left Agent config (specifically shown for Python in the image)
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "git clone -b python https://oauth2:$GIT_TOKEN@gitlab.verizon.com/nts-falcon/projects/genai/inspire-core/ekb-testing/shift-left-agent auto/shift-left-agent;",`);
            tomlLines.push(`  "cp -r auto/shift-left-agent/.github auto/$PROJECT_NAME_${repoNumber}/;",`);
            tomlLines.push(`  "cp -r auto/shift-left-agent/.vscode auto/$PROJECT_NAME_${repoNumber}/;",`);
            tomlLines.push(`  "rm -rf auto/shift-left-agent;",`);
        }

        // Move generated env and md (Assuming they are downloaded to ~/Downloads)
        tomlLines.push(`  "mv ~/Downloads/${jiraKey}_${repoName}.env auto/$PROJECT_NAME_${repoNumber}/dev.env || true;",`);
        tomlLines.push(`  "mv ~/Downloads/${jiraKey}_${repoName}.md auto/$PROJECT_NAME_${repoNumber}/ || true;",`);

        // Python specific setup
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "PYTHON_VERSION=$($LATEST_PYTHON -c 'import sys; print(\\"{}.{}\\".format(sys.version_info.major, sys.version_info.minor))');",`);
            tomlLines.push(`  "if $LATEST_PYTHON -c 'import sys; print(1 if (sys.version_info.major, sys.version_info.minor) < (3,11) else 0)' | grep -q '^1$'; then default button \\\\\\"OK\\\\\\" with icon caution with title \\\\\\"Python Version Warning\\\\\\"; fi;",`);
            tomlLines.push(`  "[ ! -d venv ] && $LATEST_PYTHON -m venv venv;",`);
            tomlLines.push(`  "venv/bin/pip install poetry;",`);
            tomlLines.push(`  "export http_proxy=http://desktop.proxy.vzwcorp.com:5150; export https_proxy=http://desktop.proxy.vzwcorp.com:5150; venv/bin/poetry install;",`);
        }

        // Return to normal dir
        tomlLines.push(`  "cd -;",`);
    });

    // Create VS Code workspace (or other IDE equivalent based on user pref)
    const folderPaths = repos.map((repo, idx) => `    { \\"path\\": \\"auto/$PROJECT_NAME_${idx + 1}\\" }`).join(",\\n");
    tomlLines.push(`  "# Create IDE workspace",`);
    tomlLines.push(`  "cat > ~/workspaces/${jiraKey}.code-workspace << EOF\\n{\\n  \\"folders\\": [\\n${folderPaths}\\n  ]\\n}\\nEOF",`);

    // Open IDE
    if (preferredIde === "code") {
        tomlLines.push(`  "'/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code' ~/workspaces/${jiraKey}.code-workspace;"`);
    } else {
        tomlLines.push(`  "${preferredIde} ~/workspaces/${jiraKey}.code-workspace;"`);
    }

    tomlLines.push(`]`);

    // The image doesn't show standard TOML blocks for orchestration, so I've removed them 
    // to precisely match the bash array style requested.

    return tomlLines.join("\n");
}
