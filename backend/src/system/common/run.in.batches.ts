const DEFAULT_BATCH_SIZE = 50;

export const runInBatches = async (
  promises: Array<() => Promise<any>>,
  batchSize = DEFAULT_BATCH_SIZE,
) => {
  for (
    let firstElementIndex = 0;
    firstElementIndex < promises.length;
    firstElementIndex += batchSize
  ) {
    await Promise.all(
      promises
        .slice(firstElementIndex, firstElementIndex + batchSize)
        .map((promise) => promise()),
    );
  }
};
