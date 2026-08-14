import { describe, expect, it } from "vitest";
import { extractEvents, extractKpis, extractParticipants, unwrapList } from "./extract";

describe("unwrapList", () => {
  it("accepts the common envelope shapes", () => {
    expect(unwrapList([1])).toEqual([1]);
    expect(unwrapList({ data: [1] })).toEqual([1]);
    expect(unwrapList({ items: [1] })).toEqual([1]);
    expect(unwrapList({ data: { items: [1] } })).toEqual([1]);
  });

  it("returns empty for anything else, never throws", () => {
    expect(unwrapList(null)).toEqual([]);
    expect(unwrapList("nope")).toEqual([]);
    expect(unwrapList({ data: "nope" })).toEqual([]);
  });
});

describe("extractEvents", () => {
  it("reads id, name and the sales fields under their common names", () => {
    const rows = extractEvents({
      data: [
        { id: 7, name: "Show A", ticketsSold: 120, gmv: 500 },
        { eventId: "abc", title: "Show B", sold: "45" },
      ],
    });
    expect(rows).toEqual([
      { id: "7", name: "Show A", ticketsSold: 120, revenue: 500 },
      { id: "abc", name: "Show B", ticketsSold: 45, revenue: null },
    ]);
  });

  it("drops unreadable rows instead of inventing them", () => {
    expect(extractEvents({ data: [{ noId: true }, null, "x"] })).toEqual([]);
  });
});

describe("extractKpis", () => {
  it("reads a flat object", () => {
    expect(extractKpis({ ticketsSold: 88, revenue: 1000 })).toEqual({
      ticketsSold: 88,
      revenue: 1000,
    });
  });

  it("reads under data, and admission as the sold count", () => {
    expect(extractKpis({ data: { admission: 12 } })).toEqual({
      ticketsSold: 12,
      revenue: null,
    });
  });

  it("reads a metric list", () => {
    expect(
      extractKpis([
        { name: "ticketsSold", value: 5 },
        { name: "gmv", value: 90 },
      ]),
    ).toEqual({ ticketsSold: 5, revenue: 90 });
  });

  it("refuses an unrecognised shape rather than writing zero", () => {
    // zero sold is a real business fact; an unreadable payload is not
    expect(extractKpis({ foo: "bar" })).toBeNull();
    expect(extractKpis(null)).toBeNull();
    expect(extractKpis({ data: { somethingElse: 1 } })).toBeNull();
  });
});

describe("extractParticipants", () => {
  it("reads flat rows and nested person objects", () => {
    const rows = extractParticipants({
      data: [
        { orderNumber: "A1", name: "Budi", email: "budi@x.test", ticketType: "VIP", purchaseDate: "2026-08-01", totalSpent: 500 },
        { id: 9, participant: { fullName: "Sari", email: "sari@x.test" }, category: "Regular" },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ orderNo: "A1", name: "Budi", category: "VIP", amount: 500 });
    expect(rows[1]).toMatchObject({ orderNo: "9", name: "Sari", email: "sari@x.test", category: "Regular" });
  });

  it("reads Tessera's real snake_case shape, seen live 2026-08-12", () => {
    const rows = extractParticipants({
      data: [
        {
          id: "019ff67d",
          order_id: "TS-2608127JW4CN7",
          ticket_buyer_email: "buyer@example.test",
          ticket_buyer_name: null,
          ticket_category: "Moodymaan Jakarta",
          purchased_at: "2026-08-12T15:00:24.092Z",
          ticket_price: "375000.00",
          revenue: "375000.00",
          status: "confirmed",
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      orderNo: "TS-2608127JW4CN7",
      email: "buyer@example.test",
      category: "Moodymaan Jakarta",
      amount: 375000,
    });
  });

  it("drops rows naming nobody rather than inventing a buyer", () => {
    expect(extractParticipants({ data: [{ totalSpent: 100 }] })).toEqual([]);
    expect(extractParticipants("junk")).toEqual([]);
  });
});
