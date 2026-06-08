import { PluginInterface, PluginCallable } from '../../types'

export function definePlugin(
  setup: PluginCallable,
  name?: string
): PluginInterface {
  return { setup, name }
}
