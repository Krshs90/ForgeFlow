"use client";

import { useState } from "react";
import { Settings, Play, Database, FileCode2, TerminalSquare, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("config");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationLog, setGenerationLog] = useState<string[]>([]);
  const [isDone, setIsDone] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    jiraBaseUrl: "",
    jiraToken: "",
    jiraTicket: "",
    llmProvider: "gemini",
    llmApiKey: "",
    quickVarKey: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    if (!formData.jiraTicket || !formData.jiraToken || !formData.jiraBaseUrl) {
      alert("Please configure Jira Base URL, Api Token, and Ticket key first.");
      setActiveTab("config");
      return;
    }

    setIsGenerating(true);
    setIsDone(false);
    setGenerationLog(["Initializing ForgeFlow pipeline..."]);

    try {
      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
    a.download = `workspace-${formData.jiraTicket}.toml`;
    a.click();
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="text-sm font-medium text-muted-foreground">API Token</label>
                  <input
                    type="password"
                    name="jiraToken"
                    value={formData.jiraToken}
                    onChange={handleInputChange}
                    placeholder="eyJhb..."
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
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Provider</label>
                  <select
                    name="llmProvider"
                    value={formData.llmProvider}
                    onChange={handleInputChange}
                    className="vercel-input appearance-none bg-background cursor-pointer"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="chatgpt">OpenAI ChatGPT</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">LLM API Key</label>
                  <input
                    type="password"
                    name="llmApiKey"
                    value={formData.llmApiKey}
                    onChange={handleInputChange}
                    placeholder="sk-..."
                    className="vercel-input"
                  />
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
                      <a href="/scripts/poll_toml_files.ps1" download className="vercel-button flex items-center gap-2">
                        <TerminalSquare className="w-4 h-4" />
                        poll_toml_files.ps1
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
