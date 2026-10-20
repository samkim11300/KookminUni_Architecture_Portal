import test from "node:test";
import assert from "node:assert/strict";
import { createOverdueChecker, isOverdueRental } from "./overdueRentals.js";

const morning = new Date("2026-10-20T09:00:00+09:00");
const nextMorning = new Date("2026-10-21T09:00:00+09:00");
const rental = { id: "rental-1", status: "ready", returnDate: "2026-10-19" };

function setup(overrides = {}) {
  const state = { rentals: [rental], flags: {}, sent: [], errors: [], reads: 0 };
  const checker = createOverdueChecker({
    readRentals: async () => { state.reads += 1; return state.rentals; },
    readFlags: async () => state.flags,
    writeFlags: async flags => { state.flags = flags; return true; },
    notify: async item => { state.sent.push(item); return { ok: true }; },
    onError: error => state.errors.push(error),
    ...overrides,
  });
  return { state, checker };
}

test("반납/취소/반려/알 수 없는 상태와 종료 기록이 있는 대여는 제외한다", () => {
  for (const status of ["returned", "cancelled", "rejected", "unknown", undefined]) {
    assert.equal(isOverdueRental({ ...rental, status }, "2026-10-20"), false);
  }
  for (const field of ["returnedAt", "cancelledAt", "rejectedAt"]) {
    assert.equal(isOverdueRental({ ...rental, [field]: "2026-10-19 12:00:00" }, "2026-10-20"), false);
  }
  assert.equal(isOverdueRental(rental, "2026-10-20"), true);
  assert.equal(isOverdueRental({ ...rental, status: "pending_pickup" }, "2026-10-20"), true);
});

test("반납 당일/미래 날짜/누락 및 잘못된 날짜는 연체가 아니다", () => {
  for (const returnDate of ["2026-10-20", "2026-10-21", null, undefined, "", "invalid", 123]) {
    assert.equal(isOverdueRental({ ...rental, returnDate }, "2026-10-20"), false);
  }
  assert.equal(isOverdueRental(null, "2026-10-20"), false);
});

test("열린 탭에서도 서버에서 반납되면 이후 매일 알림을 중단한다", async () => {
  const { state, checker } = setup();
  await checker.run(morning);
  assert.equal(state.sent.length, 1);
  state.rentals = [{ ...rental, status: "returned", returnedAt: "2026-10-20 10:00:00" }];
  await checker.run(nextMorning);
  await checker.run(new Date("2026-10-22T09:00:00+09:00"));
  assert.equal(state.sent.length, 1);
});

test("첫 조회 후 다른 기기에서 반납한 대여도 발송 직전 제외한다", async () => {
  let reads = 0;
  const { state, checker } = setup({
    readRentals: async () => ++reads === 1 ? [rental] : [{ ...rental, status: "returned" }],
  });
  await checker.run(morning);
  assert.equal(state.sent.length, 0);
  assert.deepEqual(state.flags, {});
});

test("발송 직전에 삭제된 대여는 발송하지 않는다", async () => {
  let reads = 0;
  const { state, checker } = setup({ readRentals: async () => ++reads === 1 ? [rental] : [] });
  await checker.run(morning);
  assert.equal(state.sent.length, 0);
});

test("최신 서버 데이터의 문자열/배열 저장 형식을 모두 지원한다", async () => {
  const { state, checker } = setup({
    readRentals: async () => JSON.stringify([rental]),
    readFlags: async () => "{}",
  });
  await checker.run(morning);
  assert.equal(state.sent.length, 1);
});

test("서버에 오늘 발송 기록이 있으면 재발송하지 않는다", async () => {
  const { state, checker } = setup();
  state.flags = { [rental.id]: "2026-10-20" };
  await checker.run(morning);
  assert.equal(state.sent.length, 0);
});

test("정상 연체는 당일 한 번 발송하고 다음 날에도 미반납이면 다시 안내한다", async () => {
  const { state, checker } = setup();
  state.flags = { another: "2026-10-19" };
  await checker.run(morning);
  await checker.run(morning);
  assert.equal(state.sent.length, 1);
  await checker.run(nextMorning);
  assert.equal(state.sent.length, 2);
  assert.deepEqual(state.flags, { another: "2026-10-19", [rental.id]: "2026-10-21" });
});

test("서버 대여/발송 이력 조회 실패 시 이메일을 보내지 않는다", async () => {
  for (const key of ["readRentals", "readFlags"]) {
    const { state, checker } = setup({ [key]: async () => { throw new Error("offline"); } });
    await checker.run(morning);
    assert.equal(state.sent.length, 0);
    assert.equal(state.errors.length, 1);
  }
});

test("발송 직전 재조회 실패 시에도 발송하지 않는다", async () => {
  let reads = 0;
  const { state, checker } = setup({
    readRentals: async () => {
      if (++reads === 1) return [rental];
      throw new Error("offline");
    },
  });
  await checker.run(morning);
  assert.equal(state.sent.length, 0);
});

test("누락되거나 잘못된 서버 대여 데이터를 로컬 데이터로 대체하지 않는다", async () => {
  for (const value of [null, {}, "broken json", "null", []]) {
    const { state, checker } = setup({ readRentals: async () => value });
    await checker.run(morning);
    assert.equal(state.sent.length, 0);
  }
});

test("발송 실패나 비활성화는 발송 완료로 기록하지 않는다", async () => {
  for (const result of [{ ok: false }, { skipped: true }]) {
    const { state, checker } = setup({ notify: async () => result });
    await checker.run(morning);
    assert.deepEqual(state.flags, {});
  }
});

test("발송 이력 저장 실패 시 같은 탭에서 매분 재발송하지 않는다", async () => {
  const { state, checker } = setup({ writeFlags: async () => false });
  await checker.run(morning);
  await checker.run(morning);
  assert.equal(state.sent.length, 1);
  assert.equal(state.errors.length, 1);
});

test("중첩된 타이머 실행은 한 번만 발송한다", async () => {
  const { state, checker } = setup();
  await Promise.all([checker.run(morning), checker.run(morning)]);
  assert.equal(state.sent.length, 1);
});

test("언마운트/StrictMode 정리 후 진행 중인 조회에서 발송하지 않는다", async () => {
  const { state, checker } = setup();
  const pending = checker.run(morning);
  checker.dispose();
  await pending;
  await checker.run(morning);
  assert.equal(state.sent.length, 0);
});

test("한국 오전 9시대 외에는 조회하거나 발송하지 않는다", async () => {
  const { state, checker } = setup();
  await checker.run(new Date("2026-10-20T08:59:00+09:00"));
  await checker.run(new Date("2026-10-20T10:00:00+09:00"));
  assert.equal(state.reads, 0);
  assert.equal(state.sent.length, 0);
  await checker.run(new Date("2026-10-20T00:59:00Z"));
  assert.equal(state.sent.length, 1);
});
