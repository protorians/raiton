import {DynamicParameter} from "@protorians/parameters";
import {IDataTransferObject} from "@/types";


export class DataTransferObject<T extends IDataTransferObject<T>> extends DynamicParameter<T> {

}