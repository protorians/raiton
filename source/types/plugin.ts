import {PluginScope} from "../core/plugins/scope.ts";

export type PluginCallable = (scope: PluginScope) => Promise<void> | void

export interface PluginInterface {
  name?: string
  setup: PluginCallable
}
