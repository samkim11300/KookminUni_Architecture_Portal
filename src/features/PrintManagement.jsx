import { useState, useEffect } from "react";
import theme from "../constants/theme";
import { ts } from "../utils/helpers";
import Icons from "../components/Icons";
import { Badge, Card, Button, SectionTitle, Empty } from "../components/ui";

const PRINT_TYPE_LABELS = {
  COATED_DRAWING: "Coated(평면)",
  COATED_IMAGE: "Coated(이미지)",
  MATT_IMAGE: "Matt(이미지)",
  GLOSS_IMAGE: "Gloss(이미지)",
  BW: "흑백",
  COLOR: "컬러",
};

function PrintManagement({ printRequests, updatePrintRequests, refreshPrintRequests, addLog, workerName, sendEmailNotification, archivePrintsToDrive }) {
  const [filter, setFilter] = useState("pending");
  const [modalRequest, setModalRequest] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  // 반려 관련 state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const requests = Array.isArray(printRequests) ? printRequests : [];

  // 마운트 시 서버에서 최신 데이터 강제 로드 (쓰기 없이 state만 갱신)
  useEffect(() => {
    if (typeof refreshPrintRequests === "function") {
      refreshPrintRequests();
    }
  }, []);

  const filtered = requests.filter(p => {
    if (filter === "pending") return p.status === "pending";
    if (filter === "processing") return p.status === "processing";
    if (filter === "completed") return p.status === "completed";
    if (filter === "rejected") return p.status === "rejected";
    return true;
  });


  const handleStatusChange = (requestId, newStatus) => {
    const req = requests.find(p => p.id === requestId);
    updatePrintRequests(prev => prev.map(p =>
      p.id === requestId
        ? { ...p, status: newStatus, completedAt: newStatus === "completed" ? ts() : p.completedAt, processedBy: workerName }
        : p
    ));
    addLog(`출력 상태 변경: ${newStatus}`, "print", { requestId });
    if (newStatus === "completed") {
      // Drive 파일을 "Portal_출력 대기" → "Portal_완료된 출력물 모음"으로 이동
      if (archivePrintsToDrive && req) {
        archivePrintsToDrive([req], "move").catch(err => {
          console.error("Drive 파일 이동 실패:", err);
        });
      }
      if (req?.studentEmail) {
        sendEmailNotification?.({
          to: req.studentEmail,
          subject: `[출력 완료] ${req.studentName}님 · ${req.paperSize} ${req.copies}장`,
          body: `출력이 완료되었습니다.\n\n- 용지: ${req.paperSize}\n- 재질: ${PRINT_TYPE_LABELS[req.colorMode] || req.colorMode}\n- 매수: ${req.copies}장\n- +600 추가: ${req.plus600Count || 0}개\n- 금액: ${(req.totalPrice || 0).toLocaleString()}원\n\n건축대학 출력실(복지관 6층)에서 수령해주세요.`,
        });
      }
    }
    setModalRequest(null);
  };

  // 반려 처리: 사유 입력 모달 열기
  const openRejectModal = (requestId) => {
    setRejectTargetId(requestId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  // 반려 확정: 상태 변경 + 이메일 발송
  const handleReject = () => {
    if (!rejectTargetId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      alert("반려 사유를 입력해주세요.");
      return;
    }

    const req = requests.find(p => p.id === rejectTargetId);
    updatePrintRequests(prev => prev.map(p =>
      p.id === rejectTargetId
        ? { ...p, status: "rejected", rejectedAt: ts(), rejectReason: reason, processedBy: workerName }
        : p
    ));
    addLog(`출력 반려: ${req?.studentName} — ${reason}`, "print", { requestId: rejectTargetId });

    // Drive 파일 삭제 (휴지통 이동)
    if (archivePrintsToDrive && req) {
      archivePrintsToDrive([req], "delete").catch(err => {
        console.error("Drive 파일 삭제 실패:", err);
      });
    }

    // 반려 이메일 발송
    if (req?.studentEmail) {
      sendEmailNotification?.({
        to: req.studentEmail,
        subject: `[출력 반려] ${req.studentName}님 · ${req.paperSize} ${req.copies}장`,
        body: [
          `출력 신청이 반려되었습니다.`,
          ``,
          `[반려 사유]`,
          reason,
          ``,
          `[출력 정보]`,
          `- 용지: ${req.paperSize}`,
          `- 재질: ${PRINT_TYPE_LABELS[req.colorMode] || req.colorMode}`,
          `- 매수: ${req.copies}장`,
          `- +600 추가: ${req.plus600Count || 0}개`,
          `- 금액: ${(req.totalPrice || 0).toLocaleString()}원`,
          ``,
          `수정 후 다시 신청하거나, 문의사항이 있으시면 건축대학 출력실로 연락해주세요.`,
          `건축대학 교학팀`,
        ].join("\n"),
      });
    }

    setShowRejectModal(false);
    setRejectTargetId(null);
    setRejectReason("");
    setModalRequest(null);
  };


  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 완료 탭: Drive 아카이브 후 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택된 ${selectedIds.size}건을 삭제하시겠습니까?\nGoogle Drive에 백업 후 서버에서 삭제됩니다.`)) return;

    setDeleting(true);
    try {
      const toDelete = requests.filter(r => selectedIds.has(r.id));

      // Step 1: Archive to Google Drive (if configured)
      if (archivePrintsToDrive) {
        const archiveResult = await archivePrintsToDrive(toDelete);
        if (!archiveResult.ok && !archiveResult.opaque) {
          const proceed = confirm(
            `Google Drive 아카이브 중 일부 실패가 있었습니다.\n(${archiveResult.error || "알 수 없는 오류"})\n\n그래도 삭제를 진행하시겠습니까?`
          );
          if (!proceed) { setDeleting(false); return; }
        }
      }

      // Step 2: Remove from state (Drive 파일은 archive에서 이동 완료)
      updatePrintRequests(prev => prev.filter(p => !selectedIds.has(p.id)));
      addLog(`출력 요청 ${selectedIds.size}건 삭제 (Drive 아카이브 완료)`, "print");
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  // 반려 탭: Drive 아카이브 없이 바로 삭제
  const handleBulkDeleteRejected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택된 ${selectedIds.size}건을 삭제하시겠습니까?\n(반려 항목은 Google Drive에 백업하지 않고 바로 삭제됩니다.)`)) return;

    setDeleting(true);
    try {
      const toDelete = requests.filter(r => selectedIds.has(r.id));

      // Drive 파일 삭제 (GAS delete_print_files)
      if (archivePrintsToDrive) {
        const fileIds = [];
        for (const req of toDelete) {
          if (req.printFile?.driveFileId) fileIds.push(req.printFile.driveFileId);
          if (req.paymentProof?.driveFileId) fileIds.push(req.paymentProof.driveFileId);
        }
        if (fileIds.length > 0) {
          await archivePrintsToDrive(toDelete, "delete");
        }
      }

      // Remove from state
      updatePrintRequests(prev => prev.filter(p => !selectedIds.has(p.id)));
      addLog(`반려 출력 요청 ${selectedIds.size}건 삭제`, "print");
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Rejected bulk delete error:", err);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const pendingCount = requests.filter(p => p.status === "pending").length;
  const processingCount = requests.filter(p => p.status === "processing").length;
  const completedCount = requests.filter(p => p.status === "completed").length;
  const rejectedCount = requests.filter(p => p.status === "rejected").length;

  const statusLabels = { pending: "대기중", processing: "출력중", completed: "완료", rejected: "반려됨" };
  const statusColors = { pending: "yellow", processing: "blue", completed: "green", rejected: "red" };

  const showSelectionBar = (filter === "completed" || filter === "rejected") && filtered.length > 0;

  return (
    <div style={{ paddingTop: 20 }}>
      {/* 긴급 알림 */}
      {pendingCount > 0 && (
        <Card style={{ marginBottom: 16, background: theme.yellowBg, borderColor: theme.yellowBorder }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.yellow }}>새 출력 요청 {pendingCount}건</div>
              <div style={{ fontSize: 12, color: theme.textMuted }}>확인 후 출력을 진행해주세요</div>
            </div>
          </div>
        </Card>
      )}

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "pending", label: `대기 (${pendingCount})` },
          { id: "processing", label: `출력중 (${processingCount})` },
          { id: "completed", label: `완료 (${completedCount})` },
          { id: "rejected", label: `반려 (${rejectedCount})` },
          { id: "all", label: "전체" },
        ].map(f => (
          <button key={f.id} onClick={() => { setFilter(f.id); setSelectedIds(new Set()); }} style={{
            padding: "8px 16px", borderRadius: 8, border: `1px solid ${filter === f.id ? theme.accent : theme.border}`,
            background: filter === f.id ? theme.accentBg : "transparent",
            color: filter === f.id ? theme.accent : theme.textMuted,
            fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: theme.font,
          }}>{f.label}</button>
        ))}
      </div>

      {/* 완료/반려 탭 선택 삭제 */}
      {showSelectionBar && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "8px 12px", background: theme.surface, borderRadius: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.textMuted, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={(e) => {
                if (e.target.checked) setSelectedIds(new Set(filtered.map(r => r.id)));
                else setSelectedIds(new Set());
              }}
              style={{ accentColor: theme.accent }}
            />
            전체 선택 ({selectedIds.size}/{filtered.length})
          </label>
          {selectedIds.size > 0 && (
            <Button
              size="sm" variant="ghost"
              onClick={filter === "rejected" ? handleBulkDeleteRejected : handleBulkDelete}
              disabled={deleting}
              style={{ color: theme.red }}
            >
              {deleting
                ? (filter === "rejected" ? "삭제중..." : "아카이브 및 삭제중...")
                : `선택 삭제 (${selectedIds.size})`}
            </Button>
          )}
        </div>
      )}

      {/* 요청 목록 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: theme.textDim }}>
            출력 요청이 없습니다
          </div>
        ) : (
          filtered.map(req => (
            <Card key={req.id} style={{
              padding: 16, cursor: "pointer",
              borderColor: req.status === "pending" ? theme.yellow : req.status === "rejected" ? theme.red : theme.border,
              background: theme.card,
            }} onClick={() => setModalRequest(req)}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                {/* 완료/반려 탭 체크박스 */}
                {(filter === "completed" || filter === "rejected") && (
                  <div onClick={e => e.stopPropagation()} style={{ paddingTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(req.id)}
                      onChange={() => toggleSelect(req.id)}
                      style={{ accentColor: theme.accent, cursor: "pointer", width: 16, height: 16 }}
                    />
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{req.studentName}</span>
                    <Badge color="dim">{req.studentDept}</Badge>
                    <Badge color={statusColors[req.status]}>{statusLabels[req.status]}</Badge>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 13, color: theme.textMuted, flexWrap: "wrap" }}>
                    <span>📄 {req.paperSize} {PRINT_TYPE_LABELS[req.colorMode] || req.colorMode}{req.plus600Count > 0 ? ` (+600 x ${req.plus600Count})` : ""}</span>
                    <span>📋 {req.copies}장</span>
                    <span>💰 {req.totalPrice?.toLocaleString()}원</span>
                  </div>
                  {req.printFile?.emailSent ? (
                    <div style={{ fontSize: 12, color: theme.yellow, marginTop: 6, padding: "4px 10px", background: theme.yellowBg, borderRadius: 6, display: "inline-block" }}>
                      📧 sakucopy 메일에 파일 있음
                    </div>
                  ) : (
                    <a
                      href={req.printFile?.driveUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => { if (!req.printFile?.driveUrl) e.preventDefault(); }}
                      style={{ fontSize: 12, color: theme.green, marginTop: 6, padding: "4px 10px", background: theme.greenBg, borderRadius: 6, display: "inline-block", textDecoration: "none", cursor: req.printFile?.driveUrl ? "pointer" : "default", transition: "opacity 0.15s" }}
                      onMouseEnter={e => { if (req.printFile?.driveUrl) e.currentTarget.style.opacity = "0.75"; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                    >
                      📁 구글 드라이브[Portal_출력대기]에 파일 있음 {req.printFile?.driveUrl ? "[클릭하면 다운로드 가능]" : ""}
                    </a>
                  )}
                  {/* 반려 사유 표시 */}
                  {req.status === "rejected" && req.rejectReason && (
                    <div style={{ fontSize: 12, color: theme.red, marginTop: 6 }}>
                      ❌ 반려 사유: {req.rejectReason}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: theme.textDim, marginTop: 6 }}>
                    신청: {req.createdAt?.slice(5, 16).replace("T", " ")}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* 상세 모달 */}
      {modalRequest && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => setModalRequest(null)}>
          <div style={{
            background: theme.card, borderRadius: 16, width: "100%", maxWidth: 500,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${theme.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>🖨️ 출력 요청 상세</span>
                <Badge color={statusColors[modalRequest.status]}>{statusLabels[modalRequest.status]}</Badge>
              </div>
              <button onClick={() => setModalRequest(null)} style={{
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: theme.surface, color: theme.textMuted, fontSize: 16,
                cursor: "pointer", fontFamily: theme.font,
              }}>✕</button>
            </div>

            {/* 모달 내용 */}
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              {/* 학생 정보 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>신청자 정보</div>
                <div style={{ padding: 12, background: theme.surface, borderRadius: 8, fontSize: 13, color: theme.text }}>
                  <div style={{ marginBottom: 4 }}><strong>{modalRequest.studentName}</strong> · {modalRequest.studentDept}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{modalRequest.studentId}</div>
                  {modalRequest.studentEmail && <div style={{ fontSize: 12, color: theme.textMuted }}>{modalRequest.studentEmail}</div>}
                </div>
              </div>

              {/* 출력 정보 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>출력 사양</div>
                <div style={{ padding: 12, background: theme.surface, borderRadius: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13, color: theme.text }}>
                    <div>용지: <strong>{modalRequest.paperSize}</strong></div>
                    <div>재질: <strong>{PRINT_TYPE_LABELS[modalRequest.colorMode] || modalRequest.colorMode}</strong></div>
                    <div>매수: <strong>{modalRequest.copies}장</strong></div>
                    <div>+600: <strong>{modalRequest.plus600Count || 0}개</strong></div>
                  </div>
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: theme.textMuted }}>총 금액</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: theme.accent }}>{(modalRequest.totalPrice || 0).toLocaleString()}원</span>
                  </div>
                </div>
              </div>

              {/* 반려 사유 표시 (반려된 건) */}
              {modalRequest.status === "rejected" && modalRequest.rejectReason && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: theme.red, marginBottom: 8 }}>반려 사유</div>
                  <div style={{
                    padding: 12, background: `${theme.red}11`, borderRadius: 8,
                    border: `1px solid ${theme.red}33`, fontSize: 13, color: theme.text, lineHeight: 1.6,
                  }}>
                    {modalRequest.rejectReason}
                  </div>
                </div>
              )}

              {/* 시간 정보 */}
              <div style={{ fontSize: 11, color: theme.textDim, marginBottom: 16 }}>
                신청: {modalRequest.createdAt?.slice(0, 16).replace("T", " ")}
                {modalRequest.completedAt && ` · 완료: ${modalRequest.completedAt?.slice(0, 16).replace("T", " ")}`}
                {modalRequest.rejectedAt && ` · 반려: ${modalRequest.rejectedAt?.slice(0, 16).replace("T", " ")}`}
                {modalRequest.processedBy && ` · 처리: ${modalRequest.processedBy}`}
              </div>
            </div>

            {/* 모달 하단 액션 */}
            <div style={{ padding: "12px 20px", borderTop: `1px solid ${theme.border}`, background: theme.surface, display: "flex", gap: 8 }}>
              {modalRequest.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => handleStatusChange(modalRequest.id, "processing")} style={{ flex: 1, justifyContent: "center" }}>
                    🖨️ 출력 시작
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openRejectModal(modalRequest.id)} style={{ color: theme.red }}>
                    ❌ 출력 반려
                  </Button>
                </>
              )}
              {modalRequest.status === "processing" && (
                <>
                  <Button size="sm" onClick={() => handleStatusChange(modalRequest.id, "completed")} style={{ flex: 1, justifyContent: "center" }}>
                    ✅ 출력 완료
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openRejectModal(modalRequest.id)} style={{ color: theme.red }}>
                    ❌ 출력 반려
                  </Button>
                </>
              )}
              {(modalRequest.status === "completed" || modalRequest.status === "rejected") && (
                <Button size="sm" variant="ghost" onClick={() => setModalRequest(null)} style={{ flex: 1, justifyContent: "center" }}>
                  닫기
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 반려 사유 입력 모달 */}
      {showRejectModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.6)", zIndex: 10000,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => setShowRejectModal(false)}>
          <div style={{
            background: theme.card, borderRadius: 16, width: "100%", maxWidth: 420,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              padding: "16px 20px", borderBottom: `1px solid ${theme.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>❌ 출력 반려</span>
              <button onClick={() => setShowRejectModal(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: "none",
                background: theme.surface, color: theme.textMuted, fontSize: 16,
                cursor: "pointer", fontFamily: theme.font,
              }}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 12 }}>
                반려 사유를 입력해주세요. 학생에게 이메일로 전달됩니다.
              </div>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="예: 파일 형식이 올바르지 않습니다. PDF 또는 이미지 파일로 다시 제출해주세요."
                rows={4}
                style={{
                  width: "100%", padding: 12, borderRadius: 8,
                  border: `1px solid ${theme.border}`, background: theme.surface,
                  color: theme.text, fontSize: 13, fontFamily: theme.font,
                  resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>

            <div style={{
              padding: "12px 20px", borderTop: `1px solid ${theme.border}`,
              background: theme.surface, display: "flex", gap: 8, borderRadius: "0 0 16px 16px",
            }}>
              <Button size="sm" variant="ghost" onClick={() => setShowRejectModal(false)} style={{ flex: 1, justifyContent: "center" }}>
                취소
              </Button>
              <Button size="sm" onClick={handleReject} disabled={!rejectReason.trim()} style={{
                flex: 1, justifyContent: "center",
                background: rejectReason.trim() ? theme.red : theme.border,
                borderColor: rejectReason.trim() ? theme.red : theme.border,
                color: "#fff",
              }}>
                반려 확정
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PrintManagement;
