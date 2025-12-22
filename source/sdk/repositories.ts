import {Throwable} from "./throwable";


export class DelegateRepository {
    protected readonly client: any;
    public readonly model!: any;

    protected supported(method: string): boolean {
        if (typeof this.model !== 'object') throw new Throwable('Model not found, please check your repository')
        else if (!(method in this.model)) throw new Throwable(`Method ${method} not found, please check your repository`)
        return true;
    }

}