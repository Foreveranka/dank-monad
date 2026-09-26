# DANK — reputation-based credit on Monad

DANK is a **testnet-only unsecured credit prototype**, with score-based guarantor support and a public lending dashboard. Hackathon achievements are optional evidence, not the product's purpose or an entry requirement.

- Website: https://dank-monad.vercel.app
- Application: https://dank-monad.vercel.app/app
- Public dashboard: https://dank-monad.vercel.app/dashboard
- Documentation: https://dank-monad.vercel.app/docs
- Network: Monad Testnet, chain ID **10143**
- Contract and token addresses: `lib/deployment.json`

**USD is a freely mintable test token, not Circle USDC, not real dollars. This is not mainnet lending and has not had an independent security audit.**

## Implemented

- Public registration; a valid score of at least 80 is required to borrow or guarantee. New accounts start with zero reputation.
- Total support capacity: 80–89 points → 80 USD; 90–94 → 200 USD; 95–100 → 500 USD. Assigned account limits can reduce this further. Existing commitments consume this total. The contract enforces automatic support allocation and prevents multiplying capacity across loans.
- Amortizing 1–12 month loans at 15% regular annual interest; early payoff, default and loss recognition; capacity released on repayment or cancellation.
- Open liquidity deposits during lending. Providers receive proportionate shares priced against available cash plus outstanding principal net of recognized losses. Uncollected interest is excluded. Collected income increases pool assets. Later deposits buy at the updated value.
- Explicit risk acceptance is a signed onchain transaction bound to the contract's risk-policy hash. Deposits without acceptance revert. Withdrawals open only after administrator settlement; all outstanding principal must first be repaid or recognized as loss.
- Public dashboard with loan states, remaining principal, schedules, guarantors, provider shares and paginated payment events. RPC reads are batched and fixed to a block. Payment windows cover 1,000 blocks in batches of 100, with navigation to older blocks.
- Five languages (Turkish, English, German, Spanish, French), country/browser preference fallback and manual choice; light/dark themes; a separate landing page.

## Verified test scenario

`lib/test-scenarios.json` contains **public addresses and transaction hashes only**. Six synthetic profiles were assigned scores 80, 85, 90, 95, 100 and 79 by the test administrator. Five wallets received loans of 20, 30, 40, 50 and 60 USD. Two loans were repaid; three retain 150 USD total principal. The 79-point wallet's loan transaction reverted onchain. It separately accepted liquidity risks and deposited 10,000 test USD into the initially 50,000 USD pool, receiving exactly 1/6 of its shares.

These scores are **synthetic test fixtures**, not earned reputation or proven real-world creditworthiness. Old test deployments are recorded in `lib/deployments-history.json`.

## Scoring scope and limitations

Pilot policy: wallet/DeFi history up to 80 points, optional hackathon evidence up to 20. Participation earns one point once; the first verified podium replaces it (first 20, second 10, third 5) and locks that category. Later wins add nothing. The weights are not a calibrated credit-risk model.

The wallet endpoint currently reads native balance and nonce from Monad mainnet (143). The historical DeFi feed is **not connected**. Missing metrics cannot approve real credit. Owner attestations expire; synthetic test scores are separately labeled and expire after at most 30 days. Mainnet risk controls, Sybil resistance, data-provider integration and independent audits remain future work.

## Run locally

Requires Node >=22.13 and Foundry for Solidity tests.

```sh
npm ci
npm run dev:vercel
# http://localhost:5180
npm run build:vercel
node --experimental-strip-types --test tests/scoring.test.ts tests/support.test.mjs
forge test --root contracts
```

Optional proof-management APIs need a private `DATABASE_URL` for Neon Postgres. Apply the migration with `node --env-file=.env.local scripts/migrate-postgres.mjs`. The public dashboard reads the chain without a database or wallet login. Never commit environment files, deployment keys or generated wallet files.

Contract tests cover score boundaries, automatic total support, multiple commitments, synthetic-score permissions, risk consent, proportional LP shares, cash vs. receivables, losses, repayments, wallet migration and 256 amortization fuzz cases. This test suite is not an independent audit.

## Administration

The owner can attest scores, assign test scores, set account limits, disable members, pause new activity, recognize sufficiently overdue losses and settle a completed lending cohort. Risk acceptance explicitly discloses these powers. Reputation guarantees are not cash collateral and do not ensure repayment.

Project image and logo: `public/brand/`. Hackathon submission is performed by the project owner, not by repository scripts.
