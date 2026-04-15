/** Standardized error for unknown provider types. */
export class UnknownProviderError extends Error {
  constructor(
    public readonly requestedProvider: string,
    public readonly registeredProviders: string[],
  ) {
    super(`Unknown provider: '${requestedProvider}'. Available: ${registeredProviders.join(", ")}`);
    this.name = "UnknownProviderError";
  }
}
