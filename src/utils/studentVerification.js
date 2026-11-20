const LOOKUP_ERROR = "안전교육 명단 조회 오류";

async function parseVerificationResponse(response) {
  let data;
  try {
    data = JSON.parse(await response.text());
  } catch {
    return { ok: false, error: `${LOOKUP_ERROR}: 서버 응답을 확인할 수 없습니다. 교학팀에 문의해주세요.` };
  }

  // GAS는 시트/열 설정 오류도 HTTP 200, found: false로 반환한다.
  // 이 경우를 실제 명단 미등록과 구분해야 학생에게 재제출을 잘못 안내하지 않는다.
  if (typeof data?.error === "string" && data.error.trim()) {
    return { ok: false, error: `${LOOKUP_ERROR}: ${data.error.trim()}. 교학팀에 문의해주세요.` };
  }
  if (!response.ok || data?.ok === false) {
    return { ok: false, error: `${LOOKUP_ERROR}: 서버에서 조회를 처리하지 못했습니다. 잠시 후 다시 시도해주세요.` };
  }
  if (data?.found === false) {
    return { ok: false, error: "안전교육 이수자 명단에 없습니다. 학번과 이름을 확인해주세요." };
  }
  if (data?.found !== true) {
    return { ok: false, error: `${LOOKUP_ERROR}: 조회 결과 형식이 올바르지 않습니다. 교학팀에 문의해주세요.` };
  }
  return { ok: true, student: data.student || {}, safetyTrained: data.safetyTrained ?? true };
}

export async function verifyStudentInSheet({ config, apiKey, studentId, studentName, fetchImpl = fetch }) {
  const url = config?.url?.trim();
  if (!url) return { ok: false, error: "연동 URL이 설정되지 않았습니다." };
  const payload = {
    action: "verify_student",
    key: apiKey,
    studentId: studentId?.trim(),
    studentName: studentName?.trim(),
    sheetName: config.sheetName,
    columns: config.columns,
  };
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
    });
    return await parseVerificationResponse(response);
  } catch {
    // 네트워크/CORS 실패 시에도 POST와 같은 시트 및 열 설정으로 재조회한다.
    try {
      const params = new URLSearchParams({
        action: payload.action,
        key: apiKey || "",
        studentId: payload.studentId || "",
        studentName: payload.studentName || "",
        sheetName: payload.sheetName || "",
        columns: JSON.stringify(payload.columns || {}),
      });
      const response = await fetchImpl(`${url}?${params.toString()}`, { method: "GET" });
      return await parseVerificationResponse(response);
    } catch {
      return { ok: false, error: `${LOOKUP_ERROR}: 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.` };
    }
  }
}
