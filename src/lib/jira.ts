export async function fetchJiraTicket(baseUrl: string, token: string, ticketKey: string) {
    // Mock Jira fetch logic
    console.log(`[Jira] Fetching ${ticketKey} from ${baseUrl}`);

    // In a real scenario:
    // const response = await fetch(`${baseUrl}/rest/api/3/issue/${ticketKey}`, {
    //   headers: {
    //     Authorization: `Basic ${Buffer.from(token).toString("base64")}`,
    //     Accept: "application/json",
    //   },
    // });
    // return response.json();

    return {
        key: ticketKey,
        fields: {
            summary: "Implement payment gateway frontend",
            description: "We need to set up the payment gateway inside the frontend repository: https://github.com/my-org/frontend-app.git\n\nAlso requires updates to the backend service: https://github.com/my-org/backend-api.git",
        }
    };
}
