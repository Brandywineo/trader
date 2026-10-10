# Agent Trader — infrastructure and paper-trading foundation

TypeScript application for Node 24+, with a private owner monitor, encrypted API credentials, manual Start/Stop, SQLite persistence and a DEX Screener paper worker. No npm dependencies or build step. Node's built-in SQLite is experimental in Node 24; runtime prints that warning.

## Run locally

```bash
npm test
npm run setup
npm start
```

Setup prompts for the app origin and generates the owner password and encryption key. Store the generated password safely. For local testing use `http://localhost:9010`, then open that exact origin. For production use your HTTPS origin. `.env` and `data/` must never enter Git. Back up both together securely: losing the encryption key makes saved credentials unrecoverable. Change the password hash with the service stopped; restarting invalidates sessions.

## Owner workflow

1. Sign in with the generated password.
2. Add keys under Connections. Secrets are encrypted using AES-256-GCM and never returned to the browser.
3. Test the connection. A metadata probe verifies accepted credentials, not inference credit or full trading readiness.
4. Leave paid AI off to run the free deterministic paper worker. To use an adapter, stop the worker, save/test its key, enable it in Worker settings and set daily limits. Select one AI provider and a model your account can access.
5. Click **Start paper worker**. It scans immediately and every minute. Click **Stop** to pause all paper activity; open positions remain. Stop does not liquidate positions. Start resumes quote checks. Service restarts always leave the worker stopped.

## Implemented vs pending

| Connection / feature | Current behavior |
|---|---|
| DEX Screener | Reads latest token profiles and Solana pair snapshots, limited to 20 recent profiles plus open positions; incomplete market coverage |
| Jev | Models-endpoint test and optional real paid Noul scoring before paper entry |
| OpenAI / Grok / Groq | Encrypted keys, models probe and validated JSON watchlist scoring; owner selects one provider/model |
| X | App Bearer Token, recent-search probe, up to 10 recent address mentions; cached 15 minutes and available to AI scoring |
| Solana RPC | Helius API key, authenticated slot probe, mint/freeze authority and largest token-account concentration checks; cached five minutes |
| Wallet / execution | **No signer, wallet key storage, swaps or live trading**; live start requests rejected |
| Dashboard | Public animated SVG operations room at `/`, private controls at `/owner`, GeckoTerminal pool OHLCV with volume and view controls; recorded paper equity |
| Database | SQLite WAL for a single process; PostgreSQL/queue split deferred |
| Budget | Durable UTC daily AI request cap plus separate Helius-check and X-search caps. Every attempted call reserves a slot before sending, including failures. Not a dollar billing cap |

Start with no subscriptions. Worker adapter calls occur only after enabling an adapter and clicking Start. Connection tests can have provider charges (especially X); they are owner-triggered and not covered by the worker caps. Saving keys alone does not enable adapters. Do not enter wallet seeds or private keys in this application.

## Paper strategy and limitations

Baseline test strategy: require USD liquidity >= 50,000, 24h volume >= 100,000 and positive 5m price change. Optional AI gate requires >= 0.8 watchlist score. The AI score is not proof of safety, calibrated trading success or expected profit. Owner-configurable fixed USD or percentage-of-cash sizing, per-position and total open-cost caps, maximum positions and UTC-day loss limit (defaults: 3 positions, USD 25 per entry/position, USD 75 exposure, USD 50 daily loss), one-hour token cooldown, 5% stop, 10% target and one-hour timeout. Simulated fills charge 0.5% fee plus 0.5% slippage each side. Initial paper cash is USD 1,000. Missing quotes leave positions open and flag valuations stale; stops can gap between one-minute samples. There is no chain-fee model, historical backtest, complete contract-extension/holder/honeypot vetting, verified live fills or demonstrated profitable edge. Never deploy this strategy as live execution without those layers.

## Hestia deployment

Choose a dedicated domain/subdomain and Hestia user. Repository: https://github.com/Brandywineo/trader. Deployment user: `jevv`. Domain: `trader.hs.vc`. Port: `9010`. Back up the existing default site first; do not clone into a nonempty directory.

```bash
cd /home/jevv/web/trader.hs.vc/public_html
git clone https://github.com/Brandywineo/trader.git .
npm test
npm run setup
mkdir -p data
```

