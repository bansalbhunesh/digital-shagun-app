# API Specification (OpenAPI)

This directory contains the source-of-truth OpenAPI specifications for the ShagunX API.

## Files
- `api.yaml`: The main OpenAPI 3.0 specification file.

## Usage
These specs are used to auto-generate:
1.  **Zod Schemas**: Located in `lib/api-zod`.
2.  **React Query Hooks**: Located in `lib/api-client-react`.

To update the generated code after changing the spec:
```bash
pnpm --filter @workspace/api-client-react run generate
```
