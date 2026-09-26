# DANK — Monad Blitz Istanbul

Public-testnet unsecured credit prototype. Mainnet invitation gating is only a future plan. Landing `/`, application `/app`, policy `/docs`. Five languages (TR, EN, DE, ES, FR), country/browser fallback and remembered manual selection.

## Current status

Testnet-only Solidity contracts (Monad 10143, local 31337). Custom freely mintable USD is **not Circle USDC** and has no financial value. Deployment addresses are in `lib/deployment.json`; `deployed: false` means transactions cannot yet run on Monad. The UI simulation is explicitly separate from real wallet state.

## Scoring policy v2

Participation: one point once. The first verified podium replaces participation: first 20, second 10, third 5. **The first podium locks the category**, even if a later result is better. Subsequent wins produce zero additional points. Hackathon score <=20 on the contract, not just in the UI. Identity IDs preserve this across wallet migration. A reviewer verifies membership and ownership of public Blitz evidence. The public project list alone is not proof of identity. Placement comes from the source API, never applicant input.

Wallet/DeFi proposed pilot allocation: history 10, eligible 90-day USD volume 10, median 90-day net assets 10, swap activity 10, lending amount-duration 10, seasoned repayments 20, LP/staking amount-duration 10. Total wallet score <=80, combined <=100. These are **uncalibrated pilot weights**, not a validated credit-risk model. Rules and boundary tests live in `lib/scoring.ts`.

The live wallet endpoint reads Monad mainnet chain 143 native balance and sender nonce at a fixed block. **No DeFi history feed is connected yet**. All seven historical metrics remain unknown; missing data cannot be scored as complete or approve credit. Nonce is not a count of successful transactions or unique people. A production ingestion adapter must identify allowlisted contracts, decode economic actions, deduplicate transaction/log events, exclude self-transfers and round trips, net borrowed assets out of balances, use time-weighted/median balances, enforce seasoned loan thresholds, and attach verifiable source blocks and prices. The policy engine is not that adapter.

`updateWalletScore` is a trusted pilot administrator attestation, <=80 points with a unique evidence hash and <=7-day expiry. Refreshes replace, never accumulate. No automatic UI approval is offered for incomplete feeds. Expiry blocks new borrowing/guaranteeing and activation; repayment remains possible. It never clears default strikes. Admin honesty is a trust assumption. The testnet operator is the public `admin` address in deployment.json; its private key is outside this repository.

## Lending

15% nominal annual rate, 1–12 calendar-month installments, 10–1000 USD contract bounds with separately assigned personal limits. Three-day overdue gate. Default after 30 days blocks borrower and direct guarantors. Guarantors do not assume repayment liability or authorize withdrawals. At most eight backing loans/guarantors bound loops. Early repayment waives future interest. Overdue interest compounds at 20%/365 and lifetime penalties cap at original principal. Loss recognition after 90 days leaves recovery debt intact. No automatic forgiveness, group exposure analysis or Sybil-proof identity is implemented.

Funding is a closed cohort: deposits precede lending, owner settles only when outstanding principal is zero or recognized as loss. Original contributors receive subsequent recoveries proportionally. No immediate liquidity guarantee. Admin can pause new activity, approve members/limits and recognize losses but cannot directly drain funds through an admin withdrawal method. This prototype has not received an independent security audit.

## Data and authentication

Neon Postgres on Vercel stores invite applications, evidence and short-lived one-use wallet challenges. Signature binds domain, action and payload hash. User-submitted evidence cannot change points by itself. The previous Sites publication retains its separate D1 storage; this Vercel deployment uses the newly provisioned Postgres database. No private keys or KYC documents in the DB. This is an EOA-signature prototype; smart-contract wallet signature support is not implemented.

## Local checks

- `npm install`
- `npm run dev` (default 5173; current session uses 5175)
- `npx tsc --noEmit`
- `node --experimental-strip-types --test tests/scoring.test.ts`
- `forge test --root contracts` (Foundry needed)
- `npm run build`

Use `node --env-file=.env.local scripts/migrate-postgres.mjs` for database migrations, `npm run build:vercel` to build and `vercel --prod` to publish. WalletScore RPC source: https://docs.monad.xyz/developer-essentials/network-information
History provider reference: https://docs.monad.xyz/tooling-and-infra/indexers/common-data

## Launch gates

The dedicated testnet deployer was funded through the documented DevNads agent faucet. USD and Dank are deployed; `lib/deployment.json` and `lib/pool-bootstrap.json` record the addresses and 50,000 USD pool funding. Connect/validate the DeFi indexer and protocol adapters before awarding wallet credit scores. Complete independent security/risk and applicable compliance review before any real-money launch. No mainnet lending or hackathon submission is performed by this repository.

Public test onboarding: `register()` creates an 80 USD test limit and 80 USD guarantee capacity with zero reputation points. Registration needs only the caller wallet and test gas. Starter allocations must never be presented as verified achievements. The deployed prototype remains a closed lending cohort: the 50,000 USD pool is now in Lending phase, so new capital deposits are closed for this cohort.
