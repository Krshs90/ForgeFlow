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
    bddDocs: string
) {
    const tomlLines: string[] = [];

    tomlLines.push(`[orchestration]`);
    tomlLines.push(`ticket = "${jiraKey}"`);
    tomlLines.push(`created_at = "${new Date().toISOString()}"`);
    tomlLines.push(`purpose = """\n${purpose}\n"""`);
    tomlLines.push(``);

    tomlLines.push(`[documentation]`);
    tomlLines.push(`bdd = """\n${bddDocs}\n"""`);
    tomlLines.push(``);

    repos.forEach((repo, index) => {
        const repoName = repo.url.split("/").pop()?.replace(".git", "") || `repo_${index}`;
        tomlLines.push(`[[repository]]`);
        tomlLines.push(`name = "${repoName}"`);
        tomlLines.push(`url = "${repo.url}"`);
        tomlLines.push(`type = "${repo.analysis.type}"`);
        tomlLines.push(`clone_cmd = "git clone ${repo.url}"`);
        tomlLines.push(`branch_cmd = "git checkout -b feature/${jiraKey}"`);

        tomlLines.push(`build_cmds = [`);
        repo.analysis.buildCommands.forEach((cmd: string) => {
            tomlLines.push(`  "${cmd}",`);
        });
        // Add shift-left integration for python
        if (repo.analysis.type === "Python") {
            tomlLines.push(`  "pip install pre-commit && pre-commit install",`);
            tomlLines.push(`  "echo 'Shift-Left integrated'",`);
        }
        tomlLines.push(`]`);

        if (envVarsMap[repoName]) {
            tomlLines.push(`env_template = true`);
        }

        tomlLines.push(``);
    });

    return tomlLines.join("\n");
}
