export type JsonPrimitive = string | number | boolean | null;

export type VariableStoreReader = {
  get(namespace: string, key: string): JsonPrimitive | undefined;
  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>>;
};

export class VariableStore implements VariableStoreReader {
  private store = new Map<string, Map<string, JsonPrimitive>>();
  private listeners = new Map<string, Set<() => void>>();

  set(namespace: string, key: string, value: JsonPrimitive): void {
    let ns = this.store.get(namespace);
    if (!ns) { ns = new Map(); this.store.set(namespace, ns); }
    if (ns.get(key) === value) return;
    ns.set(key, value);
    this.notify(`${namespace}.${key}`);
    this.notify(namespace);
  }

  get(namespace: string, key: string): JsonPrimitive | undefined {
    return this.store.get(namespace)?.get(key);
  }

  getNamespace(namespace: string): Readonly<Record<string, JsonPrimitive>> {
    const ns = this.store.get(namespace);
    return ns ? Object.fromEntries(ns.entries()) : {};
  }

  subscribe(key: string, listener: () => void): () => void {
    let set = this.listeners.get(key);
    if (!set) { set = new Set(); this.listeners.set(key, set); }
    set.add(listener);
    return () => { set?.delete(listener); };
  }

  private notify(key: string): void { this.listeners.get(key)?.forEach((l) => l()); }
}
