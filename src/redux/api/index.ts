import { projectApi } from "./project";
import { styleGuideApi } from "./style-guide";
import { billingApi } from "./billing";

// NOTE: there is deliberately no RTK Query slice for /api/generate/* —
// those routes stream text/html and fetchBaseQuery buffers whole responses,
// which would break live streaming. The streaming clients live in
// src/hooks/use-frame.ts and src/hooks/use-chat-window.ts (raw fetch).
export const apis = [projectApi, styleGuideApi, billingApi];

export { projectApi, styleGuideApi, billingApi };
