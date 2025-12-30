import {Parametrable} from "@/sdk/enums";
import {FastifyReply, FastifyRequest} from "fastify";
import {RouteParametersMetadataInterface} from "@/types/parameters";
import {MultipartFile} from "@fastify/multipart";

export async function parseParametersArguments(
    req: FastifyRequest,
    res: FastifyReply,
    metadata: RouteParametersMetadataInterface[]
): Promise<any[]> {
    const args: any[] = [];
    const files: AsyncIterableIterator<MultipartFile> | any[] = ('files' in req && typeof req.files === 'function') ? req.files() : [];

    for (const param of metadata) {
        switch (param.type) {
            // case Parametrable.APP:
            //     args[param.index] = req.server as any;
            //     break;
            case Parametrable.PARAM:
                args[param.index] = param.key ? (req.params as any)[param.key] : req.params;
                break;
            case Parametrable.BODY:
                args[param.index] = param.key ? (req.body as any)[param.key] : req.body;
                break;
            case Parametrable.QUERY:
                args[param.index] = param.key ? (req.query as any)[param.key] : req.query;
                break;
            case Parametrable.HEADER:
                args[param.index] = req.headers[param.key.toLowerCase()] as any;
                break;
            case Parametrable.REQ:
                args[param.index] = req as any;
                break;
            case Parametrable.REPLY:
                args[param.index] = res as any;
                break;
            case Parametrable.UPLOAD_FILE:
                let accumulate: any = param.multiple ? [] : null;
                for await (const part of files) {
                    if (param.key === part.fieldname) {
                        const packed = {
                            filename: part.filename,
                            mimetype: part.mimetype,
                            encoding: part.encoding,
                            toFile: () => part.file,
                            toBuffer: async () => await part.toBuffer(),
                        }
                        accumulate = param.multiple ? [...accumulate, packed] : packed;
                    }
                }
                args[param.index] = accumulate as any;
                break;

            case Parametrable.CUSTOM:
                args[param.index] = param.callable?.({request: req, reply: res, files}) ?? null;
                break;
        }
    }

    return args;
}