# 0005. Local AI by default, cloud only via BYOK after local anonymization

Date: 2026-10-19
Status: accepted

## Context

The product promise is that candidate data stays on the user's machine. Local models are good enough for summaries and question generation, but some users will want a stronger cloud model. Sending raw CVs to a third party would break the promise and create a GDPR processor relationship the user may not have.

## Decision

- **Default provider is Ollama** on `localhost`, accessed through its OpenAI-compatible endpoint with `@ai-sdk/openai-compatible`. Default model `qwen2.5:7b-instruct`. The settings page has a "Test connection" button and a link to install Ollama.
- **Cloud providers are BYOK** (bring your own key): the user pastes their own key for Anthropic or any OpenAI-compatible endpoint. HRmit never ships a key and has no proxy server.
- **Enabling a cloud provider is an explicit opt-in** behind a dialog that names the provider, the endpoint, the fields that will be sent, and shows a link to the anonymization preview.
- **Anonymization runs locally before every cloud call.** It is a pure function in `packages/shared`: structured fields (name, email, phone) are replaced by `Candidate #<id>` and placeholders, followed by regex passes for emails, phones, URLs, addresses, dates of birth and PESEL numbers. Photos are never sent. The user can view the anonymized text at any time.
- **Local calls are not anonymized**, since nothing leaves the machine and full text gives better results.
- **Secrets at rest:** API keys and SMTP passwords are encrypted with AES-256-GCM using a master key generated on first run into `./data/master.key`. They are never returned by the API, logged, or included in exports.

## Consequences

- One provider abstraction covers Ollama, LM Studio, OpenRouter, Groq and OpenAI; Anthropic is the one extra adapter.
- Anonymization is heuristic. Names mentioned only in the CV body can slip through, and the UI says so. A local NER model is a possible later upgrade and would slot into the same function.
- The master-key approach protects against leaks through backups, logs and screenshots, not against an attacker with disk access. OS keychain integration was rejected for MVP because it needs native modules and is unreliable on Windows.
- Users on a 7B local model get noticeably weaker output than cloud users. That is the honest trade of "local by default" and is stated in the README.
