import {ParamTypeEnum} from "@/sdk/enums/http-parameters.enum";
import {FastifyReply, FastifyRequest} from "fastify";
import {MultipartFile} from "@fastify/multipart";


export interface RouteParametersMetadataPayload {
    request: FastifyRequest;
    reply: FastifyReply;
    files: AsyncIterableIterator<MultipartFile> | any[]
}

export type RouteParametersMetadataCallable = (payload: RouteParametersMetadataPayload) => any[];

export interface RouteParametersMetadataInterface {
    index: number;
    type: ParamTypeEnum;
    key: string;
    multiple: boolean;
    optional: boolean;
    callable?: RouteParametersMetadataCallable;
}