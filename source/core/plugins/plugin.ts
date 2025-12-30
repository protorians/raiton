import { Plugin, PluginFn } from '@/types'

export function definePlugin(
  setup: PluginFn,
  name?: string
): Plugin {
  return { setup, name }
}
