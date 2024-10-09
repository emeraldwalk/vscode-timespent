export abstract class ServiceBase {
  private readonly _disposables: { dispose(): any }[] = [];

  /**
   * Register a disposable object that will be included with this objects
   * disposal.
   */
  protected registerDisposable(disposable: { dispose(): any }) {
    this._disposables.push(disposable);
  }

  async dispose(): Promise<void> {
    const promises = this._disposables.map(async d => await d.dispose());
    await Promise.all(promises);
  }

  [Symbol.asyncDispose] = async (): Promise<void> => {
    await this.dispose();
  };
}
