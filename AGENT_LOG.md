# AGENT LOG

Shared changelog for everyone (and every AI agent) working on the OJ Workspace:
Oscar and Jacob, Claude Code, Codex. Nobody can see anyone else's session, so
this file is how work gets handed over.

**Rules**
- Before starting non-trivial work, `git pull` and read the top few entries.
- After a meaningful change, add an entry at the TOP of the log below, in the
  format shown. Newest first. Never edit or delete someone else's entry.
- Say what you verified and what you did not. "Not tested" is a fine thing to write.
- Never paste a key, token, password or customer's personal details here.
- Plain ASCII.

**Entry format**

    ## YYYY-MM-DD HH:MM UTC -- Who (short title)
    **Summary:** what changed and why.
    **Files:** the main files touched.
    **Verified:** what was actually run or looked at, and the result.
    **Notes:** anything the next person needs to know, including what is unfinished.

---

## 2026-10-02 20:10 UTC -- Claude Code, for Oscar (Repo created; overhaul plan approved)
**Summary:** The OJ Workspace moved into its own private GitHub repo so Jacob can work on it too. Oscar approved a full overhaul: the workspace becomes the shared dashboard for all three businesses (OJ Exterior Care, OJ Solutions, OJ Essentials) with a dark navy redesign, real metrics, a calendar, documents and messages. The plan and build order are in docs/OVERHAUL_PLAN.md. This entry is stage 1 of 11: repo, this log, CLAUDE.md, CONTRIBUTING.md, .env.example, and a CI check that runs typecheck and tests on every push and pull request. No app code changed in this entry.
**Files:** AGENT_LOG.md, CLAUDE.md, CONTRIBUTING.md, .env.example, .github/workflows/ci.yml, docs/OVERHAUL_PLAN.md, docs/inspiration/, public/brand/source/.
**Verified:** see the stage 1 note in the pull history: typecheck and the existing test suite were run before the first commit.
**Notes:** Everything before this entry was built by Codex and is described in docs/BUILD_PLAN.md and docs/DEPLOYMENT.md; read both before changing access control or the database. The live app is still served from Oscar's PC (port 3011 behind the public address) from a build made before this repo existed. Decisions Oscar made: cloud hosting at the end; Exterior Care screens are rebuilt here while the existing oj-sms-system server keeps sending texts (never run a second SMS send loop); dark navy look with each business section in its own logo colours; OJ Solutions numbers come from GoHighLevel.
