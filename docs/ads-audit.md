# Local Meta Ads Audit

Open **Insight → Ads Audit** (`/ads-audit`) after opening a FLUX workspace.

## Run

1. Install dependencies (`npm install`, or use the existing Bun lockfile with Bun) and run `npm run dev`.
2. Run an installed Ollama model locally. Example shell startup (quit an already-running Ollama daemon first if its port is occupied):

   ```sh
   OLLAMA_NO_CLOUD=1 OLLAMA_ORIGINS="http://127.0.0.1:3000,http://localhost:3000" ollama serve
   ```

   Install the model of your choice with `ollama pull <model>` separately. Downloads and hardware requirements depend on the model. The dashboard never installs models.
3. Import a comma-separated UTF-8 **ad-level aggregate** CSV for the last 30 days. Export one row per ad, without breakdowns, daily rows, summary totals or mixed currencies. Split purchase, lead and each custom event into separate exports. Do not upload the source skill itself.
4. Confirm reporting dates, conversion event and currency. Verify tracker mapping for every ad set before checking the confirmation. Enter the primary event's EMQ from Events Manager; the source threshold is 8.5. Targets and a separate 90-day hold baseline are optional.
5. Review calculated findings; use **Check connection**, choose an installed local model, then **Generate local explanation**. Export the audit as Markdown if you want to keep it. Clear data or leave the page to remove the in-memory import.

### Columns

Required: `Ad ID`, `Ad name`, `Ad set name` (or `Ad set ID`), `Spend` (or `Amount spent (BDT)` etc.), `Impressions`, `Link clicks`, and the selected result column: `Purchases`, `Leads`, or `Results` for one specific custom event.

Optional: `Campaign name`, `Ad status`/`Ad delivery`/`Effective status`, `Revenue`/`Purchases conversion value`, `Video plays`, `3-second video plays`, `ThruPlays`, `Ad age days`.

Only ACTIVE/Delivering ads with impressions are included. If status is absent, explicitly confirm the export was filtered to active ads. An explicit inactive status always overrides that confirmation. CSV purchases are already deduplicated; do not sum overlapping API purchase actions into them. Link clicks are intentionally required instead of mixing all-click CTR with link CTR. Use a decimal point, optional comma thousands separators inside quoted fields; localized decimal-comma numbers are rejected. Blank required metrics are errors, not zero. Blank optional values remain unknown. Duplicate ad IDs are rejected to prevent daily/breakdown double-counting. Files are limited to 5 MB and 10,000 rows.

### Local inference & privacy

Imports and narratives stay in component memory. They are not added to Firestore, workspace records or localStorage. On Generate, FLUX sends the calculated audit, ad labels and supplied metadata to a validated loopback Ollama origin. `/api/show` checks local model metadata before metrics are sent; remote host/model metadata and cloud model names are rejected. Redirects are rejected. Run with `OLLAMA_NO_CLOUD=1` as an additional daemon-level safeguard; a user-managed local proxy/server remains a trust boundary.

The existing Ollama setting supplies initial endpoint/model defaults; edits on this dashboard are session-only. There is no cloud fallback, direct Meta API access, ad-account mutation, credential storage, automatic model download, or automatic report upload. HTTP localhost from a hosted HTTPS site depends on browser local-network permissions and CORS; running FLUX locally is the supported straightforward configuration.

Generation can be cancelled and times out after 3 minutes. Malformed/error/incomplete NDJSON streams are reported; partial text is marked by the error and should not be treated as a finished audit. Oversized explanation contexts are rejected rather than silently omitting ads. Calculated findings are still exportable. Model output is an advisory draft, never a replacement for the calculated classifications.

## Source evidence and implementation boundary

Investigation followed the installed REA skill's evidence-first/source-first guidance. The public landing page links the complete audit rules, so a proprietary implementation did not need to be guessed or decompiled. No GoMarble account was accessed, and no private application behavior is claimed.

- E1 (observed public documentation): https://www.gomarble.ai/mcp-workflows/claude-skills/
- E2 (observed published framework): https://github.com/gomarble-ai/marketing-agent/blob/main/skills/gomarble-skills-meta-ads-audit/SKILL.md — inspected blob `45f38bb76806f6ce4ab5837d851ca5b8b8d1db8c`.
- E3 (local diagnostic): REA CLI 6.5.0 `doctor --client codex --json` reported missing Codex MCP registration. The installed skill file was readable. No setup/configuration writes or native engine installation were performed. These E1–E3 labels are this project's finding ledger, not REA-generated Evidence IDs. No REA runtime capture or binary analysis occurred.
- Local-only configuration and remote-model metadata checked against Ollama's primary sources: https://github.com/ollama/ollama/blob/main/docs/faq.mdx and https://github.com/ollama/ollama/blob/main/api/types.go (`ShowResponse.remote_host`, `remote_model`, `model_info`).

