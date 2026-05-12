import { useState, useRef } from "react";
import theme from "../constants/theme";
import { EDITABLE } from "../constants/data";
import { uid, ts } from "../utils/helpers";
import Icons from "../components/Icons";
import { Badge, Card, Button, Input, SectionTitle, Empty, AlertPopup } from "../components/ui";

// ─── Print Request (출력 신청) ───────────────────────────────────
const PRINT_SIZE_OPTIONS = ["A2", "A1", "900x1200", "900x1800", "600x1500"];
const PRINT_TYPE_OPTIONS = ["COATED_DRAWING", "COATED_IMAGE", "MATT_IMAGE", "GLOSS_IMAGE"];
const PRINT_TYPE_LABELS = {
  COATED_DRAWING: "Coated(도면)",
  COATED_IMAGE: "Coated(이미지)",
  MATT_IMAGE: "Matt(이미지)",
  GLOSS_IMAGE: "Gloss(이미지)",
  BW: "흑백",
  COLOR: "컬러",
};
const PRINT_PRICES = {
  A2_COATED_DRAWING: 700,
  A2_COATED_IMAGE: 1400,
  A2_MATT_IMAGE: 2100,
  A2_GLOSS_IMAGE: 4200,
  A1_COATED_DRAWING: 1400,
  A1_COATED_IMAGE: 2800,
  A1_MATT_IMAGE: 3500,
  A1_GLOSS_IMAGE: 7000,
  "900x1200_COATED_DRAWING": 2800,
  "900x1200_COATED_IMAGE": 4900,
  "900x1200_MATT_IMAGE": 7000,
  "900x1200_GLOSS_IMAGE": 14000,
  "900x1800_COATED_DRAWING": 3500,
  "900x1800_COATED_IMAGE": 7000,
  "900x1800_MATT_IMAGE": 10500,
  "900x1800_GLOSS_IMAGE": 21000,
  "600x1500_COATED_DRAWING": 2100,
  "600x1500_COATED_IMAGE": 4900,
  "600x1500_MATT_IMAGE": 7000,
  "600x1500_GLOSS_IMAGE": 14000,
};
const PRINT_PLUS600_PRICES = {
  COATED_DRAWING: 700,
  COATED_IMAGE: 2100,
  MATT_IMAGE: 3500,
  GLOSS_IMAGE: 7000,
};

const KAKAO_BANK_ACCOUNT = "3333-35-7572363 [김경호]"; // 카카오뱅크 계좌번호

