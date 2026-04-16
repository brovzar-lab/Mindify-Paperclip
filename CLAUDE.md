# Mindify — Claude Code Instructions

## Terminal Commands: ALWAYS Specify Context

When giving the user a terminal command to run, ALWAYS include ALL THREE of:

1. **Which terminal**: "local macOS Terminal" vs "SSH/remote terminal" — the user has multiple terminals open across different machines
2. **Exact directory**: Use the real local Mac path `/Users/quantumcode/CODE/mindify-paperclip` (NOT `/home/user/Mindify-Paperclip` or any cloud/container path). Always show the full `cd` command.
3. **Prerequisites**: Any env vars, CLI logins, or setup needed (e.g., "requires Firebase CLI login", "needs ANTHROPIC_API_KEY exported")

Example format:
```
In your **local macOS Terminal**, run:
  cd /Users/quantumcode/CODE/mindify-paperclip/functions
  npm run seed:demo <uid>
Requires: Firebase CLI logged in (billyrovzar@gmail.com)
```

Never assume the user knows which folder or terminal to use.
