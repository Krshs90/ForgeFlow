import { NextResponse } from "next/server";
import { testLLMConnection } from "@/lib/llm";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { provider, apiKey } = body;

        if (!provider || !apiKey) {
            return NextResponse.json({ error: "Missing provider or API key" }, { status: 400 });
        }

        const success = await testLLMConnection(provider, apiKey);

        if (success) {
            return NextResponse.json({ message: "Key validated successfully!" });
        } else {
            return NextResponse.json({ error: "Validation failed. API connected but returned unexpected response." }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
