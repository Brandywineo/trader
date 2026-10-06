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
4. Leave paid AI off to run the free deterministic paper worker. To use Jev, save/test its key, enable Jev scoring and set the daily request cap.
5. Click **Start paper worker**. It scans immediately and every minute. Click **Stop** to pause all paper activity; open positions remain. Stop does not liquidate positions. Start resumes quote checks. Service restarts always leave the worker stopped.

## Implemented vs pending

| Connection / feature | Current behavior |
|---|---|
| DEX Screener | Reads latest token profiles and Solana pair snapshots, limited to 20 recent profiles plus open positions; incomplete market coverage |
| Jev | Models-endpoint test and optional real paid Noul scoring before paper entry |
| OpenAI / Grok | Encrypted key storage and authenticated models probe only; analysis adapters pending |
| X | Encrypted token storage and `/2/users/me` probe requiring appropriate user token/scopes; crawler and social analysis pending |
| Solana RPC | Public `getHealth` probe only; stored keys are unused, paid RPC integration pending |
| Wallet / execution | **No signer, wallet key storage, swaps or live trading**; live start requests rejected |
| Dashboard | Functional monitor and connection controls; animated agent room and rich candlestick chart pending |
| Database | SQLite WAL for a single process; PostgreSQL/queue split deferred |
| Budget | Durable UTC daily Jev request cap. Every attempted call reserves a slot before sending, including failures. Not a dollar billing cap |

Start with no subscriptions. Paid calls occur only after enabling Jev and clicking Start. Connection tests can have provider charges (especially X); they are owner-triggered and not covered by the worker's Jev cap. Keys do not activate pending adapters. Do not enter wallet seeds or private keys in this application.

## Paper strategy and limitations

Baseline test strategy: require USD liquidity >= 50,000, 24h volume >= 100,000 and positive 5m price change. Optional Jev gate requires >= 0.8 watchlist score. The AI score is not proof of safety, calibrated trading success or expected profit. Maximum 3 positions, USD 25 per entry, one-hour token cooldown, 5% stop, 10% target and one-hour timeout. Simulated fills charge 0.5% fee plus 0.5% slippage each side. Initial paper cash is USD 1,000. Missing quotes leave positions open and flag valuations stale; stops can gap between one-minute samples. There is no chain-fee model, historical backtest, contract authority/holder/honeypot vetting, verified live fills or demonstrated profitable edge. Never deploy this strategy as live execution without those layers.

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
