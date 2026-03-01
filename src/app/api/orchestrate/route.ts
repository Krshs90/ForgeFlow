import { NextResponse } from "next/server";
import { fetchJiraTicket } from "@/lib/jira";
import { extractGitReposFromJira } from "@/lib/llm";
import { downloadAndAnalyzeRepo } from "@/lib/repoAnalysis";
import { generateMultiRepoTomlFile, fetchEnvFile } from "@/lib/generation";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { jiraBaseUrl, jiraEmail, jiraToken, jiraTicket, llmProvider, llmApiKey, quickVarKey } = body;

        if (!jiraTicket || !jiraToken || !jiraEmail || !jiraBaseUrl) {
            return NextResponse.json({ error: "Missing Jira credentials" }, { status: 400 });
        }

        const log: string[] = [];
        const addLog = (msg: string) => {
            log.push(`[${new Date().toISOString()}] ${msg}`);
            console.log(msg);
        };

        // 1. Fetch Jira Ticket
        const targetTicket = body.jiraTicket;
        addLog(`Fetching Jira ticket ${targetTicket}...`);
        const ticket = await fetchJiraTicket(jiraBaseUrl, jiraEmail, jiraToken, targetTicket);

        // 2. Extract Repos using LLM
        addLog(`Extracting repositories using ${llmProvider}...`);
        const { urls: repoUrls, purpose, bdd } = await extractGitReposFromJira(llmProvider, llmApiKey, ticket.fields.description);

        addLog(`Found ${repoUrls.length} repository URLs:`);
        repoUrls.forEach((url: string) => addLog(` - ${url}`));
        addLog(`\n=== EXTRACTED PURPOSE ===\n${purpose}`);
        addLog(`\n=== EXTRACTED BDD ===\n${bdd}`);

        // 3. Construct AI Prompt for VS Code
        addLog("Compiling generative AI prompt for VS Code...");
        const aiPrompt = `
Hello AI assistant! Below is the context extracted from my Jira ticket (${targetTicket}).
Please review the overarching purpose and the BDD requirements, and then help me implement the necessary features across the listed repositories.

=== TICKET SUMMARY ===
${ticket.fields.summary}

=== LIST OF INVOLVED REPOSITORIES ===
${repoUrls.join("\n")}

=== OVERARCHING PROGRAM PURPOSE ===
${purpose}

=== BEHAVIOR-DRIVEN DEVELOPMENT (BDD) REQUIREMENTS ===
${bdd}

Please strictly adhere to the BDD specifications provided above. Before generating code, ask me where you should begin or if I need to explain the current architecture first.
`.trim();

        // EARLY EXIT FOR TESTING LLM EXTRACTION
        addLog(`\n[Test Mode] Early exit. Ticket extraction verified successfully.`);
        return NextResponse.json({
            success: true,
            log,
            toml: null,
            envMaps: {},
            aiPrompt: aiPrompt
        });

        if (repoUrls.length === 0) {
            addLog("No repositories found in ticket.");
            return NextResponse.json({ log, toml: null });
        }

        // 3. Analyze Repos
        addLog(`Analyzing ${repoUrls.length} repositories...`);
        const reposData = [];
        for (const url of repoUrls) {
            const analysis = await downloadAndAnalyzeRepo(url);
            reposData.push({ url, analysis });
        }

        // 4. Generate Env and TOML
        addLog("Generating orchestration files...");
        const envVarsMap: Record<string, string> = {};
        for (const repo of reposData) {
            const repoName = repo.url.split("/").pop()?.replace(".git", "") || "repo";
            envVarsMap[repoName] = await fetchEnvFile(quickVarKey || "default", repoName);
        }

        const tomlContent = generateMultiRepoTomlFile(reposData, jiraTicket, envVarsMap, purpose, bdd);
        addLog("Workspace files successfully generated!");

        return NextResponse.json({
            success: true,
            log,
            toml: tomlContent,
            envMaps: envVarsMap
        });

    } catch (error: any) {
        console.error("Orchestration error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
