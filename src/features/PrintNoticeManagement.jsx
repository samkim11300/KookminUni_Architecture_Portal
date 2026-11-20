import { useState, useEffect } from "react";
import theme from "../constants/theme";
import Icons from "../components/Icons";
import { Card, Button, Input, SectionTitle } from "../components/ui";

export default function PrintNoticeManagement({ printNotice, updatePrintNotice, addLog }) {
  // 출력 안내 관리
  const [printNoticeForm, setPrintNoticeForm] = useState({
    bankAccount: printNotice?.bankAccount || "카카오뱅크 3333-35-7572363 [김경호]",
    operatingHours: printNotice?.operatingHours || "평일 10:00~17:00 (점심시간 12:00~13:00 제외)",
    pickupLocation: printNotice?.pickupLocation || "건축대학 출력실 (복지관 6층)",
    noticeText: printNotice?.noticeText || "표 기준은 1장 단가이며, +600은 추가 600mm 길이 기준입니다.",
  });
  const [printNoticeSaved, setPrintNoticeSaved] = useState(false);

  useEffect(() => {
    if (printNotice) {
      setPrintNoticeForm({
        bankAccount: printNotice.bankAccount || "",
        operatingHours: printNotice.operatingHours || "",
        pickupLocation: printNotice.pickupLocation || "",
        noticeText: printNotice.noticeText || "",
      });
    }
  }, [printNotice]);

  return (
    <div>
      <SectionTitle icon={<Icons.file size={16} color={theme.accent} />}>출력 안내 및 입금 계좌 관리</SectionTitle>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16 }}>
        학생 포털 [출력 신청] 탭에 표기되는 입금 계좌, 운영시간, 수령장소, 안내 문구를 관리합니다.
      </div>
      <Card style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>💳 입금 계좌</div>
          <Input
            value={printNoticeForm.bankAccount}
            onChange={e => { setPrintNoticeForm(p => ({ ...p, bankAccount: e.target.value })); setPrintNoticeSaved(false); }}
            placeholder="예: 카카오뱅크 3333-35-7572363 [김경호]"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>🕒 운영시간</div>
          <Input
            value={printNoticeForm.operatingHours}
            onChange={e => { setPrintNoticeForm(p => ({ ...p, operatingHours: e.target.value })); setPrintNoticeSaved(false); }}
            placeholder="예: 평일 10:00~17:00 (점심시간 12:00~13:00 제외)"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>📍 수령장소</div>
          <Input
            value={printNoticeForm.pickupLocation}
            onChange={e => { setPrintNoticeForm(p => ({ ...p, pickupLocation: e.target.value })); setPrintNoticeSaved(false); }}
            placeholder="예: 건축대학 출력실 (복지관 6층)"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>ℹ️ 안내 문구</div>
          <Input
            value={printNoticeForm.noticeText}
            onChange={e => { setPrintNoticeForm(p => ({ ...p, noticeText: e.target.value })); setPrintNoticeSaved(false); }}
            placeholder="예: 표 기준은 1장 단가이며, +600은 추가 600mm 길이 기준입니다."
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button onClick={() => {
            updatePrintNotice(printNoticeForm);
            setPrintNoticeSaved(true);
            addLog("[근로학생] 출력 안내 및 입금 계좌 수정", "admin");
          }}>저장</Button>
          <Button variant="ghost" onClick={() => {
            const def = {
              bankAccount: "카카오뱅크 3333-35-7572363 [김경호]",
              operatingHours: "평일 10:00~17:00 (점심시간 12:00~13:00 제외)",
              pickupLocation: "건축대학 출력실 (복지관 6층)",
              noticeText: "표 기준은 1장 단가이며, +600은 추가 600mm 길이 기준입니다.",
            };
            setPrintNoticeForm(def);
            updatePrintNotice(def);
            setPrintNoticeSaved(true);
            addLog("[근로학생] 출력 안내 및 입금 계좌 초기화", "admin");
          }}>초기화</Button>
          {printNoticeSaved && <span style={{ fontSize: 12, color: theme.green, fontWeight: 600 }}>저장되었습니다</span>}
        </div>
      </Card>

      <Card style={{ marginTop: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 12 }}>👁️ 학생 포털 실제 표시 미리보기</div>
        <div style={{ padding: 16, background: theme.surface, borderRadius: 12, border: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
            💳 <strong>입금 계좌:</strong> {printNoticeForm.bankAccount || "계좌 정보 없음"}<br />
            🕒 <strong>운영시간:</strong> {printNoticeForm.operatingHours || "운영시간 정보 없음"}<br />
            📍 <strong>수령장소:</strong> {printNoticeForm.pickupLocation || "수령장소 정보 없음"}<br />
            ℹ️ <strong>안내:</strong> {printNoticeForm.noticeText || "안내 정보 없음"}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: theme.yellow, padding: "8px 12px", background: theme.yellowBg, borderRadius: 6 }}>
            💡 {printNoticeForm.bankAccount || "입금계좌"}로 [결제금액]원을 입금 후 캡처해주세요
          </div>
        </div>
      </Card>
    </div>
  );
}
