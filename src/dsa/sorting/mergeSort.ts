/**
 * Merge Sort Algorithm
 *
 * Time Complexity:
 * Best Case:    O(n log n)
 * Average Case: O(n log n)
 * Worst Case:   O(n log n)
 *
 * Space Complexity: O(n)
 */

export function mergeSort<T>(
  items: T[],
  compare: (a: T, b: T) => number
): T[] {

  // Base condition
  if (items.length <= 1) {
    return [...items];
  }

  // Divide array into two halves
  const middle = Math.floor(items.length / 2);

  const left = mergeSort(
    items.slice(0, middle),
    compare
  );

  const right = mergeSort(
    items.slice(middle),
    compare
  );

  // Merge sorted halves
  const result: T[] = [];

  let leftIndex = 0;
  let rightIndex = 0;

  while (
    leftIndex < left.length &&
    rightIndex < right.length
  ) {

    if (
      compare(
        left[leftIndex],
        right[rightIndex]
      ) <= 0
    ) {
      result.push(left[leftIndex]);
      leftIndex++;
    } else {
      result.push(right[rightIndex]);
      rightIndex++;
    }
  }

  // Add remaining elements
  return result.concat(
    left.slice(leftIndex),
    right.slice(rightIndex)
  );
}