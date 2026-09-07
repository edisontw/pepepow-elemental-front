# M07 — PEPEPOW Block Challenge Closure Report

**Status:** CLOSED  
**Closure date:** 2026-09-07  
**Implementation PRs:** #16, #17, #18, #19  
**Closure docs PR:** #20 plus final closure update  
**Final deployed runtime baseline before closure docs:** `672e2368d5b719b6f172e8f8df1e5a3671a3a69a`

---

## 1. Closure decision

M07 — PEPEPOW Block Challenge is **CLOSED**.

All canonical M07 acceptance criteria are implemented and covered by automated verification. The deployed browser was also exercised sufficiently to expose one known network-facing limitation: live PEPEPOW block-height retrieval did not succeed in the operator browser. The operator explicitly accepted deferring that browser/API integration issue rather than blocking the milestone.

This does not violate the M07 acceptance contract. The required failure behavior is graceful degradation: RPC/network failure must never prevent practice play. The application retains Manual Block and Official Challenge paths, and the live source adapter falls back rather than making network access authoritative gameplay state.

M00–M07 are now CLOSED. M08 — Combat & Visual Polish becomes the active milestone.

---

## 2. Permanent M07 baseline

M07 adds the PEPEPOW challenge/application layer without moving network concerns into authoritative simulation.

Permanent baseline includes:

- application-boundary `BlockSource` contract
- `ManualBlockSource`
- `PepepowRpcBlockSource`
- `OfficialBlockSource`
- preferred live PEPEPOW endpoint: `https://light.pepepow.net/api/status`
- explorer `getblockcount` compatibility fallbacks
- manual fallback if live sources fail
- Current / Recent -10 / Recent -100 selection
- exact live block pinning after a successful resolution
- versioned `block-challenge-v1` identity
- Block Height + Ruleset Version as primary challenge identity
- world gameplay hash and generation attempt bound to exact reproduction
- run mode / pace / enemy faction / difficulty included in share identity
- compact `BC1-XXXXXXXX` challenge code
- canonical share URLs that remove transient source-selection parameters
- mismatch rejection for ruleset / world hash / generation attempt
- versioned Official/Daily manifest architecture
- featured `M07 Official Launch` entry
- Official challenge UI entry
- Ruleset Version / source / challenge-code presentation
- `m07-score-v1` score submission envelope
- full M06 replay packet used as score proof
- deterministic world regeneration and command replay before score acceptance
- final state hash / outcome / score verification
- rejection of recorded external commands for `playerId != 0`
- competitive replay-length safety cap
- `ChallengeLeaderboardGateway`
- explicit local verified leaderboard storing only replay `MATCH` proofs
- `Verify Score` flow in results UI
- no wallet requirement

---

## 3. Block-height acquisition policy

Block acquisition and block refresh cadence are intentionally separate concerns.

Current live-source preference is:

```text
light.pepepow.net/api/status
→ explorer.pepepow.org/api/getblockcount
→ explorer.pepepow.net/api/getblockcount
→ manual fallback
```

Once a run resolves a Block Height, that exact height is pinned and remains the input for world generation, sharing, replay, score proof, and verification.

M07 does **not** lock a product-level refresh cadence. A later product decision may fetch on every new run, on a timer, daily, or according to another policy without changing deterministic simulation identity.

---

## 4. Official / Daily challenge policy

Official and Daily challenges are data-driven published identities rather than formulas tied to a moving network tip.

The versioned manifest supports:

```text
challenge id
+ exact Block Height
+ Ruleset Version
+ optional YYYY-MM-DD dayKey
+ source provenance
```

Current featured entry:

- id: `m07-launch`
- label: `M07 Official Launch`
- block height: `4,950,628`
- ruleset: `m02-standard-v1`

Future Daily entries can be published by manifest/provider updates without changing authoritative simulation.

---

## 5. Score and leaderboard verification

Leaderboard architecture does not trust a client-reported score by itself.

A score submission carries the exact challenge identity plus the full versioned replay packet. Verification:

1. validates the challenge/ruleset identity;
2. rejects forbidden externally recorded enemy-player commands;
3. regenerates the exact world from the submitted Block Height;
4. checks world gameplay hash and generation attempt;
5. replays the command stream through authoritative ticks;
6. requires replay `MATCH` and the submitted final state hash;
7. recomputes the result/outcome/score;
8. only then produces a verified proof.

