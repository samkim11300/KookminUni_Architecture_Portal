// ─── Utility Functions ───────────────────────────────────────────
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const ts = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

export const dateStr = () => new Date().toISOString().split("T")[0];

export const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; };

export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0]; };

export const formatDate = (d) => { if (!d) return ""; const [y, m, dd] = d.split("-"); return `${m}/${dd}`; };

export const ACTIVE_PORTAL_SESSION_KEY = "kmu_active_portal_session";

/**
 * SHA-256 해시 함수 (Web Crypto API)
 * @param {string} message - 해시할 문자열
 * @returns {Promise<string>} hex 문자열
 */
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 이메일 본문 양식 (B — 깔끔 간결체)
 * @param {string} name - 수신자 이름
 * @param {string} body - 본문 내용 (여러 줄 문자열)
 */
export const emailTemplate = (name, body) =>
  `${name}님, 안녕하세요.\n\n${body}\n\n감사합니다.\n\n──\n국민대학교 건축대학 교학팀\n복지관 602호실 | 02-910-6525\n※ 본 메일은 자동 발송되었습니다.`;
