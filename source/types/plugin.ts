import {PluginScope} from "@/core/plugins/scope";

export type PluginFn = (
  scope: PluginScope
) => Promise<void> | void

export interface Plugin {
  name?: string
  setup: PluginFn
}
