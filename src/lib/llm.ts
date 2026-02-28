export async function callVegasLLM(provider: string, apiKey: string, prompt: string) {
    // Mock LLM call logic
    console.log(`[LLM] Calling ${provider} with prompt: ${prompt.substring(0, 30)}...`);

    return `Based on the Jira description, here are the extracted repositories:
1. https://github.com/my-org/frontend-app.git
2. https://github.com/my-org/backend-api.git

PURPOSE DO NOT REMOVE:
The purpose of this program is to securely process and route user payments through our third party gateway while updating the user's subscription status in real-time.

BDD DO NOT REMOVE:
# BDD Specification: Payment Gateway
Feature: User Checkout
  Scenario: Successful Payment
    Given the user is on the checkout page
    When the user enters valid payment details
    Then the payment should be processed securely
    And the user's subscription should be activated`;
}

export async function extractGitReposFromJira(provider: string, apiKey: string, description: string) {
    const prompt = `Extract all git repository URLs, the program's purpose, and generate BDD documentation from the following Jira description:\n${description}`;
    const response = await callVegasLLM(provider, apiKey, prompt);

    // Simple regex to extract urls from the mocked response
    const urls = response.match(/https?:\/\/[^\s]+/g) || [];

    // Extract purpose and BDD from mock response
    const purposeMatch = response.match(/PURPOSE DO NOT REMOVE:\n([\s\S]*?)\n\nBDD DO NOT REMOVE:/);
    const bddMatch = response.match(/BDD DO NOT REMOVE:\n([\s\S]*)$/);

    return {
        urls,
        purpose: purposeMatch ? purposeMatch[1].trim() : "Purpose not identified.",
        bdd: bddMatch ? bddMatch[1].trim() : "# BDD Docs\nNot generated."
    };
}