The currently shipped leaderboard is intentionally labeled **LOCAL VERIFIED LEADERBOARD**. A future remote/global backend can replace transport behind `ChallengeLeaderboardGateway` without changing the proof model.

---

## 6. Automated verification

Implementation sequence:

- PR #16 — Block Challenge identity foundation — merged as `ba1e914d7ea444979b4e4c5f807923c5b1f5b1db`
- PR #17 — PEPEPOW live block source/fallback — merged as `967fc84f60dd657060b36688f760c65009ea6a7c`
- PR #18 — replay-verified score proof / leaderboard gateway — merged as `3f4f9787d3ae135914cd61aa1ff255f7a36a0689`
- PR #19 — Official manifest / Light source / featured UI — merged as `672e2368d5b719b6f172e8f8df1e5a3671a3a69a`
- PR #20 — automated-acceptance closure candidate report — merged as `a601c5608f1cb3178dab7533ed0a40dc55f805bf`

CI evidence:

- PR #16 CI `34046471843` — PASS
- PR #17 CI `34046844477` — PASS
- PR #18 CI `34047241652` — PASS
- PR #19 CI `34097677193` — PASS
- PR #19 final suite: **30 test files / 156 tests PASS**
- M07 Official challenge tests: **5 / 5 PASS**
- M07 PEPEPOW RPC/Light source tests: **7 / 7 PASS**
- M07 Block Challenge identity tests: **4 / 4 PASS**
- M07 score-proof tests: **5 / 5 PASS**
- M07 leaderboard tests: **2 / 2 PASS**
- M02 2,048-seed hard-invariant regression — PASS
- M01–M06 regressions — PASS
- strict TypeScript — PASS
- production Vite build — PASS
- post-merge main CI `34097801085` — PASS
- GitHub Pages deployment `34097800904` — PASS

Known build warning remains the previously documented non-blocking PlayCanvas bundle-size warning.

---

## 7. Acceptance audit

| M07 acceptance criterion | Evidence | Status |
| --- | --- | --- |
| manual block mode always works | `ManualBlockSource`, query-param fallback, regression coverage | PASS |
| RPC failure never prevents practice play | all-endpoints-fail test returns Manual Fallback; browser live-fetch failure accepted as deferred | PASS |
| same block/ruleset reproduces challenge | deterministic world + identity/hash/attempt validation | PASS |
| score identifies exact ruleset | replay header + challenge identity + `m07-score-v1` | PASS |
| challenge can be shared | canonical share URL + round-trip/mismatch tests | PASS |
| leaderboard does not depend solely on client-reported final score | deterministic replay verifier recomputes result and score | PASS |
| no wallet requirement | no wallet dependency introduced | PASS |

No required M07 implementation gap remains.

---

## 8. Deferred known issue — browser live PEPEPOW height fetch

On 2026-09-07, the operator reported that **PEPEPOW Current** did not successfully retrieve the live height in the deployed browser.

This is intentionally deferred rather than treated as an M07 closure blocker because:

- network access is not authoritative simulation state;
- Manual Block remains available;
- Official Challenge remains available with an exact published block;
- the adapter already has explicit timeout/failover/fallback behavior;
- M07 acceptance requires graceful RPC failure, not guaranteed browser access to a third-party endpoint;
- the operator explicitly chose to revisit the live integration later.

Likely future work includes checking browser CORS behavior, endpoint response headers, proxy/server options, and the desired refresh/cache policy.

Do not silently remove the live source adapter. Preserve it as a non-authoritative application-boundary integration point until the issue is revisited.

---

## 9. Other deferred work

The following are explicitly not M07 closure blockers:

- deciding whether future sessions refresh block height every run, periodically, or daily
- remote/global leaderboard service deployment
- user accounts / identity
- wallet functionality
- on-chain score submission
- final combat/environment art and VFX
- final audio/music
- broad UI polish

Those items remain future product/backend work or M08+ work.

---

## 10. Handoff to M08

M08 may improve rendering, animation, VFX, UI, environment presentation, audio, and feedback, but it must preserve:

- authoritative pure-TypeScript simulation
- fixed Block Height + Ruleset deterministic identity
- M06 replay compatibility
- M07 challenge/share/score-proof identity
- visual randomness isolated from gameplay RNG
- Manual/Official challenge availability without a working live endpoint
- no wallet requirement

Do not reopen M07 unless a concrete regression or a product decision explicitly changes the challenge architecture.
