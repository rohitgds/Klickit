# MCP and Connector Plan

## Policy

- Official or well-established providers only.
- Explain purpose, publisher, permissions, write/delete capability and scope.
- Ask before installation.
- Keep manual tool-call approval enabled.
- Start read-only and project-scoped where supported.
- Do not connect production data.

## Planned order

1. Playwright for local UI testing, when Node is installed.
2. GitHub official MCP or GitHub CLI, after private repository creation.
3. Local Supabase MCP/CLI during local database setup.
4. Supabase hosted MCP only for staging, scoped to one project and read-only first.
5. Vercel CLI/MCP when preview deployment is ready.
6. Pabbly through approved API/webhook/provider setup during the communications milestone.

## MCP review record

| Connector | Source/publisher | Version/date reviewed | Requested permissions | Read/write | Approved by user | Installed | Notes |
|---|---|---|---|---|---|---|---|