function PrintRequest({ user, printRequests, updatePrintRequests, addLog, addNotification, syncPrintToSheet, sendEmailNotification, isMobile }) {
  const [paperSize, setPaperSize] = useState("A2");
  const [colorMode, setColorMode] = useState("COATED_DRAWING");
  const [copies, setCopies] = useState(1);
  const [plus600Count, setPlus600Count] = useState(0);
  const [printFile, setPrintFile] = useState(null);
  const [paymentProof, setPaymentProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [lastRequest, setLastRequest] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [emailSentChecked, setEmailSentChecked] = useState(false);
  const printFileRef = useRef(null);
  const paymentFileRef = useRef(null);

  const priceKey = `${paperSize}_${colorMode}`;
  const unitPrice = PRINT_PRICES[priceKey] || 0;
  const plus600UnitPrice = PRINT_PLUS600_PRICES[colorMode] || 0;
  const colorModeLabel = PRINT_TYPE_LABELS[colorMode] || colorMode;
  const totalPrice = (unitPrice * copies) + (plus600UnitPrice * plus600Count * copies);

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const isLargeFile = printFile && printFile.size >= MAX_FILE_SIZE;

  const handlePrintFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPrintFile({ name: file.name, size: file.size, type: file.type, rawFile: file });
    setEmailSentChecked(false);
  };

  const handlePaymentUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPaymentProof({ name: file.name, size: file.size, type: file.type, rawFile: file });
  };

  const handleSubmit = async () => {
    if (!printFile) {
      alert("출력할 파일을 업로드해주세요.");
      return;
    }
    if (!paymentProof) {
      alert("입금 완료 캡처를 업로드해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const requestId = uid();

      // FileReader로 base64 인코딩
      const readAsBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // data:mime;base64,XXXX → XXXX 부분만 추출
          const base64 = reader.result?.split(",")[1];
          if (!base64) { reject(new Error("파일 인코딩 실패")); return; }
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("파일 읽기 실패"));
        reader.readAsDataURL(file);
      });

      // 날짜 폴더 (YY.MM.DD)
      const now = new Date();
      const dateFolder = `${String(now.getFullYear()).slice(-2)}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
      const paymentExt = (paymentProof.name || "img").split(".").pop() || "jpg";

      const gasUrl = EDITABLE.printArchive?.gasUrl?.trim();
      if (!gasUrl) {
        alert("출력 업로드 설정(gasUrl)이 되어 있지 않습니다. 관리자에게 문의하세요.");
        setSubmitting(false);
        return;
      }

      const paymentFileName = `[입금내역]${user.id}-${user.name}.${paymentExt}`;

      // GAS upload_print 호출 (no-cors — CORS 문제 우회, 응답 읽기 불가)
      const uploadToGAS = async (base64, fileName, mimeType) => {
        const payload = {
          action: "upload_print",
          key: EDITABLE.apiKey,
          base64,
          fileName,
          mimeType,
          dateFolder,
        };
        // 먼저 일반 CORS 요청 시도
        try {
          const res = await fetch(gasUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          let data;
          try { data = JSON.parse(text); } catch { data = null; }
          if (data?.ok) return data;
        } catch {
          // CORS 실패 → no-cors fallback
        }
        // no-cors fallback: 업로드는 되지만 응답 읽기 불가
        await fetch(gasUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        return null; // 응답을 읽을 수 없음
      };

      // 파일 정보 조회 (GET — CORS 문제 없음)
      const getFileInfo = async (fileName) => {
        const params = new URLSearchParams({
          action: "get_file_info",
          key: EDITABLE.apiKey,
          fileName,
          dateFolder,
        });
        const res = await fetch(`${gasUrl}?${params.toString()}`, { method: "GET" });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = null; }
        if (!data?.ok) throw new Error(data?.error || "파일 정보 조회 실패");
        return data;
      };

      // GAS 업로드 후 Drive에 파일이 생성되기까지 지연이 있을 수 있어 점진적 재시도
      const waitForFile = async (fileName, maxAttempts = 5) => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          await new Promise(r => setTimeout(r, attempt * 1000)); // 1s, 2s, 3s, 4s, 5s
          try {
            return await getFileInfo(fileName);
          } catch {
            if (attempt === maxAttempts) throw new Error("파일 생성 대기 시간 초과. 다시 시도해주세요.");
          }
        }
      };

      let printResult = null;
      let paymentResult = null;

      // 25MB 이상: 출력 파일은 이메일로 전송했으므로 입금 캡처만 업로드
      if (isLargeFile) {
        const paymentBase64 = await readAsBase64(paymentProof.rawFile);
        const paymentUploadResult = await uploadToGAS(paymentBase64, paymentFileName, paymentProof.type);
        paymentResult = paymentUploadResult;
        if (!paymentResult?.fileId) {
          paymentResult = await waitForFile(paymentFileName);
        }
      } else {
        const printExt = (printFile.name || "file").split(".").pop() || "bin";
        const printFileName = `[출력파일]${paperSize}_${colorModeLabel}_${copies}장_${user.id}-${user.name}.${printExt}`;

        const [printBase64, paymentBase64] = await Promise.all([
          readAsBase64(printFile.rawFile),
          readAsBase64(paymentProof.rawFile),
        ]);

        // 순차 업로드 (GAS 동시 실행 제한 회피)
        const printUploadResult = await uploadToGAS(printBase64, printFileName, printFile.type);
        const paymentUploadResult = await uploadToGAS(paymentBase64, paymentFileName, paymentProof.type);

        printResult = printUploadResult;
        paymentResult = paymentUploadResult;

        if (!printResult?.fileId) {
          printResult = await waitForFile(printFileName);
        }
        if (!paymentResult?.fileId) {
          paymentResult = await waitForFile(paymentFileName);
        }
      }

      const newRequest = {
        id: requestId,
        studentId: user.id,
        studentName: user.name,
        studentDept: user.dept,
        studentEmail: user.email || "",
        paperSize,
        colorMode,
        copies,
        plus600Count,
        unitPrice,
        totalPrice,
        plus600UnitPrice,
        plus600Price: plus600UnitPrice * plus600Count * copies,
        printFile: {
          name: printFile.name, size: printFile.size, type: printFile.type,
          driveFileId: printResult?.fileId || null,
          driveUrl: printResult?.downloadUrl || null,
          emailSent: isLargeFile || false,
        },
        paymentProof: { name: paymentProof.name, size: paymentProof.size, type: paymentProof.type, driveFileId: paymentResult.fileId, driveUrl: paymentResult.viewUrl },
        status: "pending",
        createdAt: ts(),
        completedAt: null,
      };

      updatePrintRequests(prev => [newRequest, ...prev]);
      addLog(`출력 신청: ${paperSize} ${colorModeLabel} ${copies}장${plus600Count > 0 ? ` (+600 x ${plus600Count})` : ""}`, "print", { studentId: user.id });
      addNotification(`🖨️ 새 출력 신청: ${user.name} - ${paperSize} ${copies}장`, "info", true);

      await syncPrintToSheet?.(newRequest);

      sendEmailNotification?.({
        to: user.email || undefined,
        subject: `[출력 신청 접수] ${user.name} · ${paperSize} ${copies}장`,
        body: `출력 신청이 접수되었습니다.\n\n- 학생: ${user.name} (${user.id})\n- 용지: ${paperSize}\n- 재질: ${colorModeLabel}\n- 매수: ${copies}장\n- +600 추가: ${plus600Count}개\n- 금액: ${totalPrice.toLocaleString()}원\n\n근로학생이 확인 후 출력해드립니다.`,
      });

      setLastRequest(newRequest);
      setPrintFile(null);
      setPaymentProof(null);
      setCopies(1);
      setPlus600Count(0);
      setShowPopup(true);
    } catch (err) {
      console.error("Print request submit error:", err);
      alert(`출력 신청 중 오류가 발생했습니다.\n\n${err?.message || "알 수 없는 오류"}\n\n※ GAS 스크립트가 최신 버전으로 배포되었는지 확인해주세요.`);
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabels = { pending: "대기중", processing: "출력중", completed: "완료", cancelled: "취소됨" };
  const statusColors = { pending: "yellow", processing: "blue", completed: "green", cancelled: "red" };

  return (
    <div style={{ paddingTop: 20 }}>
      <Card style={{ marginBottom: 20, background: theme.surface }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Icons.file size={20} color={theme.accent} />
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>📋 출력 가격표 및 안내</div>
        </div>

        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={{ border: `1px solid ${theme.border}`, padding: "8px 10px", textAlign: "left", fontSize: 12, color: theme.textMuted }}>사이즈</th>
                {PRINT_TYPE_OPTIONS.map(type => (
                  <th key={type} style={{ border: `1px solid ${theme.border}`, padding: "8px 10px", textAlign: "right", fontSize: 12, color: theme.textMuted }}>
                    {PRINT_TYPE_LABELS[type]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRINT_SIZE_OPTIONS.map(size => (
                <tr key={size}>
                  <td style={{ border: `1px solid ${theme.border}`, padding: "8px 10px", fontSize: 13, fontWeight: 600, color: theme.text }}>{size}</td>
                  {PRINT_TYPE_OPTIONS.map(type => (
                    <td key={`${size}_${type}`} style={{ border: `1px solid ${theme.border}`, padding: "8px 10px", textAlign: "right", fontSize: 13, color: theme.text }}>
                      {(PRINT_PRICES[`${size}_${type}`] || 0).toLocaleString()}원
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>
          💳 <strong>입금 계좌:</strong> 카카오뱅크 {KAKAO_BANK_ACCOUNT}<br />
          🕒 <strong>운영시간:</strong> 평일 10:00~17:00 (점심시간 12:00~13:00 제외)<br />
          📍 <strong>수령장소:</strong> 건축대학 출력실 (복지관 6층)<br />
          ℹ️ <strong>안내:</strong> 표 기준은 1장 단가이며, <code>+600</code>은 추가 600mm 길이 기준입니다.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted }}>
          <strong>+600mm 추가금(개당):</strong>{" "}
          {PRINT_TYPE_OPTIONS.map(type => `${PRINT_TYPE_LABELS[type]} ${PRINT_PLUS600_PRICES[type].toLocaleString()}원`).join(" · ")}
        </div>

        <button
          onClick={() => setShowHistoryModal(true)}
          style={{
            width: "100%", marginTop: 16, padding: "14px 16px", borderRadius: 10,
            background: `linear-gradient(135deg, ${theme.accentBg} 0%, ${theme.surface} 100%)`,
            border: `1px solid ${theme.accent}`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            transition: "all 0.2s", fontFamily: theme.font,
          }}
          onMouseOver={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseOut={e => e.currentTarget.style.transform = "translateY(0)"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📋</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>내 출력 신청 내역</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {printRequests.length > 0 ? (
              <>
                <span style={{ fontSize: 12, color: theme.textMuted }}>
                  {printRequests.filter(r => r.status === "pending").length > 0 && (
                    <Badge color="yellow" style={{ marginRight: 6 }}>대기 {printRequests.filter(r => r.status === "pending").length}</Badge>
                  )}
                  {printRequests.filter(r => r.status === "processing").length > 0 && (
                    <Badge color="blue" style={{ marginRight: 6 }}>출력중 {printRequests.filter(r => r.status === "processing").length}</Badge>
                  )}
                  {printRequests.filter(r => r.status === "completed").length > 0 && (
                    <Badge color="green">완료 {printRequests.filter(r => r.status === "completed").length}</Badge>
                  )}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: theme.textDim }}>신청 내역 없음</span>
            )}
            <span style={{ fontSize: 16, color: theme.accent }}>→</span>
          </div>
        </button>
      </Card>

      {showHistoryModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "transparent", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => setShowHistoryModal(false)}>
          <div style={{
            background: theme.card, borderRadius: 16, width: "100%", maxWidth: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${theme.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>📋 내 출력 신청 내역</div>
              <button onClick={() => setShowHistoryModal(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: theme.surface, color: theme.textMuted, fontSize: 16,
                cursor: "pointer", fontFamily: theme.font,
              }}>✕</button>
            </div>

            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {printRequests.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: theme.textDim }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🖨</div>
                  <div style={{ fontSize: 14 }}>출력 신청 내역이 없습니다</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {printRequests.map(req => (
                    <div key={req.id} style={{
                      padding: 16, background: theme.surface, borderRadius: 12,
                      border: `1px solid ${theme.border}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <span style={{ fontSize: 15, fontWeight: 600, color: theme.text }}>{req.paperSize}</span>
                          <span style={{
                            fontSize: 12, marginLeft: 8, padding: "2px 8px", borderRadius: 4,
                            background: theme.surface, color: theme.textMuted, border: `1px solid ${theme.border}`,
                          }}>{PRINT_TYPE_LABELS[req.colorMode] || req.colorMode}</span>
                          <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 8 }}>× {req.copies}장</span>
                          {req.plus600Count > 0 && <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 8 }}>+600 × {req.plus600Count}</span>}
                        </div>
                        <Badge color={statusColors[req.status]}>{statusLabels[req.status]}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>
                        📄 {req.printFile?.name || "파일 정보 없음"}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: theme.textDim }}>
                          신청: {req.createdAt?.slice(0, 10)} {req.createdAt?.slice(11, 16)}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: theme.accent }}>
                          {req.totalPrice?.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 20px", borderTop: `1px solid ${theme.border}`, background: theme.surface }}>
              <Button size="sm" variant="ghost" onClick={() => setShowHistoryModal(false)} style={{ width: "100%", justifyContent: "center" }}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: theme.text }}>🖨️ 출력 신청</div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>용지 크기</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRINT_SIZE_OPTIONS.map(size => (
              <button key={size} onClick={() => setPaperSize(size)} style={{
                padding: "10px 20px", borderRadius: 8, border: `1px solid ${paperSize === size ? theme.accent : theme.border}`,
                background: paperSize === size ? theme.accentBg : "transparent",
                color: paperSize === size ? theme.accent : theme.textMuted,
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: theme.font,
              }}>{size}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>재질</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRINT_TYPE_OPTIONS.map(type => (
              <button key={type} onClick={() => setColorMode(type)} style={{
                padding: "10px 14px", borderRadius: 8, border: `1px solid ${colorMode === type ? theme.accent : theme.border}`,
                background: colorMode === type ? theme.accentBg : "transparent",
                color: colorMode === type ? theme.accent : theme.textMuted,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: theme.font,
              }}>{PRINT_TYPE_LABELS[type]}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>매수</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setCopies(Math.max(1, copies - 1))} style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 18, cursor: "pointer", fontFamily: theme.font,
            }}>-</button>
            <input type="number" value={copies} onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))} min={1} style={{
              width: 60, padding: "8px 12px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 16, fontWeight: 600, textAlign: "center", fontFamily: theme.font,
            }} />
            <button onClick={() => setCopies(copies + 1)} style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 18, cursor: "pointer", fontFamily: theme.font,
            }}>+</button>
            <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 8 }}>장당 {unitPrice.toLocaleString()}원</span>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>+600 추가 개수</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setPlus600Count(Math.max(0, plus600Count - 1))} style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 18, cursor: "pointer", fontFamily: theme.font,
            }}>-</button>
            <input type="number" value={plus600Count} onChange={e => setPlus600Count(Math.max(0, parseInt(e.target.value) || 0))} min={0} style={{
              width: 60, padding: "8px 12px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 16, fontWeight: 600, textAlign: "center", fontFamily: theme.font,
            }} />
            <button onClick={() => setPlus600Count(plus600Count + 1)} style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface,
              color: theme.text, fontSize: 18, cursor: "pointer", fontFamily: theme.font,
            }}>+</button>
            <span style={{ fontSize: 13, color: theme.textMuted, marginLeft: 8 }}>
              개당 {plus600UnitPrice.toLocaleString()}원 (총 {(plus600UnitPrice * plus600Count * copies).toLocaleString()}원)
            </span>
          </div>
        </div>

        <div style={{ padding: 16, background: theme.accentBg, borderRadius: 8, marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>총 결제 금액</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: theme.accent }}>{totalPrice.toLocaleString()}원</span>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>출력 파일 업로드 <span style={{ color: theme.red }}>*</span></div>
          <input type="file" ref={printFileRef} onChange={handlePrintFileUpload} accept=".pdf,.jpg,.jpeg,.png,.ai,.psd,.dwg" style={{ display: "none" }} />
          <button onClick={() => printFileRef.current?.click()} style={{
            width: "100%", padding: 16, borderRadius: 8,
            border: `2px dashed ${printFile ? (isLargeFile ? theme.yellow : theme.green) : theme.border}`,
            background: printFile ? (isLargeFile ? theme.yellowBg : theme.greenBg) : "transparent",
            color: printFile ? (isLargeFile ? theme.yellow : theme.green) : theme.textMuted,
            fontSize: 13, cursor: "pointer", fontFamily: theme.font, textAlign: "center",
          }}>
            {printFile
              ? `${isLargeFile ? "⚠️" : "✅"} ${printFile.name} (${(printFile.size / 1024 / 1024).toFixed(1)}MB)`
              : "📎 파일을 선택하세요 (PDF, JPG, PNG, AI, PSD, DWG)"}
          </button>
          {isLargeFile && (
            <div style={{ marginTop: 10, padding: "12px 14px", background: theme.yellowBg, borderRadius: 8, border: `1px solid ${theme.yellow}` }}>
              <div style={{ fontSize: 12, color: theme.yellow, fontWeight: 600, marginBottom: 8 }}>
                ⚠️ 파일 용량이 25MB를 초과합니다 ({(printFile.size / 1024 / 1024).toFixed(1)}MB)
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
                sakucopy@kookmin.ac.kr 이메일로 출력 파일만 보내주신 후, 체크박스 눌러주시고 입금내역캡처파일은 업로드해주셔야 합니다!
                파일 제목 예시 - A2_Coated_1장_20xxxxx홍길동
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: theme.text, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={emailSentChecked}
                  onChange={e => setEmailSentChecked(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: theme.accent, cursor: "pointer" }}
                />
                이메일로 출력 파일을 발송했습니다
              </label>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>입금 완료 캡처 <span style={{ color: theme.red }}>*</span></div>
          <div style={{ fontSize: 11, color: theme.yellow, marginBottom: 8, padding: "8px 12px", background: theme.yellowBg, borderRadius: 6 }}>
            💡 카카오뱅크 {KAKAO_BANK_ACCOUNT}로 {totalPrice.toLocaleString()}원을 입금 후 캡처해주세요
          </div>
          <input type="file" ref={paymentFileRef} onChange={handlePaymentUpload} accept=".jpg,.jpeg,.png" style={{ display: "none" }} />
          <button onClick={() => paymentFileRef.current?.click()} style={{
            width: "100%", padding: 16, borderRadius: 8, border: `2px dashed ${paymentProof ? theme.green : theme.border}`,
            background: paymentProof ? theme.greenBg : "transparent", color: paymentProof ? theme.green : theme.textMuted,
            fontSize: 13, cursor: "pointer", fontFamily: theme.font, textAlign: "center",
          }}>
            {paymentProof ? `✅ ${paymentProof.name}` : "💰 입금 캡처 이미지를 업로드하세요"}
          </button>
        </div>

        <Button size="lg" onClick={handleSubmit} disabled={submitting || !printFile || !paymentProof || (isLargeFile && !emailSentChecked)} style={{ width: "100%", justifyContent: "center" }}>
          {submitting ? "신청 중..." : (isLargeFile && !emailSentChecked
            ? "sakucopy@kookmin.ac.kr 이메일로 출력 파일만 보내주신 후, 체크박스 눌러주시고 입금내역캡처파일은 업로드해주셔야 합니다!"
            : "출력 신청하기")}
        </Button>
      </Card>

      {/* ═══ 로딩 오버레이 ═══ */}
      {submitting && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99998,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
        }}>
          <div style={{
            width: 48, height: 48, border: `3px solid ${theme.border}`,
            borderTopColor: theme.accent, borderRadius: "50%",
            animation: "spin 0.8s linear infinite", marginBottom: 16,
          }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>출력 신청 중...</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>파일 업로드 및 접수 처리 중입니다</div>
        </div>
      )}

      {/* ═══ 출력 신청 완료 팝업 ═══ */}
      <AlertPopup
        isVisible={showPopup}
        icon="✅"
        title="출력 신청 완료!"
        description="출력 신청이 정상적으로 접수되었습니다."
        buttonText="확인했습니다"
        onClose={() => setShowPopup(false)}
        color={theme.green}
      >
        <div style={{
          background: theme.surface, borderRadius: 14,
          padding: "18px 16px", border: `1px solid ${theme.border}`,
        }}>
          {lastRequest && (
            <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.8, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>용지</span><strong style={{ color: theme.text }}>{lastRequest.paperSize}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>재질</span><strong style={{ color: theme.text }}>{PRINT_TYPE_LABELS[lastRequest.colorMode]}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>매수</span><strong style={{ color: theme.text }}>{lastRequest.copies}장</strong>
              </div>
              {lastRequest.plus600Count > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>+600 추가</span><strong style={{ color: theme.text }}>{lastRequest.plus600Count}개</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.border}` }}>
                <span style={{ fontWeight: 600 }}>총 금액</span>
                <strong style={{ color: theme.accent, fontSize: 16 }}>{lastRequest.totalPrice?.toLocaleString()}원</strong>
              </div>
            </div>
          )}
          <div style={{
            padding: "14px 14px", borderRadius: 12,
            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.6 }}>
              📌 근로학생이 확인 후 출력해드립니다
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
              출력 완료 시 알림을 보내드립니다
            </div>
          </div>
        </div>
      </AlertPopup>
    </div>
  );
}

export default PrintRequest;
