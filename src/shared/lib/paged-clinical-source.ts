export interface ClinicalPage<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ClinicalPageState<T> {
  items: T[];
  total: number | null;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

/** One independently authorized source. Never exposes an old patient's response. */
export class PagedClinicalSource<T extends { id: string }> {
  private state: ClinicalPageState<T>;
  private generation = 0;
  private readonly listeners = new Set<() => void>();
  private readonly initial: ClinicalPageState<T>;

  constructor(
    private readonly enabled: boolean,
    private readonly fetchPage: (page: number) => Promise<ClinicalPage<T>>,
    private readonly resource: string,
  ) {
    this.initial = { items: [], total: null, page: 0, hasMore: false, loading: enabled, error: null };
    this.state = this.initial;
  }

  getSnapshot = () => this.state;
  getServerSnapshot = () => this.initial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(state: ClinicalPageState<T>) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }

  cancel = () => { this.generation += 1; };

  reload = async () => {
    const generation = ++this.generation;
    this.publish({ ...this.initial });
    if (this.enabled) await this.load(1, generation);
  };

  loadMore = async () => {
    if (!this.enabled || this.state.loading || !this.state.hasMore) return;
    await this.load(this.state.page + 1, this.generation);
  };

  private async load(page: number, generation: number) {
    this.publish({ ...this.state, loading: true, error: null });
    try {
      const result = await this.fetchPage(page);
      if (generation !== this.generation) return;
      if (result.page !== page || !Number.isInteger(result.total) || result.total < 0 || result.limit < 1) {
        throw new Error('Invalid pagination response');
      }
      const items = new Map(this.state.items.map((item) => [item.id, item]));
      for (const item of result.data) items.set(item.id, item);
      this.publish({
        items: [...items.values()], total: result.total, page,
        hasMore: result.data.length > 0 && page * result.limit < result.total,
        loading: false, error: null,
      });
    } catch (cause) {
      if (generation !== this.generation) return;
      const denied = typeof cause === 'object' && cause !== null && 'status' in cause &&
        (cause.status === 401 || cause.status === 403);
      this.publish({
        ...(denied ? { ...this.initial, loading: false } : this.state),
        loading: false,
        error: denied ? `Tu sesión ya no permite consultar ${this.resource}.` :
          `No se pudieron cargar ${this.resource}. Puedes reintentar sin perder lo ya cargado.`,
      });
    }
  }
}