| Framework area | Implemented | Evidence limits |
| --- | --- | --- |
| Data inventory | Header mapping, status/date/currency/event confirmation, optional-field gaps | User must verify dates and event mapping against the actual export |
| Initial health | Manual EMQ threshold and missing-signal checklist | Audience setup is not inferred from CSV |
| Conversion metric focus | Separate purchase ROAS, lead CPL, custom CPR scopes | Mixed event exports must be split manually |
| Performance | Aggregate spend/results/CPA, revenue completeness, protected winners/ties, age and weekly-signal floors, 2× target / 3× ad-set CPA review rules | No automatic pause; missing attribution/segments/comments require further diagnosis |
| Creative | Hook = 3s views / video plays; hold = ThruPlays / 3s views; target-aware hook/body/CTA test suggestions | No visual/audio inspection or 90-day baseline inferred from 30-day data |
| Campaign structure / bid / audiences | Explicit missing-data boundary | Not implemented from aggregate CSV; requires targeting, bid configuration and separate breakdown/time-series inputs |
| Fatigue, attribution, scale | Missing-data notices; no action conclusions | Need 14+ daily observations, attribution windows, segment distribution and additional diagnostics |

### Deliberate design choices (inferences, not observed GoMarble behavior)

- GoMarble's literal Pareto wording retains cumulative spend ≤90%, which can exclude the first ad when it alone exceeds 90%. FLUX includes the boundary-crossing ad to cover **at least** 90%, and protects all top converters across the full active set. The UI calls this a focus set; all ads remain visible.
- Source hook thresholds leave a gap at 25% and fractional boundaries between 39% and 40%. FLUX treats 25% to less than 40% as intermediate, avoiding an undefined classification.
- Hold > account average +25% is interpreted as a **relative** increase (`baseline ×1.25`); the source wording is ambiguous.
- Potential pause criteria become **Review** candidates. Missing diagnostics prevent turning a statistical trigger into a definitive action. No scaling or structural changes are generated by the deterministic engine. A Keep label protects against pausing and does not establish scalability.
- Stale ranges (ending more than 3 elapsed days ago), missing tracker confirmation, missing EMQ, or EMQ <8.5 block Review classifications. Source freshness guidance is roughly one to two days; the 3-day boundary tolerates end-of-day export timestamps.
- Local models explain already-calculated findings with an explicit grounding prompt. Prompt compliance is not guaranteed; drafts remain separate and require human review.

## Verification

`npm run test:ads-audit` (Node 22.18+ / 24+ with native TypeScript stripping) tests parsing, malformed imports, duplicate prevention, metric separation, protected converters/ties, age/tracking/freshness checks, status filtering, unknown revenue, Pareto boundaries, hook/hold formulas, endpoint restrictions, local-model preflight, split/final NDJSON frames, cancellation, malformed/error/incomplete responses and oversized contexts.

`npm run build` validates TypeScript and produces the production/PWA bundle. Browser verification used fictional demo data in a disposable local QA workspace. No real advertising data was accessed. Live model quality/performance must be verified with the user's installed model; Ollama was not running during implementation.


## Campaign-level exports

The importer also detects Meta's campaign-level export (`Campaign name`, without `Ad name`). It automatically reads reporting dates and currency from `Amount spent (XXX)`, and groups results using the **exact Result indicator**. Purchases and messaging conversations are displayed separately with their own spend and recalculated cost per result. It includes campaign delivery/status, per-campaign reach/frequency, attribution windows, spend bars, and an all-campaigns/active-only scope control.

All exported statuses are included by default in campaign summary mode; use the explicit active-only filter to exclude completed/inactive campaigns. Every displayed total, event group, local-model context and Markdown export follows the selected scope. Account reach/frequency are not calculated from summed campaign reach, and missing revenue/click/video data are not invented. Campaign-only data never receives ad-level protected-winner classifications or pause/scale decisions. Mixed reporting windows and duplicate campaign rows are rejected.

A real Meta campaign export was tested locally through the file picker, reconciled independently with Python Decimal arithmetic, and checked in both scope views. The real CSV, campaign names and metrics are not included in the repository or test fixtures. Automated regression tests use fictional examples. Browser export was verified; live model generation remained unavailable because the local Ollama endpoint was offline.
