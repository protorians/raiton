import { PluginInterface, PluginCallable } from '../../types/index.ts'

export function definePlugin(
  setup: PluginCallable,
  name?: string
): PluginInterface {
  return { setup, name }
}
