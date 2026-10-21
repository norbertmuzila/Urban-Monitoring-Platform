import { EO_GROUPS } from "@/lib/eo/layers";
import { handle, json } from "@/lib/server/http";
import { EO_WINDOW_DAYS, listEoLayers } from "@/lib/server/eo/layers";

/** GET /api/eo/layers — catalogue of live Earth-observation layers. */
export const GET = handle(async () => json({ groups: EO_GROUPS, layers: listEoLayers(), windows: EO_WINDOW_DAYS }, { sMaxAge: 3600 }));
