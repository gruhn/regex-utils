
export const globalConfig = {
  /**
   * Max allowed entries in certain internal caches before `CacheOverflowError` is thrown.
   * These caches are short lived. They're only used within single memoized function.
   *
   * Some regex can lead to excessive resource use. We rather throw an error than getting OOM killed.
   * Cache size is used as a proxy for resource use, because there is no direct way to measure
   * cpu/memory from JavaScript and interrupt function calls.
   *
   * NOTE: This proxy measure might not detect all examples of excessive resource use.
   * Conversely, not all examples where cache size exceeds the limit are intractible.
   * The default limit is somewhat arbitrary. Set to `Infinity` to disable.
   */
  CACHE_OVERFLOW_ERROR_THRESHOLD: 10_000,

  /**
   * Max number of nodes in syntax tree before `VeryLargeSyntaxTreeError` is thrown
   * when converting to native JavaScript `RegExp`.
   */
  VERY_LARGE_SYNTAX_TREE_ERROR_THRESHOLD: 1_000_000,
}
