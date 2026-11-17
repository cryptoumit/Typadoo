class TestLockManager {
  private readonly queues = new Map<string, Promise<void>>();

  request<T>(name: string, callback: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(name) ?? Promise.resolve();
    const result = previous.then(callback);
    this.queues.set(
      name,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }
}

Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: new TestLockManager(),
});
