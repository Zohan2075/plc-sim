export class TagMemory {
  private readonly inputs = new Map<string, boolean>();
  private readonly current = new Map<string, boolean>();

  setInput(tag: string, value: boolean): void {
    this.inputs.set(tag, value);
    this.current.set(tag, value);
  }

  getCommitted(tag: string): boolean {
    return this.current.get(tag) ?? false;
  }

  snapshotInputs(): ReadonlyMap<string, boolean> {
    return new Map(this.inputs);
  }

  readDuringScan(tag: string, inputImage: ReadonlyMap<string, boolean>): boolean {
    if (inputImage.has(tag)) {
      return inputImage.get(tag) ?? false;
    }

    return this.getCommitted(tag);
  }

  commitWrites(writes: ReadonlyMap<string, boolean>): void {
    for (const [tag, value] of writes) {
      this.current.set(tag, value);
    }
  }
}
