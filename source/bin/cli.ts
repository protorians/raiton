import {Command} from "commander";
import pkg from '../../package.json' with {type: "json"};


const CLI = new Command();

CLI
    .name('raiton')
    .description('Protorians Raiton framework for backend microservice')
    .version(pkg.version);

export default CLI;