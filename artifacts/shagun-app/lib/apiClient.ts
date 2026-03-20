/**
 * This module re-exports the core API client and configuration utilities.
 * It serves as the primary entry point for manual API calls within the app,
 * while React Query hooks should be preferred for UI-driven data fetching.
 */
// @ts-expect-error - Subpath not exposed in package.json exports but works in metro
import { customFetch, setApiConfig } from "@workspace/api-client-react/src/custom-fetch";

export { customFetch, setApiConfig };
