import { handle, json, parseQuery } from "@/lib/server/http";
import { layerScenes } from "@/lib/server/eo/layers";
import { BBoxParam, LayerWindowQuery } from "@/lib/server/eo/query";

const Query = LayerWindowQuery.extend({ bbox: BBoxParam });

/** GET /api/eo/scenes?layer=&days=&end=&bbox= — acquisitions behind the layer in the current view. */
export const GET = handle(async (request: Request) => {
  const { layer, days, end, bbox } = parseQuery(request, Query);
  return json({ scenes: await layerScenes(layer, end, days, bbox) }, { sMaxAge: 900 });
});
