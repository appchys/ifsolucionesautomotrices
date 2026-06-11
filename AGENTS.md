<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Development data policy

This project is still in active development and does not need to preserve compatibility with existing data. There is no important production data yet, so schema changes can favor the clean current model over migrations or legacy fallbacks unless the user explicitly asks otherwise.

## UI simplicity

New features should keep the interface simple and avoid explanatory copy, repeated labels, or redundant controls. Prefer compact controls that show the current state directly and reveal secondary choices only when needed.
