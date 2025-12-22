import {Command} from "commander";
import {version} from '../../package.json';


const CLI = new Command();

CLI
    .name('raiton')
    .description('Protorians Raiton development kit for backend microservice')
    .version(version);

export default CLI;