import type {
  RuntimeRequest,
  RuntimeReply
} from '@/types'

export class RequestContext {
  public state: Record<string, any> = {}
  private decorations = new Map<string, any>()

  constructor(
    public req: RuntimeRequest,
    public reply: RuntimeReply
  ) {}

  decorate<T = any>(key: string, value: T) {
    if (this.decorations.has(key)) {
      throw new Error(`Decoration "${key}" already exists`)
    }
    this.decorations.set(key, value)
  }

  get<T = any>(key: string): T {
    if (key in this.state) return this.state[key]
    if (this.decorations.has(key)) {
      return this.decorations.get(key)
    }
    throw new Error(`Context value "${key}" not found`)
  }

  send(body: any) {
    this.reply.send(body)
  }
}
