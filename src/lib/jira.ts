export async function fetchJiraTicket(baseUrl: string, email: string, token: string, ticketKey: string) {
    console.log(`[Jira] Processing fetch for ${ticketKey}...`);

    let cleanBaseUrl = baseUrl.trim();

    // If user enters a full URL as base, extract just the origin (e.g. domain.atlassian.net)
    try {
        if (cleanBaseUrl.includes("atlassian.net")) {
            // Prepend https if missing for URL parser
            let urlToParse = cleanBaseUrl;
            if (!urlToParse.startsWith("http")) urlToParse = "https://" + urlToParse;
            const urlObj = new URL(urlToParse);
            cleanBaseUrl = urlObj.origin;
        } else {
            // Fallback for custom domains
            if (!cleanBaseUrl.startsWith("http")) cleanBaseUrl = "https://" + cleanBaseUrl;
            cleanBaseUrl = cleanBaseUrl.endsWith("/") ? cleanBaseUrl.slice(0, -1) : cleanBaseUrl;
        }
    } catch (e) {
        // Fallback if URL parsing fails
        if (!cleanBaseUrl.startsWith("http")) cleanBaseUrl = "https://" + cleanBaseUrl;
    }

    // Use API v3 for Jira Cloud
    const apiUrl = `${cleanBaseUrl}/rest/api/3/issue/${ticketKey}`;
    console.log(`[Jira] Calling API: ${apiUrl}`);

    const headers = new Headers();
    // Use Buffer for Base64 encoding in Node context
    const authString = Buffer.from(`${email.trim()}:${token.trim()}`).toString("base64");
    headers.set("Authorization", `Basic ${authString}`);
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
            } else if (errData.errors) {
                errorMsg = `Jira Error: ${JSON.stringify(errData.errors)}`;
            }
        } catch (e) {
            // ignore JSON parse error on error response
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();

    // Jira API v3 returns description as an ADF (Atlassian Document Format) object or string depending on issue
    // We try to extract text from ADF or fallback to a string
    let descriptionText = "No Description Provided";
    if (typeof data.fields?.description === "string") {
        descriptionText = data.fields.description;
    } else if (data.fields?.description?.content) {
        // Simple ADF to Text extraction
        descriptionText = data.fields.description.content
            .map((block: any) => block.content?.map((inner: any) => inner.text).join("") || "")
            .join("\n");
    }

    return {
        key: data.key || ticketKey,
        fields: {
            summary: data.fields?.summary || "No Summary Provided",
            description: descriptionText,
        }
    };
}
