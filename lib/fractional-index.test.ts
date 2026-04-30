import { describe, it, expect } from "vitest";
import { getOrderBetween, getInitialOrders } from "./fractional-index";

describe("getInitialOrders", () => {
  it("returns the requested number of keys", () => {
    expect(getInitialOrders(1)).toHaveLength(1);
    expect(getInitialOrders(3)).toHaveLength(3);
    expect(getInitialOrders(10)).toHaveLength(10);
  });

  it("returns keys in strictly ascending lexicographic order", () => {
    const keys = getInitialOrders(20);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i] > keys[i - 1]).toBe(true);
    }
  });

  it("returns no duplicates", () => {
    const keys = getInitialOrders(50);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("getOrderBetween", () => {
  it("creates a key between null and null (first item)", () => {
    const k = getOrderBetween(null, null);
    expect(typeof k).toBe("string");
    expect(k.length).toBeGreaterThan(0);
  });

  it("creates a key strictly after a left bound", () => {
    const left = getOrderBetween(null, null);
    const k = getOrderBetween(left, null);
    expect(k > left).toBe(true);
  });

  it("creates a key strictly before a right bound", () => {
    const right = getOrderBetween(null, null);
    const k = getOrderBetween(null, right);
    expect(k < right).toBe(true);
  });

  it("creates a key strictly between two valid bounds", () => {
    const [a, b] = getInitialOrders(2);
    const mid = getOrderBetween(a, b);
    expect(mid > a).toBe(true);
    expect(mid < b).toBe(true);
  });

  it("recovers from inverted bounds (before >= after) by appending after before", () => {
    const [a, b] = getInitialOrders(2);
    // Pass them backwards.
    const k = getOrderBetween(b, a);
    // Should not throw and should land after `b` (the higher of the two).
    expect(k > b).toBe(true);
  });

  it("recovers when before equals after", () => {
    const [a] = getInitialOrders(1);
    const k = getOrderBetween(a, a);
    expect(k > a).toBe(true);
  });

  it("supports deep insertion between the same two bounds repeatedly", () => {
    const [a, b] = getInitialOrders(2);
    let lo = a;
    const hi = b;
    const keys: string[] = [];
    for (let i = 0; i < 50; i++) {
      const mid = getOrderBetween(lo, hi);
      expect(mid > lo).toBe(true);
      expect(mid < hi).toBe(true);
      keys.push(mid);
      lo = mid;
    }
    // No duplicates and strictly ascending.
    expect(new Set(keys).size).toBe(keys.length);
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });
});
