import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "./hybrid";

describe("reciprocalRankFusion", () => {
  it("matches the hand-computed RRF score (k=60) for two overlapping rankings", () => {
    // List A (BM25):        [1, 2, 3]
    // List B (vector space): [1, 4]      (2 and 3 didn't score there; 4 is new)
    // id1: rank 1 in both -> 1/61 + 1/61 = 2/61 ~= 0.032787
    // id2: rank 2 in A only -> 1/62        ~= 0.016129
    // id4: rank 2 in B only -> 1/62        ~= 0.016129 (ties id2 - a real tie, not a bug)
    // id3: rank 3 in A only -> 1/63        ~= 0.015873
    const fused = reciprocalRankFusion([[{ id: 1 }, { id: 2 }, { id: 3 }], [{ id: 1 }, { id: 4 }]]);

    expect(fused[0]).toMatchObject({ id: 1 });
    expect(fused[0]!.rrfScore).toBeCloseTo(2 / 61, 8);
    expect(fused[3]).toMatchObject({ id: 3 });
    expect(fused[3]!.rrfScore).toBeCloseTo(1 / 63, 8);
    // The tied pair (id2, id4) both land at 1/62, in list-encounter order.
    expect(fused[1]).toMatchObject({ id: 2 });
    expect(fused[2]).toMatchObject({ id: 4 });
    expect(fused[1]!.rrfScore).toBeCloseTo(1 / 62, 8);
    expect(fused[2]!.rrfScore).toBeCloseTo(1 / 62, 8);
  });

  it("ranks a document appearing near the top of both lists above one appearing only in one list", () => {
    const fused = reciprocalRankFusion([[{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 1 }]]);
    // Both id1 and id2 appear in both lists at ranks {1,2} and {2,1} - symmetric, so they tie exactly.
    expect(fused[0]!.rrfScore).toBeCloseTo(fused[1]!.rrfScore, 10);
  });

  it("returns an empty array when every input ranking is empty", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("handles a single input ranking (degenerates to that ranking's own order)", () => {
    const fused = reciprocalRankFusion([[{ id: 5 }, { id: 3 }, { id: 9 }]]);
    expect(fused.map((r) => r.id)).toEqual([5, 3, 9]);
  });

  it("handles no input rankings at all", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });
});
