export async function fetchJiraTicket(baseUrl: string, email: string, token: string, ticketKey: string) {
    console.log(`[Jira] Fetching ${ticketKey} from ${baseUrl} using API v2...`);

    const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    const apiUrl = `${cleanBaseUrl}/rest/api/2/issue/${ticketKey}`;

    const headers = new Headers();
    headers.set("Authorization", `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`);
    headers.set("Accept", "application/json");

    const response = await fetch(apiUrl, {
        method: 'GET',
        headers: headers,
    });

    if (!response.ok) {
        let errorMsg = `Jira API error ${response.status}: ${response.statusText}`;
        try {
            const errData = await response.json();
            if (errData.errorMessages && errData.errorMessages.length > 0) {
                errorMsg = `Jira Error: ${errData.errorMessages.join(", ")}`;
            }
        } catch (e) {
            // ignore JSON parse error on error response
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();

    // Jira API v2 returns description as a string
    return {
        key: data.key || ticketKey,
        fields: {
            summary: data.fields?.summary || "No Summary Provided",
            description: data.fields?.description || "No Description Provided",
        }
    };
}
