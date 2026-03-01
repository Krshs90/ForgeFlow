export async function fetchJiraTicket(baseUrl: string, email: string, token: string, ticketKey: string) {
    console.log(`[Jira] Processing fetch for ${ticketKey}...`);

    let cleanBaseUrl = baseUrl.trim();

    
    try {
        if (cleanBaseUrl.includes("atlassian.net")) {
            
            let urlToParse = cleanBaseUrl;
            if (!urlToParse.startsWith("http")) urlToParse = "https://" + urlToParse;
            const urlObj = new URL(urlToParse);
            cleanBaseUrl = urlObj.origin;
        } else {
            
            if (!cleanBaseUrl.startsWith("http")) cleanBaseUrl = "https://" + cleanBaseUrl;
            cleanBaseUrl = cleanBaseUrl.endsWith("/") ? cleanBaseUrl.slice(0, -1) : cleanBaseUrl;
        }
    } catch (e) {
        
        if (!cleanBaseUrl.startsWith("http")) cleanBaseUrl = "https://" + cleanBaseUrl;
    }

    
    const apiUrl = `${cleanBaseUrl}/rest/api/3/issue/${ticketKey}`;
    console.log(`[Jira] Calling API: ${apiUrl}`);

    const headers = new Headers();
    
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
            
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();

    
    
    let descriptionText = "No Description Provided";
    if (typeof data.fields?.description === "string") {
        descriptionText = data.fields.description;
    } else if (data.fields?.description?.content) {
        
        const extractTextFromAdf = (nodes: any[]): string => {
            if (!nodes) return "";
            return nodes.map(node => {
                let text = "";

                
                if ((node.type === "inlineCard" || node.type === "blockCard") && node.attrs?.url) {
                    text += ` ${node.attrs.url} `;
                }

                
                if (node.type === "text") {
                    text += node.text || "";
                    
                    if (node.marks) {
                        node.marks.forEach((mark: any) => {
                            if (mark.type === "link" && mark.attrs?.href && mark.attrs.href !== node.text) {
                                text += ` (${mark.attrs.href}) `;
                            }
                        });
                    }
                }

                
                if (node.content) {
                    text += extractTextFromAdf(node.content);
                }

                return text;
            }).join(" ");
        };

        descriptionText = extractTextFromAdf(data.fields.description.content);
    }

    return {
        key: data.key || ticketKey,
        fields: {
            summary: data.fields?.summary || "No Summary Provided",
            description: descriptionText,
        }
    };
}
