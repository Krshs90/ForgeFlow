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
    tomlLines.push(`  "New-Item -ItemType Directory -Force -Path \\"$HOME/workspaces\\" | Out-Null;",`);

    // Use absolute path under $HOME so we never hit permission issues with relative paths
    tomlLines.push(`  "New-Item -ItemType Directory -Force -Path \\"$HOME/ForgeFlow/auto\\" | Out-Null;",`);
    tomlLines.push(`  "Push-Location \\"$HOME/ForgeFlow\\";",`);

    repos.forEach((repo, index) => {
        const repoNumber = index + 1;
        const repoName = repo.url.split("/").pop()?.replace(".git", "") || `repo_${repoNumber}`;
        const safeUrl = repo.url.includes("https://") ? repo.url.replace("https://", "https://oauth2:$GIT_TOKEN@") : repo.url;

        tomlLines.push(`  "# Setup repository ${repoNumber}: ${repoName}",`);
        tomlLines.push(`  "$PROJECT_NAME_${repoNumber}=\\"${repoName}\\";",`);

        // Clone
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "git clone -b python ${safeUrl} \\"auto/$PROJECT_NAME_${repoNumber}\\";",`);
        } else {
            tomlLines.push(`  "git clone ${safeUrl} \\"auto/$PROJECT_NAME_${repoNumber}\\";",`);
        }

        // Enter dir
        tomlLines.push(`  "Push-Location \\"auto/$PROJECT_NAME_${repoNumber}\\";",`);

        // Checkout Branch
        tomlLines.push(`  "git checkout -b Feature/${jiraKey} origin/development; if (-not $?) { git checkout -b Feature/${jiraKey} origin/dev }; if (-not $?) { git checkout -b Feature/${jiraKey} main }; if (-not $?) { git checkout -b Feature/${jiraKey} master };",`);
        tomlLines.push(`  "git push -u origin Feature/${jiraKey};",`);

        // Shift Left Agent config (specifically shown for Python in the image)
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "git clone -b python https://oauth2:$GIT_TOKEN@gitlab.verizon.com/nts-falcon/projects/genai/inspire-core/ekb-testing/shift-left-agent shift-left-agent;",`);
            tomlLines.push(`  "Copy-Item -Recurse -Force shift-left-agent/.github ./;",`);
            tomlLines.push(`  "Copy-Item -Recurse -Force shift-left-agent/.vscode ./;",`);
            tomlLines.push(`  "Remove-Item -Recurse -Force shift-left-agent;",`);
        }

        // Move generated env and md (Assuming they are downloaded to ~/Downloads)
        tomlLines.push(`  "try { Move-Item -Force -Path \\"$HOME/Downloads/${jiraKey}_${repoName}.env\\" -Destination \\"dev.env\\" -ErrorAction Stop } catch { };",`);
        tomlLines.push(`  "try { Move-Item -Force -Path \\"$HOME/Downloads/${jiraKey}_${repoName}.md\\" -Destination \\".\\" -ErrorAction Stop } catch { };",`);

        // Python specific setup
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "try { $PYTHON_VERSION = & $LATEST_PYTHON -c 'import sys; print(\\"{}.{}\\".format(sys.version_info.major, sys.version_info.minor))' } catch { };",`);
            tomlLines.push(`  "if (-not (Test-Path venv)) { & $LATEST_PYTHON -m venv venv };",`);
            tomlLines.push(`  "& venv/Scripts/pip install poetry;",`);
            tomlLines.push(`  "$env:http_proxy=\\"http://desktop.proxy.vzwcorp.com:5150\\"; $env:https_proxy=\\"http://desktop.proxy.vzwcorp.com:5150\\"; & venv/Scripts/poetry install;",`);
        }

        // Return to repo parent (back to $HOME/ForgeFlow)
        tomlLines.push(`  "Pop-Location;",`);
    });

    // Pop back from $HOME/ForgeFlow
    tomlLines.push(`  "Pop-Location;",`);

    // Create VS Code workspace (or other IDE equivalent based on user pref)
    const folderPaths = repos.map((repo, idx) => `    { \\"path\\": \\"$HOME/ForgeFlow/auto/$PROJECT_NAME_${idx + 1}\\" }`).join(",\\n");
    tomlLines.push(`  "# Create IDE workspace",`);
    tomlLines.push(`  "@'\\n{\\n  \\"folders\\": [\\n${folderPaths}\\n  ]\\n}\\n'@ | Set-Content -Encoding UTF8 \\"$HOME/workspaces/${jiraKey}.code-workspace\\";",`);

    // Open IDE
    tomlLines.push(`  "${preferredIde} \\"$HOME/workspaces/${jiraKey}.code-workspace\\";",`);

    // Print success
    tomlLines.push(`  "Write-Host \\"=========================================\\" -ForegroundColor Green;",`);
    tomlLines.push(`  "Write-Host \\"ForgeFlow Generation Successful!\\" -ForegroundColor Green;",`);
    tomlLines.push(`  "Write-Host \\"Workspaces mapped to IDE for ${jiraKey}\\" -ForegroundColor Green;",`);
    tomlLines.push(`  "Write-Host \\"=========================================\\" -ForegroundColor Green;"`);

    tomlLines.push(`]`);

    // The image doesn't show standard TOML blocks for orchestration, so I've removed them 
    // to precisely match the bash array style requested.

    return tomlLines.join("\n");
}
