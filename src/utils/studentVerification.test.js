import test from "node:test";
import assert from "node:assert/strict";
import { verifyStudentInSheet } from "./studentVerification.js";

const config = {
  url: "https://example.test/exec",
  sheetName: "명단",
  columns: { studentId: "학번", studentName: "이름" },
};
const request = { config, apiKey: "test-key", studentId: " 20260001 ", studentName: " 테스트 " };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("실제 GAS 응답: 학번 열 오류를 명단 미등록으로 표시하지 않는다", async () => {
  const result = await verifyStudentInSheet({
    ...request,
    fetchImpl: async () => response({ found: false, error: "학번 열을 찾을 수 없습니다" }),
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /명단 조회 오류.*학번 열을 찾을 수 없습니다/);
  assert.doesNotMatch(result.error, /명단에 없습니다/);
});

test("서버가 정상 조회 후 명시적으로 미등록을 반환한 경우만 미등록으로 안내한다", async () => {
  const result = await verifyStudentInSheet({ ...request, fetchImpl: async () => response({ found: false }) });
  assert.equal(result.ok, false);
  assert.match(result.error, /명단에 없습니다/);
});

test("정상 학생 조회 결과와 입력값을 유지한다", async () => {
  const student = { dept: "건축학부", password: "0123" };
  const result = await verifyStudentInSheet({
    ...request,
    fetchImpl: async (url, options) => {
      assert.equal(url, config.url);
      assert.equal(options.method, "POST");
      assert.deepEqual(JSON.parse(options.body), {
        action: "verify_student", key: "test-key", studentId: "20260001",
        studentName: "테스트", sheetName: "명단", columns: config.columns,
      });
      return response({ found: true, student, safetyTrained: true });
    },
  });
  assert.deepEqual(result, { ok: true, student, safetyTrained: true });
});

test("HTTP 오류, 명시적 처리 실패, 누락/잘못된 found 값으로 로그인을 허용하지 않는다", async () => {
  for (const [data, status] of [
    [{ found: false }, 503], [{ ok: false, found: true }, 200],
    [{}, 200], [null, 200], [{ found: "true" }, 200], [{ found: "false" }, 200],
  ]) {
    const result = await verifyStudentInSheet({ ...request, fetchImpl: async () => response(data, status) });
    assert.equal(result.ok, false);
    assert.match(result.error, /명단 조회 오류/);
    assert.doesNotMatch(result.error, /명단에 없습니다/);
  }
});

test("HTML 오류 페이지를 그대로 노출하거나 명단 미등록으로 취급하지 않는다", async () => {
  const result = await verifyStudentInSheet({ ...request, fetchImpl: async () => new Response("<html>error</html>") });
  assert.equal(result.ok, false);
  assert.match(result.error, /서버 응답/);
  assert.doesNotMatch(result.error, /<html>|명단에 없습니다/);
});

test("POST 연결 실패 시 GET 재시도에도 열 설정을 전달한다", async () => {
  let calls = 0;
  const result = await verifyStudentInSheet({
    ...request,
    fetchImpl: async (url, options) => {
      if (++calls === 1) throw new TypeError("Failed to fetch");
      assert.equal(options.method, "GET");
      const params = new URL(url).searchParams;
      assert.equal(params.get("studentId"), "20260001");
      assert.equal(params.get("studentName"), "테스트");
      assert.equal(params.get("sheetName"), config.sheetName);
      assert.deepEqual(JSON.parse(params.get("columns")), config.columns);
      return response({ found: true, student: {} });
    },
  });
  assert.equal(calls, 2);
  assert.equal(result.ok, true);
});

test("GET 응답의 열 오류도 실제 원인을 표시한다", async () => {
  const result = await verifyStudentInSheet({
    ...request,
    fetchImpl: async (url, options) => {
      if (options.method === "POST") throw new TypeError("Failed to fetch");
      return response({ found: false, error: "학번 열을 찾을 수 없습니다" });
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /학번 열을 찾을 수 없습니다/);
});

test("서버 연결 실패는 연결 오류로 안내하고 로그인을 허용하지 않는다", async () => {
  const result = await verifyStudentInSheet({ ...request, fetchImpl: async () => { throw new TypeError("offline"); } });
  assert.equal(result.ok, false);
  assert.match(result.error, /서버에 연결할 수 없습니다/);
});

test("설정된 URL이 없으면 조회를 실행하지 않는다", async () => {
  const result = await verifyStudentInSheet({ ...request, config: {}, fetchImpl: () => assert.fail("unexpected fetch") });
  assert.equal(result.ok, false);
  assert.match(result.error, /URL이 설정되지 않았습니다/);
});
