type EventListener<Payload> = (payload: Payload) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<EventListener<Events[keyof Events]>>>();

  on<Key extends keyof Events>(event: Key, listener: EventListener<Events[Key]>): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as EventListener<Events[keyof Events]>);
    this.listeners.set(event, listeners);

    return () => this.off(event, listener);
  }

  emit<Key extends keyof Events>(event: Key, payload: Events[Key]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners.clear();
  }

  private off<Key extends keyof Events>(event: Key, listener: EventListener<Events[Key]>): void {
    const listeners = this.listeners.get(event);
    listeners?.delete(listener as EventListener<Events[keyof Events]>);

    if (listeners?.size === 0) {
      this.listeners.delete(event);
    }
  }
}
