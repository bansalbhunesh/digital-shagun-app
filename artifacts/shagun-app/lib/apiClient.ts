// @ts-expect-error - Subpath not exposed in package.json exports but works in metro
import { customFetch, setApiConfig } from "@workspace/api-client-react/src/custom-fetch";

export { customFetch, setApiConfig };
