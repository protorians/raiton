import type {Context, ParamMeta} from "@/types";
import {getControllerMetadata} from "@/core";
import {Parametrable} from "@/sdk";

function createParametrable(type: ParamMeta['type'], callable?: (context: Context) => any) {
  return (key?: string) =>
    (target: any, _: any, index: number) => {
      const meta = getControllerMetadata(target)
      const route = meta.routes.at(-1)
      route?.params.push({ index, type, key, callable })
    }
}

export const Query = createParametrable(Parametrable.QUERY)
export const Param = createParametrable(Parametrable.PARAM)
export const Body  = createParametrable(Parametrable.BODY)
export const UploadedFile = createParametrable(Parametrable.UPLOAD_FILE)
export const Headers = createParametrable(Parametrable.HEADER)
export const Req = createParametrable(Parametrable.REQ)
export const Reply = createParametrable(Parametrable.REPLY)