Run setup as the Hestia user so `.env` is owned by them. Use HTTPS origin, e.g. `https://trader.hs.vc`. Node 24+ must be available at the path in the unit. Copy `deploy/agent-trader.service` to `/etc/systemd/system/`, the unit already targets jevv / trader.hs.vc; check `/usr/bin/node --version`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now agent-trader.service
curl http://127.0.0.1:9010/api/health
```

In the domain's existing Hestia SSL Nginx server block, configure its application location (keep certificate settings and Hestia includes):

```nginx
location / {
    proxy_pass http://127.0.0.1:9010;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Test `sudo nginx -t` before `sudo systemctl reload nginx`. Use a custom Hestia proxy template for durable config; generated config may be overwritten. Never expose port 9010 publicly. All owner mutations require same-origin plus a session CSRF token. Cookies are HttpOnly/SameSite=Strict and Secure for HTTPS. Password login is throttled (5 failed attempts / 15 minutes per socket IP); behind local Nginx this shares one bucket, so add proxy-level login rate limits if needed. Credential responses/upstream bodies are not logged. SQLite data/logs currently grow without automatic retention; monitor disk and back up while stopped or use SQLite backup tooling.

The unit restarts the web service after a crash, but deliberately does not auto-start paper trading. For updates, pull, run tests and restart the service; then sign in and click Start manually.

## Verification

`npm test` covers encryption tampering, password/origin checks, paper accounting and risk filters, plus HTTP authentication, CSRF, secret redaction, settings validation and live-mode rejection. No paid provider calls are made by tests. Real provider credentials and Hestia deployment must be verified on your server.

## Public dashboard

`/` serves a public read-only animated room. `/owner` serves the private login and controls. `/api/public` explicitly returns only paper-account display metrics, basic candidate data, snapshot history and selected worker events. It does not return credentials, connection status, CSRF tokens or API budgets; it does include paper risk limits and entry status. Account paper performance is intentionally public. Room screens and agent motion are decorative; market charts use GeckoTerminal pool OHLCV; equity and desk plots use recorded worker snapshots. Idle/pending roles are labelled. X address-mention collection is optional; raw posts remain owner-only. Reduce Motion system preferences disable animation.

### Room revision

The public layout uses a compact pink-framed two-row console, a detailed frontal SVG room, central pool candlestick display, server rack, radar, plants and nine distinct characters. The CRAWLER label represents market HTTP requests, not an implemented X crawler. Eight role cards are visible; the Jev station is inside the room. Character journeys replay newly observed real cycle events, labelled as event replay, rather than implying agents are still executing completed work. Idle bobbing, rack lights and radar motion are decorative. Stop or loss of the public connection cancels journeys. Phase events are transient and reset on service restart. Market charts use historical pool OHLCV from GeckoTerminal via `/api/chart?frame=1m|5m|1h`, including USD volume, zoom, earlier/later history navigation and hover details. Browser view controls do not change worker settings. The pool is discovered through DEX Screener for the persisted watched token (wrapped SOL until the first scan chooses a token); the token address fixes candle orientation. At most 200 bars are loaded. Gaps are not filled with invented candles. Charts work while the worker is stopped. Failed feeds show unavailable or retain explicitly stale bars with their original fetch time. GeckoTerminal chart attempts are globally capped at six per minute in-process, with 60-second caching, shared in-flight requests and failure backoff. Pool discovery is cached for ten minutes. These are minute-cached market charts, not a subsecond execution feed. Free API access needs no key; attribution is displayed. See https://api.geckoterminal.com/docs/index.html. Lower equity bars represent actual equity changes, not trading volume. Tests exercise real public-page JavaScript against a minimal DOM/canvas surface; this does not replace browser rendering verification.

### Scene detail update

Furniture is scaled to 76% and character bodies to 62% of the earlier scene, with shaded monitor frames, glass reflections, keyboards and chairs. Characters use separate aisle routes, pause at a destination, and return, with task bubbles anchored above them. Desk displays use actual scan counts, eligibility counts, cash/equity and recorded series. The temporary pipeline mesh illustrates task routing; it does not represent a holder or wallet relationship graph. Offline or stopped state clears task motion and its overlay.

### Continuous observations and filter explanations

A watched token is persisted in SQLite and requested on each scan alongside open positions and recent profiles. Snapshot rows include token identity so charts do not join tokens with identical symbols. Missing quotes are not interpolated. Rejection reasons expose the same price, liquidity, volume and momentum rules used by the paper worker. Character journeys use elapsed animation timestamps, so a throttled frame no longer stretches the route. The watched token is selected automatically; owner watchlist selection remains a future improvement.

### Adapter setup

Use the SOLANA connection for a **Helius API key**, not an RPC URL. Use X for an **app Bearer Token** with recent-search access, not an API key/secret pair or user-token probe. Groq and Grok are separate slots. Save and test each key while stopped, select adapters and model, save settings, then Start paper worker. Models probes validate credentials, not inference balance or selected-model access. Errors, malformed AI output, exhausted limits or adverse required on-chain checks block that candidate's new entry. Existing exit checks run before enrichment. A fresh market quote is fetched after enrichment before entry.

AI cap counts each inference attempt (success or failure), shared across the selected providers. Helius cap counts logical checks, each using two sequential RPC calls; X cap counts recent searches. Tests are owner-triggered and outside those caps, and X test searches may be billed. Zero limits block uncached checks. No automatic fallback to another paid provider. The worker evaluates one entry candidate per scan; enabling adapters does not independently create trading agents. All execution stays simulated.

On-chain checks support the original SPL Token mint format only. Token-2022 is conservatively blocked until extension handling is implemented. A largest token-account share above 20% blocks entry; pool/custody accounts may trigger that rule and it is not a holder-ownership measurement. Social posts are untrusted data, not executable instructions or verified facts. A 0.8 AI watchlist score is not a profit probability. Default model IDs are editable because account access and provider model availability change.


## Owner sizing and daily loss

Stop the worker and wait for the current cycle to finish, then use `/owner` → Worker settings → Paper trade sizing. Existing database settings migrate automatically; saved provider keys, balance and positions are retained. Defaults preserve the previous $25 entry and three-position behavior, adding $25 per-position, $75 total open-cost and $50 UTC-day loss caps. Fixed or percentage-of-available-cash requests are reduced by available cash, per-position cap and remaining exposure, rounded down to cents. Neither Chief nor AI can increase these enforced caps. Lowering limits affects new entries and does not force existing positions closed.

Daily loss compares current cash plus net marked open positions against a persisted UTC-day baseline. On the first scan of a day, the baseline is reconstructed from current cash, open costs and that day's realized P/L; it persists across restarts and is not reset by changing settings. Entry fees/slippage and marked losses count. Reaching the daily loss limit blocks entries; stop/target/timeout exits still run while the worker runs. Missing open-position prices block entries. A full Stop pauses entries and exits. Prices are checked once per minute, so losses may exceed the configured threshold between scans. Settings do not accept real capital deposits, reset the simulated balance or enable live execution.

Deploy with `bash deploy/update-hestia.sh`; then sign in, review sizing and click Start paper worker. Charts load independently of Start. Wallet funding, signing and Jupiter live execution remain unimplemented and live mode is rejected.


## Owner screens and watched wallet

Owner navigation separates Overview, Connections, Worker settings, Wallet and Trades. Each has a bookmarkable `/owner/<screen>` URL under the same owner session. Saving or testing provider keys remains on Connections; sizing and adapter controls remain on Worker settings. The public room stays read-only.

Wallet is a private read-only mainnet watch screen. Save a public address after checking it, with the worker stopped. No wallet is created and no ownership is proven. The server validates that the base58 address decodes to exactly 32 bytes and reads through the encrypted saved Helius key. Neither addresses nor balances are included in `/api/public`. GET `/api/wallet` requires owner authentication; saving/removing addresses also requires origin and CSRF validation.

Each wallet snapshot makes four read-only RPC requests: SOL balance, SPL accounts, Token-2022 accounts and latest 20 address signatures. Successful/partial snapshots and failures are cached for 90 seconds, in-flight reads are shared, and rapid address changes cannot bypass the refresh cooldown. Wallet reads are outside worker adapter limits and may consume Helius credits. Missing data is shown unavailable, never replaced with a fake zero. Fully failed refreshes can display an explicitly stale previous snapshot. Exact token units are formatted from raw integer strings. Holdings are grouped by mint; only Circle native mainnet USDC (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) is labelled USDC. Other token names and prices are not inferred. Frozen holdings are flagged.

Funding details consist of the watched address, copy control, network identification and address Explorer link. Transfers happen in the owner's wallet app. This screen does not generate QR codes, create deposits/withdrawals, accept wallet secrets, allocate live capital or authorize spending. History contains address signatures with Explorer links, not classified cash flows, amounts or a complete token-account transfer ledger. Paper balance remains separate. Live mode remains rejected.

Next implementation: isolated signer and Jupiter quote/simulation flow, transaction validation and reconciliation, followed by explicitly owner-enabled live execution with enforced limits.


## Chart recovery and entry diagnostics

Pool selection prioritizes available positive quotes and known liquidity before ranking liquidity amounts. A missing-liquidity first result no longer prevents selecting a later valid pool; the same ordering applies to fresh pre-entry quotes. Entry thresholds, fees, stop/target, stake caps and chain filters are unchanged.

Chart discovery first tries DEX Screener, then independently queries GeckoTerminal token pools with base/quote token metadata. Candle requests specify the exact token address so quote-side tokens are not inverted accidentally. If no watched-token candles are available, the public screen can show a clearly labelled wrapped-SOL fallback; it does not merge candles from different tokens or change trading candidates. Discovery and candle requests share a six-request/minute in-process GeckoTerminal ceiling, in addition to 60-second shared chart caches. Safe error codes distinguish upstream HTTP failures, timeouts, invalid responses, missing pools and local rate limits. Both providers being unavailable can still leave charts unavailable.

Overview now shows Entry diagnostics: latest 100 terminal candidate decisions plus risk/cycle failures, with last-hour stage/outcome counts. Each row includes cycle id, timestamp, token identity, stage, outcome and standardized reasons. Stages identify market, selection/cooldown, chain, social, AI, fresh quote and fill. The SQLite audit retains the latest 30,000 rows across restarts; it begins after this update and does not reconstruct prior missing history. A cycle evaluates at most one eligible candidate, and unselected candidates are explicitly marked skipped. Providers' raw errors, response bodies and credentials are never included. Connections also shows the latest 20 AI attempts with provider/model, worker/probe purpose and safe failure codes; legacy rows without metadata are labelled unknown/legacy.

Connections → JEV → Test Jev inference makes one small synthetic watchlist evaluation using the saved Jev key and configured Jev model (jev-latest if a different AI provider is selected). Stop and wait for the worker first, then check the paid-request consent box. This tests the actual inference path, not only model listing. It creates no trade and does not change strategy settings. One probe attempt is allowed per UTC day, including failures, shared with the owner AI daily cap. Reservations and failure state persist across restarts. Concurrent probes/key changes/settings changes/Start are blocked while testing. Diagnostic usage incurs provider credits; the request cap is not a dollar spending cap. After testing, click Start to resume the paper worker.

### Discovery and paper AI experiments
The scanner combines latest profiles, recently updated profiles from DEX Screener plus GeckoTerminal trending and top Solana pools. Independent source failures are shown in owner Overview. A bounded six-hour in-memory list rotates up to 90 discovery tokens per scan; open positions and the chart watch are added separately, with quote requests batched at 30 addresses. Pool/profile inclusion is not an endorsement or a complete Solana feed. Missing token quotes are recorded as rejections.
AI evaluation records persist in SQLite, keyed by provider/model/token. A coarse market-evidence fingerprint reuses successful scores for 30 minutes; changed evidence and failures wait at least 15 minutes before another paid attempt. New worker calls are additionally paced by the owner interval (default 60 minutes), and still count against the shared daily cap. Cached scores still require current market, chain, risk and pre-entry quote checks. Daily caps do not pause exits.
Worker settings expose minimum AI score (0.50–1.00, existing default 0.80) and paid-request interval (5–1440 minutes). The score is not a calibrated win probability. Overview shows latest-per-token score counts/range/mean and how many meet the selected threshold; these descriptive scores do not establish profitability. Lower thresholds are explicit paper experiments, not automatic calibration. Existing owner limits and market/on-chain gates remain in force.
Every service boot logs that the worker is stopped. Owner pages show a stopped-worker alert across all screens and an overdue-scan warning while running. Start remains an explicit owner action after a deployment.

New AI-assisted paper positions retain entry score/provider/model. Overview reports completed AI-tagged trade counts, profitable exits and net simulated P/L for the chosen provider/model. Legacy trades without recorded scores remain untagged; results are descriptive and require enough paper outcomes before threshold calibration.

### Exact pool discovery
Broad symbol searches are removed. GeckoTerminal trending/top pools are read every five minutes, sharing the chart provider request ceiling. Token metadata addresses must match Solana relationship IDs and decode to 32 bytes; pool IDs must match pool addresses. Canonical wrapped-SOL/USDC reserve-only pairs are excluded from new pool discovery. A token bearing the symbol SOL is not treated as wrapped SOL. Discovered pool IDs constrain both initial entry quotes and refreshed pre-entry DEX quotes; missing exact-pool quotes are rejected. Open positions can still use another DEX pool quote for risk exits. This matches provider identities, not an endorsement or proof of token safety. Source failures/invalid identities are shown in owner Overview and other discovery sources continue.

### Inactive chart recovery
A successful HTTP candle response is not sufficient to label a chart current. The latest actual candle must be within 15 minutes for 1m/5m charts, or three hours for 1h charts (three frame intervals, with a 15-minute floor). Empty intervals are not fabricated. An inactive watched-token series switches to a labelled canonical wrapped-SOL fallback only when SOL candles are current. If both are unavailable or old, watched-token history remains explicitly labelled historical/inactive. This does not change the persisted watch, worker candidates, trading rules or owner settings. Chart headers show latest candle time separately from HTTP fetch time; cached bars age out of current status too.
