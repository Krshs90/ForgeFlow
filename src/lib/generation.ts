export async function fetchEnvFile(quickVarKey: string, repoName: string) {
    // Mock QuickVar API
    console.log(`[Env] Fetching QuickVar for ${repoName}...`);
    return `PORT=3000\nDATABASE_URL=postgres://localhost:5432/${repoName}\nAPI_KEY=mock_key`;
}

export function generateMultiRepoTomlFile(
    repos: any[],
    jiraKey: string,
    envVarsMap: Record<string, string>
) {
    const tomlLines: string[] = [];

    tomlLines.push(`[orchestration]`);
    tomlLines.push(`ticket = "${jiraKey}"`);
    tomlLines.push(`created_at = "${new Date().toISOString()}"`);
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
        tomlLines.push(`]`);

        if (envVarsMap[repoName]) {
            // In a real file we would just dump a path, but here we embed it as a string for simplicity
            // Or we can say env_file = ".env"
            tomlLines.push(`env_template = true`);
        }

        tomlLines.push(``);
    });

    return tomlLines.join("\n");
}
