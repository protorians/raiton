import {DelegateRepository} from "./repositories.ts";

export class DelegateService {
    protected repository!: DelegateRepository;

    getRepository() {
        return this.repository as typeof this.repository;
    }
}