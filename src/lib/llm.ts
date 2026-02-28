export async function callVegasLLM(provider: string, apiKey: string, prompt: string) {
    // Mock LLM call logic
    console.log(`[LLM] Calling ${provider} with prompt: ${prompt.substring(0, 30)}...`);

    return `Based on the Jira description, here are the extracted repositories:
1. https://github.com/my-org/frontend-app.git
2. https://github.com/my-org/backend-api.git`;
}

export async function extractGitReposFromJira(provider: string, apiKey: string, description: string) {
    const prompt = `Extract all git repository URLs from the following Jira description:\n${description}`;
    const response = await callVegasLLM(provider, apiKey, prompt);

    // Simple regex to extract urls from the mocked response
    const urls = response.match(/https?:\/\/[^\s]+/g) || [];
    return urls;
}
