"use client";

import { useState, useEffect } from "react";
import { Settings, Play, Database, FileCode2, TerminalSquare, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("config");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; error: string | null; success: string | null }>({
    loading: false,
    error: null,
    success: null
  });

  // Dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [ideDropdownOpen, setIdeDropdownOpen] = useState(false);

  const providers = [
    { id: "gemini", label: "Google Gemini" },
    { id: "claude", label: "Anthropic Claude" },
    { id: "chatgpt", label: "OpenAI ChatGPT" }
  ];

  const ides = [
    { id: "code", label: "VS Code (code)" },
    { id: "cursor", label: "Cursor (cursor)" },
    { id: "windsurf", label: "Windsurf (windsurf)" },
    { id: "idea", label: "IntelliJ IDEA (idea)" },
  ];

  // Form State
  const [formData, setFormData] = useState({
    jiraBaseUrl: "",
    jiraEmail: "",
    jiraToken: "",
    jiraTicket: "",
    llmProvider: "gemini",
    llmApiKey: "",
    preferredIde: "code",
    quickVarKey: "",
  });

  // Load from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem("forgeflowConfig");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      // Merge with default state to prevent undefined values causing uncontrolled input errors
      setFormData(prev => ({
        ...prev,
        ...parsed,
        jiraEmail: parsed.jiraEmail || "",
      }));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newFormData = { ...formData, [e.target.name]: e.target.value };
    setFormData(newFormData);
    // Don't save the specific ticket they are generating for, just their reusable config credentials
    const configToSave = {
      jiraBaseUrl: newFormData.jiraBaseUrl,
      jiraToken: newFormData.jiraToken,
      jiraEmail: newFormData.jiraEmail,
      llmProvider: newFormData.llmProvider,
      llmApiKey: newFormData.llmApiKey,
      preferredIde: newFormData.preferredIde, // Added preferredIde
      quickVarKey: newFormData.quickVarKey,
      jiraTicket: "", // Ensure jiraTicket is not saved
    };
    localStorage.setItem("forgeflowConfig", JSON.stringify(configToSave));
  };

  const handleProviderSelect = (providerId: string) => {
    const newFormData = { ...formData, llmProvider: providerId };
    setFormData(newFormData);
    setDropdownOpen(false);

    // Save to local storage
    const configToSave = { ...newFormData, jiraTicket: "" };
    localStorage.setItem("forgeflowConfig", JSON.stringify(configToSave));
  };

  const handleIdeSelect = (ideId: string) => {
    const newFormData = { ...formData, preferredIde: ideId };
    setFormData(newFormData);
    setIdeDropdownOpen(false);

    // Save to local storage
    const configToSave = { ...newFormData, jiraTicket: "" };
    localStorage.setItem("forgeflowConfig", JSON.stringify(configToSave));
  };

  const handleTestLLMKey = async () => {
    if (!formData.llmApiKey) {
      alert("Please enter an API key first.");
      return;
    }
    setTestStatus({ loading: true, error: null, success: null });
    try {
      const response = await fetch("/api/test-llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: formData.llmProvider,
          apiKey: formData.llmApiKey,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Test failed");
      setTestStatus({ loading: false, error: null, success: data.message });
    } catch (error: any) {
      setTestStatus({ loading: false, error: error.message, success: null });
    }
  };

  const handleGenerate = async () => {
    if (!formData.jiraTicket || !formData.jiraToken || !formData.jiraEmail || !formData.jiraBaseUrl) {
      alert("Please configure Jira Base URL, Email, API Token, and Ticket key first.");
      setActiveTab("config");
      return;
    }

    // Basic API Key Validation Check
    if (formData.llmProvider === "chatgpt" && !formData.llmApiKey.startsWith("sk-")) {
      alert("OpenAI API keys typically start with 'sk-'. Please enter a valid key.");
      setActiveTab("config");
      return;
    }

    // Google Gemini API keys are 39 characters long
    if (formData.llmProvider === "gemini" && formData.llmApiKey.length !== 39) {
      alert("Google Gemini API keys are typically 39 characters long. Please check your key.");
      setActiveTab("config");
      return;
    }

    // Anthropic Claude keys typically start with sk-ant-
    if (formData.llmProvider === "claude" && !formData.llmApiKey.startsWith("sk-ant-")) {
      alert("Anthropic API keys typically start with 'sk-ant-'. Please check your key.");
      setActiveTab("config");
      return;
    }

    let finalTicketKey = formData.jiraTicket.trim();
    if (finalTicketKey.includes("http")) {
      try {
        const urlObj = new URL(finalTicketKey);
        if (urlObj.searchParams.has("selectedIssue")) {
          finalTicketKey = urlObj.searchParams.get("selectedIssue") || finalTicketKey;
        } else {
          const parts = urlObj.pathname.split("/");
          finalTicketKey = parts[parts.length - 1] || finalTicketKey;
        }
      } catch (e) {
        // Ignore URL parse error
      }
    }

    setIsGenerating(true);
    setIsDone(false);
    setGenerationLog(["Initializing ForgeFlow pipeline..."]);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, jiraTicket: finalTicketKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Generation failed");
      }

      setGenerationLog(prev => [...prev, ...data.log]);
      setIsGenerating(false);
      setIsDone(true);

      // Store raw files in window for actual download
      // @ts-ignore
      window.__forgeflowResponse = data;

      // Auto-download TOML
      setTimeout(() => {
        downloadToml();
      }, 500);

    } catch (error: unknown) {
      if (error instanceof Error) {
        setGenerationLog(prev => [...prev, `[ERROR] ${error.message}`]);
      } else {
        setGenerationLog(prev => [...prev, `[ERROR] Unknown error occurred`]);
      }
      setIsGenerating(false);
    }
  };

  const downloadToml = () => {
    // @ts-ignore
    const data = window.__forgeflowResponse;
    if (!data?.toml) return;
    const blob = new Blob([data.toml], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workspace-${formData.jiraTicket || 'output'}.toml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyPrompt = async () => {
    // @ts-ignore
    const data = window.__forgeflowResponse;
    if (!data?.aiPrompt) return;

    try {
      await navigator.clipboard.writeText(data.aiPrompt);
      alert("AI Prompt successfully copied to clipboard! You can now paste this directly into VS Code.");
    } catch (err) {
      alert("Failed to copy to clipboard.");
    }
  };

  const downloadPromptFile = () => {
    // @ts-ignore
    const data = window.__forgeflowResponse;
    if (!data?.aiPrompt) return;
    const blob = new Blob([data.aiPrompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-${formData.jiraTicket || 'output'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen py-10 px-4 sm:px-10 lg:px-20 animate-in">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center font-bold text-lg">
            F
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ForgeFlow</h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>v1.0 Windows</span>
          <a href="https://github.com" className="hover:text-foreground transition-colors">Documentation</a>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Workspace Orchestrator</h2>
          <p className="text-muted-foreground">
            Automate your development environments from Jira tickets. Configure integrations and generate standard templates.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("config")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === "config" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <Settings className="w-4 h-4" />
            Configuration
          </button>
          <button
            onClick={() => setActiveTab("generate")}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${activeTab === "generate" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
          >
            <Play className="w-4 h-4" />
            Generation Tasks
          </button>
        </div>

        {/* Tab Content: Config */}
        {activeTab === "config" && (
          <div className="space-y-6 animate-in">
            {/* Jira Settings */}
            <div className="glass-panel p-6 rounded-lg space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Database className="w-5 h-5" />
                <h3 className="text-lg font-medium">Jira Integration</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Jira Base URL</label>
                  <input
                    type="url"
                    name="jiraBaseUrl"
                    value={formData.jiraBaseUrl}
                    onChange={handleInputChange}
                    placeholder="https://yourdomain.atlassian.net"
                    className="vercel-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Jira Email</label>
                  <input
                    type="email"
                    name="jiraEmail"
                    value={formData.jiraEmail}
                    onChange={handleInputChange}
                    placeholder="user@example.com"
                    className="vercel-input"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">API Token</label>
                  <input
                    type="password"
                    name="jiraToken"
                    value={formData.jiraToken}
                    onChange={handleInputChange}
                    placeholder="ATATT3x..."
                    className="vercel-input"
                  />
                </div>
              </div>
            </div>

            {/* AI Settings */}
            <div className="glass-panel p-6 rounded-lg space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5" />
                <h3 className="text-lg font-medium">LLM Provider (Vegas API)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-muted-foreground">Provider</label>
                  <div
                    className="vercel-input flex items-center justify-between cursor-pointer bg-[#0a0a0a]"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    <span>{providers.find(p => p.id === formData.llmProvider)?.label || "Select Provider"}</span>
                    <span className="text-muted-foreground text-xs">▼</span>
                  </div>

                  {dropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-border rounded-md shadow-lg z-10 overflow-hidden animate-in" style={{ animationDuration: '0.2s' }}>
                      {providers.map((provider) => (
                        <div
                          key={provider.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-accents-2 transition-colors flex items-center justify-between"
                          onClick={() => handleProviderSelect(provider.id)}
                        >
                          {provider.label}
                          {formData.llmProvider === provider.id && <CheckCircle2 className="w-3 h-3 text-primary" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground">LLM API Key</label>
                    <button
                      onClick={handleTestLLMKey}
                      disabled={testStatus.loading}
                      className="text-[10px] uppercase tracking-wider font-bold text-primary hover:text-white transition-colors disabled:opacity-50"
                    >
                      {testStatus.loading ? "Testing..." : "Test API Key"}
                    </button>
                  </div>
                  <input
                    type="password"
                    name="llmApiKey"
                    value={formData.llmApiKey}
                    onChange={handleInputChange}
                    placeholder="Enter your API key"
                    className="vercel-input"
                  />
                  {testStatus.error && (
                    <p className="text-[10px] text-red-500 mt-1 animate-in flex items-center gap-1">
                      <AlertCircle className="w-2 h-2" /> {testStatus.error}
                    </p>
                  )}
                  {testStatus.success && (
                    <p className="text-[10px] text-green-500 mt-1 animate-in flex items-center gap-1">
                      <CheckCircle2 className="w-2 h-2" /> {testStatus.success}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Automation Preferences */}
            <div className="glass-panel p-6 rounded-lg space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5" />
                <h3 className="text-lg font-medium">Automation Preferences</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <label className="text-sm font-medium text-muted-foreground">Default IDE Editor</label>
                  <div
                    className="vercel-input flex items-center justify-between cursor-pointer bg-[#0a0a0a]"
                    onClick={() => setIdeDropdownOpen(!ideDropdownOpen)}
                  >
                    <span>{ides.find(i => i.id === formData.preferredIde)?.label || "VS Code (code)"}</span>
                    <span className="text-muted-foreground text-xs">▼</span>
                  </div>

                  {ideDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-border rounded-md shadow-lg z-10 overflow-hidden animate-in" style={{ animationDuration: '0.2s' }}>
                      {ides.map((ide) => (
                        <div
                          key={ide.id}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-accents-2 transition-colors flex items-center justify-between"
                          onClick={() => handleIdeSelect(ide.id)}
                        >
                          {ide.label}
                          {formData.preferredIde === ide.id && <CheckCircle2 className="w-3 h-3 text-primary" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => setActiveTab("generate")} className="vercel-button">
                Save & Continue
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: Generate */}
        {activeTab === "generate" && (
          <div className="space-y-6 animate-in">
            <div className="glass-panel p-6 rounded-lg space-y-4">
              <div className="space-y-2 mb-6">
                <label className="text-sm font-medium">Target Jira Ticket Key</label>
                <div className="flex gap-4">
                  <input
                    type="text"
                    name="jiraTicket"
                    value={formData.jiraTicket}
                    onChange={handleInputChange}
                    placeholder="PROJ-1234"
                    className="vercel-input bg-accents-2 w-48"
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="vercel-button px-6"
                  >
                    {isGenerating ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </span>
                    ) : (
                      "Generate Workflow"
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Terminal */}
              <div className="mt-8 rounded-md bg-[#0a0a0a] border border-border overflow-hidden">
                <div className="flex items-center px-4 py-2 border-b border-border bg-[#111]">
                  <TerminalSquare className="w-4 h-4 text-muted-foreground mr-2" />
                  <span className="text-xs font-mono text-muted-foreground">build-output</span>
                </div>
                <div className="p-4 font-mono text-xs sm:text-sm h-64 overflow-y-auto space-y-2">
                  {generationLog.length === 0 && !isGenerating && !isDone && (
                    <span className="text-muted-foreground">Ready. Awaiting target ticket...</span>
                  )}
                  {generationLog.map((log, i) => (
                    <div key={i} className="flex gap-3 text-accents-6">
                      <span className="text-[#888]">{new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className={log.includes("success") ? "text-primary" : "text-[#ccc]"}>{log}</span>
                    </div>
                  ))}
                  {isGenerating && (
                    <div className="flex gap-3 text-accents-6 animate-pulse">
                      <span className="text-[#888]">{new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <span className="text-[#ccc]">_</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Download Section (Shows when done) */}
              {isDone && (
                <div className="mt-6 p-4 rounded-md border border-border bg-accents-1 animate-in flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <div>
                      <h4 className="font-medium">Orchestration Files Ready</h4>
                      <p className="text-sm text-muted-foreground">Download your PowerShell script and TOML config.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button onClick={downloadToml} className="vercel-button-secondary flex items-center gap-2">
                        <FileCode2 className="w-4 h-4" />
                        Download TOML
                      </button>
                      <button onClick={downloadPromptFile} className="vercel-button-secondary flex items-center gap-2">
                        <FileCode2 className="w-4 h-4" />
                        Download Prompt (.txt)
                      </button>
                      <button onClick={copyPrompt} className="vercel-button-secondary flex items-center gap-2 border-primary/30 text-primary">
                        <TerminalSquare className="w-4 h-4" />
                        Copy AI Prompt
                      </button>
                      <a href="/scripts/poll_toml_files.ps1" download className="vercel-button flex items-center gap-2 bg-white text-black hover:bg-gray-200">
                        <TerminalSquare className="w-4 h-4" />
                        Get Windows Script
                      </a>
                    </div>
                    <div className="flex gap-3 pt-2 border-t border-border mt-1">
                      <span className="text-xs text-muted-foreground flex items-center mr-2">Additional Scripts:</span>
                      <a href="/scripts/File_Watcher.ps1" download className="vercel-button-secondary text-xs h-7 px-2">
                        File_Watcher.ps1
                      </a>
                      <a href="/scripts/File_Stopper.ps1" download className="vercel-button-secondary text-xs h-7 px-2">
                        File_Stopper.ps1
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
