// ─── Editable Data (update here) ────────────────────────────────
export const EDITABLE = {
  students: [

  ],
  rooms: [
    { id: "601", name: "모형제작실", floor: "6F", building: "복지관", equipment: "목공 기계, 집진기, 톱날", rules: "반드시 보호장구 착용" },
    { id: "604", name: "캐드실", floor: "6F", building: "복지관", equipment: "3D Modeling 가능한 컴퓨터 다수 보유", rules: "사용후 정리 후 퇴실" },
    { id: "605", name: "레이저커팅실", floor: "6F", building: "복지관", equipment: "레이저 커터 1대", rules: "환기 필수, 가연성 재료 주의" },
    { id: "606", name: "사진실", floor: "6F", building: "복지관", equipment: "작업대 1개", rules: "조명 전원 OFF 후 퇴실" },
  ],
  equipment: [
    // 전동 절단·가공 장비
    { id: "001", name: "열선 커터", category: "전동 절단·가공", available: 4, total: 4, deposit: false, maxDays: 1, icon: "🔥" },
    { id: "002", name: "리드선", category: "전동 절단·가공", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🔌" },
    { id: "003", name: "드릴", category: "전동 절단·가공", available: 11, total: 11, deposit: false, maxDays: 1, icon: "🔧" },
    // 고정·보조 전동 장비
    { id: "004", name: "직소", category: "고정·보조 전동", available: 7, total: 7, deposit: false, maxDays: 1, icon: "🪚" },
    { id: "005", name: "그라인더", category: "고정·보조 전동", available: 1, total: 1, deposit: false, maxDays: 1, icon: "⚙️" },
    { id: "006", name: "타카", category: "고정·보조 전동", available: 1, total: 1, deposit: false, maxDays: 1, icon: "📌" },
    { id: "007", name: "샌딩기", category: "고정·보조 전동", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🔨" },
    // 계측·측정 장비
    { id: "008", name: "수평계", category: "계측·측정", available: 1, total: 1, deposit: false, maxDays: 1, icon: "📏" },
    { id: "009", name: "줄자", category: "계측·측정", available: 3, total: 3, deposit: false, maxDays: 1, icon: "📐" },
    { id: "010", name: "레이저 줄자", category: "계측·측정", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🔴" },
    { id: "011", name: "레이저 측정기", category: "계측·측정", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🔴" },
    // 수공구
    { id: "012", name: "십자 드라이버", category: "수공구", available: 5, total: 5, deposit: false, maxDays: 1, icon: "🪛" },
    { id: "013", name: "일자 드라이버", category: "수공구", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🪛" },
    { id: "014", name: "쇠망치", category: "수공구", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🔨" },
    { id: "015", name: "고무망치", category: "수공구", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🔨" },
    { id: "016", name: "톱", category: "수공구", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🪚" },
    { id: "017", name: "톱날", category: "수공구", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🪚" },
    { id: "018", name: "니퍼", category: "수공구", available: 7, total: 7, deposit: false, maxDays: 1, icon: "✂️" },
    { id: "019", name: "스패너", category: "수공구", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🔧" },
    // 절단·보조 소형 장비
    { id: "020", name: "펀치", category: "절단·보조 소형", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🔳" },
    { id: "021", name: "실리콘 제거기", category: "절단·보조 소형", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🧹" },
    { id: "022", name: "일반 커터", category: "절단·보조 소형", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🔪" },
    { id: "023", name: "전기가위", category: "절단·보조 소형", available: 1, total: 1, deposit: false, maxDays: 1, icon: "✂️" },
    // 작업 보조 장비
    { id: "024", name: "사다리 (소형)", category: "작업 보조", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🪜" },
    { id: "025", name: "사다리 (중형)", category: "작업 보조", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🪜" },
    { id: "026", name: "사다리 (대형)", category: "작업 보조", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🪜" },
    { id: "027", name: "구루마", category: "작업 보조", available: 2, total: 2, deposit: false, maxDays: 1, icon: "🛒" },
    // 청소 장비
    { id: "028", name: "청소기", category: "청소", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🧹" },
    // 기타 장비
    { id: "029", name: "집게형 장비", category: "기타", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🔧" },
    { id: "030", name: "전시받침대 (원형)", category: "기타", available: 5, total: 5, deposit: false, maxDays: 1, icon: "🔧", isStand: true },
    { id: "032", name: "전시받침대 (사각형)", category: "기타", available: 5, total: 5, deposit: false, maxDays: 1, icon: "🔧", isStand: true },
    { id: "031", name: "건축학과 깃발", category: "기타", available: 1, total: 1, deposit: false, maxDays: 1, icon: "🚩" },
  ],
  equipmentReturnChecklist: [
    "외관 손상 여부 확인",
    "부속/케이블/소모품 포함 여부 확인",
  ],
  timeSlots: [
    { id: "01", label: "09:00–10:00", start: 9 }, { id: "02", label: "10:00–11:00", start: 10 },
    { id: "03", label: "11:00–12:00", start: 11 },
    // 점심시간 12:00–13:00 제외
    { id: "05", label: "13:00–14:00", start: 13 }, { id: "06", label: "14:00–15:00", start: 14 },
    { id: "07", label: "15:00–16:00", start: 15 }, { id: "08", label: "16:00–17:00", start: 16 },
  ],
  workers: [
    { id: "001", name: "근로학생", shift: "통합", username: "worker1", password: import.meta.env.VITE_WORKER1_PASSWORD },
  ],
  safetySheet: {
    url: "https://script.google.com/macros/s/AKfycbw5gNesXsFsYEHaTOsG50Al_S3y-PLeEEm_3apr2DKO1fQDsHN4Cwh-7wCslKsUvKVR_A/exec",
    sheetName: "시트1",
    columns: {
      studentId: "학번",
      studentName: "이름",
      year: "학년",
      dept: "전공",
      safetyTrained: "안전교육",
      email: "이메일",
      password: "비밀번호",
    },
  },
  emailNotify: {
    url: "https://script.google.com/macros/s/AKfycbxytKXE1KSMUmuA3BBZ7lPdvrbQunIaJxiAopYh6cWi4ABr_SHOT2ISurah_v5JqLNr/exec",
    recipients: ["saku20392@kookmin.ac.kr"],
    enabled: true,
  },
  driveUpload: {
    url: "https://script.google.com/macros/s/AKfycbzdJtq82TW6d6-Qtb9-eAS_IsqpguqmDK48WB9UR8oHI3Qr4IyMAadyGTKQKmM_wUOOeA/exec", // Google Apps Script 웹앱 URL (구글 드라이브 업로드용)
    folderName: "Portal_안전교육이수증",
  },
  printArchive: {
    gasUrl: "https://script.google.com/macros/s/AKfycbwlbhqqOVL78FpI2AgnlIyXJGpbqzZaAkPXwa5hIl2aL7QJp-ckmbTXE4YsMyeE5UuG/exec",
    folderName: "Portal_완료된 출력물 모음",
  },
  adminAccount: { username: "admin", password: import.meta.env.VITE_ADMIN_PASSWORD, name: "관리자" },
  apiKey: import.meta.env.VITE_GAS_API_KEY,
};

// ─── Data Constants (do not edit below) ─────────────────────────
export const STUDENTS_DB = EDITABLE.students;
export const ROOMS = EDITABLE.rooms;
export const DEFAULT_EQUIPMENT_DB = EDITABLE.equipment;
export const TIME_SLOTS = EDITABLE.timeSlots;
export const DEFAULT_WORKERS = EDITABLE.workers;
export const ADMIN_ACCOUNT = EDITABLE.adminAccount;
