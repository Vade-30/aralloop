// Checks the AI setup before a demo. Run with: npm run check:ai
//
// Prints which provider and model the app will use (never the key), then makes
// one very small real call to each provider that has a key and says whether it
// worked. Each call costs a few dozen tokens.
//
// Relative imports on purpose: tsx does not resolve the "@/..." alias.

import { z } from "zod";
import { AiError, type AiErrorCode } from "../src/lib/ai/errors";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENAI_MODEL,
  generateJson,
  getAiStatus,
} from "../src/lib/ai/provider";

interface ProviderInfo {
  name: "openai" | "gemini";
  label: string;
  keyVar: string;
  modelVar: string;
  defaultModel: string;
  /** Where to look when the account, not the code, is the problem. */
  keysPage: string;
  billingPage: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    name: "openai",
    label: "OpenAI",
    keyVar: "OPENAI_API_KEY",
    modelVar: "OPENAI_MODEL",
    defaultModel: DEFAULT_OPENAI_MODEL,
    keysPage: "https://platform.openai.com/settings/organization/api-keys",
    billingPage: "https://platform.openai.com/settings/organization/billing",
  },
  {
    name: "gemini",
    label: "Gemini",
    keyVar: "GEMINI_API_KEY",
    modelVar: "GEMINI_MODEL",
    defaultModel: DEFAULT_GEMINI_MODEL,
    keysPage: "https://aistudio.google.com/apikey",
    billingPage: "https://aistudio.google.com/apikey",
  },
];

const checkSchema = z.object({ ok: z.boolean(), word: z.string() });

function isSet(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function advice(code: AiErrorCode, provider: ProviderInfo): string {
  switch (code) {
    case "auth":
      return `The key was rejected. Check ${provider.keyVar} in .env.local: no quotes, no spaces, and the key must still be active (${provider.keysPage}).`;
    case "rate_limit":
      return `The account is out of credit or over its limit. Check billing and limits at ${provider.billingPage}, or wait a minute and run this again.`;
    case "timeout":
      return "No answer within 45 seconds. Check the internet connection and run this again.";
    case "network":
      return "The service could not be reached. Check the internet connection, and any VPN or firewall.";
    case "invalid_output":
      return `The model answered, but not in the expected shape. Run this again. If it keeps failing, remove ${provider.modelVar} from .env.local to use the default model (${provider.defaultModel}).`;
    case "unknown":
      return `Read the detail above. "Model not found" or HTTP 404 means the model id is wrong: remove ${provider.modelVar} from .env.local to use the default (${provider.defaultModel}), or set it to a model your key can use.`;
  }
}

/** Makes one small call with this provider forced. Returns true if it worked. */
async function check(provider: ProviderInfo): Promise<boolean> {
  process.env.AI_PROVIDER = provider.name;
  const model = getAiStatus().model;
  console.log(`\nChecking ${provider.label} (${model})...`);

  const started = Date.now();
  try {
    const result = await generateJson({
      task: "check",
      system: "You are a connection test. Answer with JSON only.",
      user: 'Return {"ok": true, "word": "<any one English word>"}.',
      schema: checkSchema,
      maxOutputTokens: 200,
    });
    console.log(
      `  OK. ${provider.label} answered in ${Date.now() - started} ms with the word "${result.data.word}".`,
    );
    return true;
  } catch (error) {
    if (error instanceof AiError) {
      console.log(`  FAILED (${error.code}). ${error.userMessage}`);
      console.log(`  Detail: ${error.message}`);
      console.log(`  What to do: ${advice(error.code, provider)}`);
    } else {
      console.log(`  FAILED. ${error instanceof Error ? error.message : String(error)}`);
      console.log("  What to do: this looks like a bug in the code, not in the setup. Tell the team.");
    }
    return false;
  }
}

async function main(): Promise<void> {
  const forced = process.env.AI_PROVIDER?.trim() || null;
  const status = getAiStatus();

  console.log("AralLoop AI check\n");
  console.log("Settings found (keys are never printed):");
  for (const provider of PROVIDERS) {
    const model = process.env[provider.modelVar]?.trim() || `${provider.defaultModel} (default)`;
    console.log(
      `  ${provider.label.padEnd(7)} key: ${isSet(provider.keyVar) ? "set" : "not set"}, model: ${model}`,
    );
  }
  console.log(`  AI_PROVIDER override: ${forced ?? "none"}`);

  console.log("\nThe app will use:");
  if (status.provider === "mock") {
    console.log("  Sample mode. No real AI is called and results are labelled as samples.");
  } else {
    console.log(`  ${status.provider} (${status.model})`);
    console.log(`  Fallback: ${status.fallback ?? "none"}`);
  }

  const configured = PROVIDERS.filter((provider) => isSet(provider.keyVar));
  if (configured.length === 0) {
    console.log(
      "\nNo API key is set, so there is nothing to call. To use real AI, copy .env.example to .env.local, add OPENAI_API_KEY or GEMINI_API_KEY, and run this again.",
    );
    return;
  }
  if (forced === "mock") {
    console.log("\nNote: AI_PROVIDER=mock keeps the app in sample mode. The keys are still checked below.");
  }

  let failures = 0;
  for (const provider of configured) {
    if (!(await check(provider))) failures += 1;
  }
  // check() forces each provider in turn; put the setting back as it was.
  if (forced === null) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = forced;

  console.log("");
  if (failures === 0) {
    console.log("All configured providers answered. The AI setup is ready.");
  } else {
    console.log(`${failures} of ${configured.length} configured providers failed. See what to do above.`);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("The check itself failed to run:", error);
  process.exitCode = 1;
});
