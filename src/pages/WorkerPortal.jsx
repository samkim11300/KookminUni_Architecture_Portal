import { useState, useEffect, useCallback } from "react";
import { EDITABLE } from "../constants/data";
import theme from "../constants/theme";
import { emailTemplate } from "../utils/helpers";
import store from "../utils/storage";
import { certificateStorage } from "../supabase";
import Icons from "../components/Icons";
import { Badge, Card, Button, SectionTitle, Empty, Tabs } from "../components/ui";
import WorkerDashboard from "../features/WorkerDashboard";
import PrintManagement from "../features/PrintManagement";
import InquiriesPanel from "../features/InquiriesPanel";
import LogViewer from "../features/LogViewer";

function WorkerPortal({ user, onLogout, reservations, updateReservations, equipRentals, updateEquipRentals, equipmentDB, setEquipmentDB, logs, addLog, notifications, markNotifRead, markAllNotifsRead, unreadCount, sendEmailNotification, inquiries, updateInquiries, printRequests, updatePrintRequests, refreshPrintRequests, archivePrintsToDrive, certificates, updateCertificates, visitCount, analyticsData, dailyVisits, isMobile, isDark, toggleDark }) {
  const [tab, setTabRaw] = useState("dashboard");
  const safePrintRequests = Array.isArray(printRequests) ? printRequests : [];
  const setTab = useCallback((newTab) => {
    setTabRaw(prev => {
      if (prev !== newTab) history.replaceState({ page: "worker", tab: newTab }, "");
      return newTab;
    });
  }, []);
  useEffect(() => {
    const onPopState = (e) => {
      const s = e.state;
      if (s?.page === "worker") setTabRaw(s.tab || "dashboard");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const pendingInquiries = inquiries?.filter(i => i.status === "pending" && !i.hasIdPhoto)?.length || 0;
  const pendingPrints = safePrintRequests.filter(p => p.status === "pending" || p.status === "processing").length;

  // ─── 이수증 관리 상태 ──────────────────────────────────────────
  const [certModal, setCertModal] = useState(null);
  const [certFileData, setCertFileData] = useState(null);
  const [certFileLoading, setCertFileLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  // 이수증 개수 계산 (승인 완료된 항목 제외)
  const pendingCertificates = certificates
    ? Object.fromEntries(Object.entries(certificates).filter(([_, c]) => !c.approved))
    : {};
  const certificateCount = Object.keys(pendingCertificates).length;

  const openCertModal = async (cert) => {
    setCertModal(cert);
    setCertFileData(null);
    setCertFileLoading(true);
    let fileData = null;
    if (cert.storagePath) {
      fileData = await certificateStorage.getSignedUrl(cert.storagePath);
    } else if (cert.driveFileId) {
      fileData = `https://drive.google.com/file/d/${cert.driveFileId}/view`;
    } else {
      fileData = cert.data || await store.get(`certFile_${cert.studentId}`);
    }
    setCertFileData(fileData);
    setCertFileLoading(false);
  };

  const approveCertificate = async (cert) => {
    setApproving(true);
    try {
      const url = EDITABLE.safetySheet?.url?.trim();
      if (url) {
        const payload = {
          action: "add_safety_student",
          key: EDITABLE.apiKey,
          studentId: cert.studentId,
          studentName: cert.studentName || "",
          studentYear: cert.studentYear || "",
          studentMajor: cert.studentMajor || "",
          studentEmail: cert.studentEmail || "",
          password: cert.pin || "",
          sheetName: EDITABLE.safetySheet?.sheetName || "",
          columns: EDITABLE.safetySheet?.columns || {},
        };
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          let result = null;
          try { result = JSON.parse(text); } catch { }
          if (result?.error) {
            console.error("Google Sheet 추가 실패:", result.error);
          }
        } catch (err) {
          console.warn("POST 실패, GET 재시도:", err);
          const params = new URLSearchParams({
            action: "add_safety_student",
            key: EDITABLE.apiKey,
            studentId: cert.studentId,
            studentName: cert.studentName || "",
            studentYear: cert.studentYear || "",
            studentMajor: cert.studentMajor || "",
            studentEmail: cert.studentEmail || "",
            password: cert.pin || "",
            sheetName: EDITABLE.safetySheet?.sheetName || "",
          });
          try {
            await fetch(`${url}?${params.toString()}`, { method: "GET" });
          } catch (err2) {
            console.error("GET 재시도도 실패:", err2);
          }
        }
      }
      // driveFileId가 없는 레거시 데이터만 Drive에 업로드
      if (!cert.driveFileId) {
        const driveUrl = EDITABLE.driveUpload?.url?.trim();
        if (driveUrl) {
          try {
            let base64Data = null;
            let mimeType = cert.fileType || "application/pdf";

            if (cert.storagePath) {
              const blob = await certificateStorage.download(cert.storagePath);
              if (blob) {
                base64Data = await new Promise((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result.split(",")[1]);
                  reader.readAsDataURL(blob);
                });
                mimeType = blob.type || mimeType;
              }
            } else {
              const localData = cert.data || await store.get(`certFile_${cert.studentId}`);
              if (localData && typeof localData === "string" && localData.startsWith("data:")) {
                const parts = localData.split(",");
                base64Data = parts[1];
                const mimeMatch = parts[0].match(/data:([^;]+)/);
                if (mimeMatch) mimeType = mimeMatch[1];
              }
            }

            if (base64Data) {
              const ext = (cert.fileName || cert.storagePath || "file.pdf").split(".").pop() || "pdf";
              const newFileName = `${cert.studentId}_${cert.studentName}.${ext}`;
              const folderName = EDITABLE.driveUpload?.folderName || "Portal_안전교육이수증";

              await fetch(driveUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=UTF-8" },
                body: JSON.stringify({
                  action: "upload_to_drive",
                  key: EDITABLE.apiKey,
                  fileName: newFileName,
                  mimeType,
                  folderName,
                  fileData: base64Data,
                }),
              });
            }
          } catch (driveErr) {
            console.error("Google Drive 업로드 실패:", driveErr);
          }
        }
      }

      updateCertificates(prev => {
        const next = { ...prev };
        next[cert.studentId] = { pin: cert.pin, approved: true };
        return next;
      });
      if (cert.storagePath) {
        await certificateStorage.remove(cert.storagePath);
      } else if (!cert.driveFileId) {
        store.set(`certFile_${cert.studentId}`, null);
      }

      if (cert.studentEmail && sendEmailNotification) {
        sendEmailNotification({
          to: cert.studentEmail,
          subject: `[국민대 건축대학] 안전교육이수증 승인 완료`,
          body: emailTemplate(cert.studentName, "교학팀에서 안전교육이수증 확인을 완료하였습니다.\n\n해당 메일을 받으신 시점부터 포털 로그인이 가능합니다."),
        });
      }

      addLog(`[근로학생] 이수증 승인: ${cert.studentName}(${cert.studentId})`, "admin");
      setCertModal(null);
      setApproving(false);
    } catch (err) {
      setApproving(false);
      alert("승인 처리 실패: " + (err?.message || "알 수 없는 오류"));
    }
  };

  const rejectCertificate = async (cert, reason) => {
    updateCertificates(prev => {
      const next = { ...prev };
      delete next[cert.studentId];
      return next;
    });
    if (cert.driveFileId) {
      const driveUrl = EDITABLE.driveUpload?.url?.trim();
      if (driveUrl) {
        try {
          await fetch(driveUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify({
              action: "delete_from_drive",
              key: EDITABLE.apiKey,
              fileId: cert.driveFileId,
            }),
          });
        } catch (err) {
          console.error("Drive 파일 삭제 실패:", err);
        }
      }
    } else if (cert.storagePath) {
      await certificateStorage.remove(cert.storagePath);
    } else {
      store.set(`certFile_${cert.studentId}`, null);
    }
    addLog(`[근로학생] 이수증 반려: ${cert.studentName}(${cert.studentId})${reason ? ` | 사유: ${reason}` : ""}`, "admin");
    if (cert.studentEmail) {
      sendEmailNotification({
        to: cert.studentEmail,
        subject: `[국민대 건축대학] 안전교육 이수증 반려 안내`,
        body: emailTemplate(cert.studentName, [
          "제출하신 안전교육 이수증이 반려되었습니다.",
          "",
          reason ? `[반려 사유]\n${reason}\n` : "",
          "이수증을 다시 확인하신 후 재업로드 부탁드립니다.",
          "문의사항은 포털 사이트의 문의 기능을 이용해주세요.",
        ].filter(Boolean).join("\n")),
      });
    }
    setCertModal(null);
  };

  return (
    <>
    <div className="aurora-bg" />
    <div style={{ position: "fixed", inset: 0, zIndex: 0, background: isDark ? "rgba(26,27,30,0.7)" : "rgba(248,250,252,0.7)", pointerEvents: "none" }} />
    <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      {/* Header */}
      <div style={{ padding: "20px 0 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: theme.accent, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>Worker Portal</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>관리 대시보드</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <Badge color="accent">{user.name}</Badge>
            <Badge color="dim">{user.shift}</Badge>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Button variant="ghost" size="sm" onClick={toggleDark}>{isDark ? <Icons.sun size={15} /> : <Icons.moon size={15} />}</Button>
          <Button variant="ghost" size="sm" onClick={onLogout}><Icons.logout size={15} /> 나가기</Button>
        </div>
      </div>

      <div style={{ paddingTop: 24 }}>
        <Tabs
          tabs={[
            { id: "dashboard", label: "대시보드", icon: <Icons.home size={15} />, badge: unreadCount },
            { id: "certificates", label: "이수증 관리", icon: <Icons.file size={15} />, badge: certificateCount, badgeCircle: true },
            { id: "print", label: "출력 관리", icon: <Icons.file size={15} />, badge: pendingPrints },
            { id: "inquiries", label: "문의", icon: <Icons.file size={15} />, badge: pendingInquiries },
            { id: "logs", label: "일지", icon: <Icons.log size={15} /> },
          ]}
          active={tab} onChange={setTab} isMobile={isMobile}
        />
      </div>

      {tab === "dashboard" && (
        <WorkerDashboard
          reservations={reservations} updateReservations={updateReservations}
          equipRentals={equipRentals} updateEquipRentals={updateEquipRentals}
          equipmentDB={equipmentDB} setEquipmentDB={setEquipmentDB}
          notifications={notifications} markNotifRead={markNotifRead} markAllNotifsRead={markAllNotifsRead}
          unreadCount={unreadCount} addLog={addLog} workerName={user.name}
          sendEmailNotification={sendEmailNotification}
          printRequests={safePrintRequests}
          visitCount={visitCount}
          dailyVisits={dailyVisits}
          isMobile={isMobile}
        />
      )}

      {tab === "certificates" && (
        <div>
          <SectionTitle icon={<Icons.file size={16} color={theme.blue} />}>이수증 관리</SectionTitle>
          <Card>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
              학생들이 업로드한 안전교육이수증을 확인하고 관리합니다.
            </div>
            {!Object.keys(pendingCertificates).length ? (
              <Empty icon={<Icons.file size={28} />} text="업로드된 이수증이 없습니다" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {Object.entries(pendingCertificates).map(([studentId, cert]) => (
                  <Card
                    key={studentId}
                    style={{ background: theme.surface, padding: 14, cursor: "pointer" }}
                    hover
                    onClick={() => openCertModal(cert)}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{ padding: 12, background: theme.blueBg, borderRadius: theme.radiusSm, border: `1px solid ${theme.blueBorder}` }}>
                        <Icons.file size={24} color={theme.blue} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{cert.studentName || studentId}</span>
                          <Badge color="blue">이수증</Badge>
                        </div>
                        <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>
                          학번: {studentId} · 파일명: {cert.fileName}
                        </div>
                        <div style={{ display: "flex", gap: 12, fontSize: 11, color: theme.textDim }}>
                          <span>크기: {(cert.fileSize / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>업로드: {new Date(cert.uploadDate).toLocaleString("ko-KR")}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: theme.blue, fontWeight: 600 }}>
                        클릭하여 확인 →
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "print" && (
        <PrintManagement printRequests={safePrintRequests} updatePrintRequests={updatePrintRequests} refreshPrintRequests={refreshPrintRequests} addLog={addLog} workerName={user.name} sendEmailNotification={sendEmailNotification} archivePrintsToDrive={archivePrintsToDrive} />
      )}
      {tab === "inquiries" && (
        <InquiriesPanel inquiries={inquiries} updateInquiries={updateInquiries} workerName={user.name} addLog={addLog} sendEmailNotification={sendEmailNotification} />
      )}
      {tab === "logs" && (
        <LogViewer logs={logs} addLog={addLog} />
      )}

      {/* Certificate Preview Modal */}
      {certModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 20
        }}
          onClick={() => setCertModal(null)}
        >
          <div style={{
            background: theme.card,
            borderRadius: theme.radius,
            border: "none",
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            maxWidth: 900,
            width: "100%",
            maxHeight: "90vh",
            overflow: "auto",
            padding: 24
          }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
                  안전교육이수증 확인
                </div>
                <div style={{ fontSize: 13, color: theme.textMuted }}>
                  {certModal.studentName || "이름 없음"} ({certModal.studentId})
                </div>
              </div>
              <button
                onClick={() => setCertModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: theme.textMuted,
                  cursor: "pointer",
                  fontSize: 24,
                  padding: 4
                }}
              >
                <Icons.x size={20} />
              </button>
            </div>

            <div style={{
              background: theme.surface,
              borderRadius: theme.radiusSm,
              padding: 16,
              marginBottom: 20,
              maxHeight: "60vh",
              overflow: "auto",
              display: "flex",
              justifyContent: "center",
              alignItems: "center"
            }}>
              {certFileLoading ? (
                <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
                  <div style={{ fontSize: 14 }}>파일 로딩 중...</div>
                </div>
              ) : !certFileData ? (
                <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
                  <Icons.file size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <div style={{ fontSize: 14 }}>파일을 불러올 수 없습니다</div>
                </div>
              ) : certModal.driveFileId ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <Icons.file size={48} color={theme.blue} style={{ marginBottom: 16, opacity: 0.8 }} />
                  <div style={{ fontSize: 14, color: theme.text, fontWeight: 600, marginBottom: 8 }}>
                    Google Drive에 저장된 파일입니다
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 20 }}>
                    아래 버튼을 클릭하면 새 탭에서 파일을 확인할 수 있습니다
                  </div>
                  <button
                    onClick={() => window.open(certFileData, "_blank")}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "10px 20px", borderRadius: theme.radius,
                      background: theme.blue, color: "#fff",
                      border: "none", cursor: "pointer",
                      fontSize: 14, fontWeight: 600, fontFamily: theme.font,
                    }}
                  >
                    <Icons.external size={16} /> Google Drive에서 열기
                  </button>
                </div>
              ) : certModal.fileType?.startsWith("image/") ? (
                <img
                  src={certFileData}
                  alt="이수증"
                  style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain" }}
                />
              ) : certModal.fileType === "application/pdf" ? (
                <iframe
                  src={certFileData}
                  style={{ width: "100%", height: "60vh", border: "none" }}
                  title="PDF 이수증"
                />
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: theme.textMuted }}>
                  <Icons.file size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <div style={{ fontSize: 14 }}>미리보기를 지원하지 않는 파일 형식입니다</div>
                  <div style={{ fontSize: 12, marginTop: 8 }}>{certModal.fileName}</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 12, color: theme.textDim, marginBottom: 20, padding: "12px 16px", background: theme.surface, borderRadius: theme.radiusSm }}>
              <span>파일명: {certModal.fileName}</span>
              <span>•</span>
              <span>크기: {(certModal.fileSize / 1024).toFixed(1)} KB</span>
              <span>•</span>
              <span>업로드: {new Date(certModal.uploadDate).toLocaleString("ko-KR")}</span>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button
                variant="ghost"
                onClick={() => {
                  if (!certFileData) return;
                  if (certModal.driveFileId) {
                    window.open(`https://drive.google.com/uc?id=${certModal.driveFileId}&export=download`, "_blank");
                  } else if (certModal.storagePath) {
                    fetch(certFileData)
                      .then(res => res.blob())
                      .then(blob => {
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = certModal.fileName;
                        link.click();
                        URL.revokeObjectURL(url);
                      });
                  } else {
                    const link = document.createElement("a");
                    link.href = certFileData;
                    link.download = certModal.fileName;
                    link.click();
                  }
                }}
              >
                <Icons.download size={16} /> 다운로드
              </Button>
              <Button
                variant="success"
                onClick={() => approveCertificate(certModal)}
                disabled={approving}
              >
                <Icons.check size={16} /> {approving ? "처리 중..." : "이상없음 (승인)"}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  const reason = window.prompt(`${certModal.studentName}(${certModal.studentId})의 이수증을 반려합니다.\n반려 사유를 입력해주세요:`, "");
                  if (reason !== null) {
                    rejectCertificate(certModal, reason);
                  }
                }}
              >
                <Icons.x size={16} /> 반려
              </Button>
              <Button variant="ghost" onClick={() => setCertModal(null)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

export default WorkerPortal;
