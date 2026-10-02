# Working on the OJ Workspace

For Oscar and Jacob. You do not need to be a programmer; Claude does the typing.
These are the steps that keep the two of you from overwriting each other.

## One-time setup

1. Install Node.js (LTS) from https://nodejs.org and Git from https://git-scm.com.
2. Install Claude Code and sign in.
3. Accept the GitHub invitation to the `oj-workspace` repo, then in a terminal:

       git clone https://github.com/Oscarlifts556/oj-workspace.git
       cd oj-workspace
       npm install

4. Copy `.env.example` to `.env.local`. Ask the other founder for any values you
   need, over a private channel. Never commit `.env.local`.
5. `npm run dev`, then open http://127.0.0.1:3010

## Every time you work

1. Open the folder in Claude Code. It reads CLAUDE.md on its own.
2. Tell Claude what you want. It will pull the latest code, read the agent log,
   make a branch, and make the change.
3. Ask it to run the checks and show you the result in the browser.
4. Ask it to open a pull request. When the green check appears on GitHub, merge it.
5. Claude adds a note to AGENT_LOG.md so the other person knows what changed.

## What not to do

- Do not paste keys or passwords into the chat, the code, a task card or a document.
- Do not let Claude change the live database without telling the other founder first.
- Do not turn on a second copy of the texting system. Texts are sent by the
  existing Exterior Care server only.

## If something breaks

Tell Claude exactly what you saw. If the live site is down, the last working
version is always the previous merge on GitHub; Claude can roll back to it.
