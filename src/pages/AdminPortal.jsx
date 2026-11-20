import { useState, useRef, useEffect, useCallback } from "react";
import { EDITABLE, ROOMS } from "../constants/data";
import theme from "../constants/theme";
import { uid, ts, emailTemplate, sha256 } from "../utils/helpers";
import store from "../utils/storage";
import { certificateStorage, formStorage } from "../supabase";
import Icons from "../components/Icons";
import { Badge, Card, Button, Input, SectionTitle, Empty, Tabs } from "../components/ui";
import AnimatedBorderButton from "../components/AnimatedBorderButton";


function AdminPortal({ onLogout, logs, addLog, updateLogs, sheetConfig, updateSheetConfig, certificates, updateCertificates, inquiries, updateInquiries, sendEmailNotification, equipmentDB, setEquipmentDB, categoryOrder, setCategoryOrder, roomStatus, updateRoomStatus, formFiles, updateFormFiles, isMobile, isDark, toggleDark }) {
  const [tab, setTabRaw] = useState("roomToggle");
  const setTab = useCallback((newTab) => {
    setTabRaw(prev => {
      if (prev !== newTab) history.replaceState({ page: "admin", tab: newTab }, "");
      return newTab;
    });
  }, []);
  useEffect(() => {
    const onPopState = (e) => {
      const s = e.state;
      if (s?.page === "admin") {
        const availableTabs = ["roomToggle", "idPhoto", "forms", "adminLog", "integration"];
        setTabRaw(availableTabs.includes(s.tab) ? s.tab : "roomToggle");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [sheetUrl, setSheetUrl] = useState(sheetConfig?.reservationWebhookUrl || "");
  const [printSheetUrl, setPrintSheetUrl] = useState(sheetConfig?.printWebhookUrl || "");
  const [equipSheetUrl, setEquipSheetUrl] = useState(sheetConfig?.equipWebhookUrl || "");
  const [logSelectMode, setLogSelectMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState(new Set());
  const [logDeleteConfirm, setLogDeleteConfirm] = useState(false);
  // 양식함 관리
  const [showFormUpload, setShowFormUpload] = useState(false);
  const [formUploadFile, setFormUploadFile] = useState(null);
  const [formUploadName, setFormUploadName] = useState("");
  const [formUploadDesc, setFormUploadDesc] = useState("");
  const [formUploading, setFormUploading] = useState(false);
  const [formUploadError, setFormUploadError] = useState("");
  // 학생증 사진 변경 필터 상태
  const [idPhotoFilter, setIdPhotoFilter] = useState("all");




  // 학생증 사진 변경 문의 (hasIdPhoto === true)
  const idPhotoInquiries = (inquiries || []).filter(i => i.hasIdPhoto);
  const pendingIdPhotoCount = idPhotoInquiries.filter(i => i.status === "pending").length;

  useEffect(() => {
    setSheetUrl(sheetConfig?.reservationWebhookUrl || "");
    setPrintSheetUrl(sheetConfig?.printWebhookUrl || "");
    setEquipSheetUrl(sheetConfig?.equipWebhookUrl || "");
  }, [sheetConfig]);


  const saveSheetConfig = () => {
    updateSheetConfig(prev => ({ ...prev, reservationWebhookUrl: sheetUrl.trim(), printWebhookUrl: printSheetUrl.trim(), equipWebhookUrl: equipSheetUrl.trim() }));
    addLog("[관리자] 구글시트 연동 URL 저장", "admin");
  };

  const adminLogs = logs.filter(l => l.type === "admin");
  const approveCertificate = async (cert) => {
    setApproving(true);
    try {
      // pin이 cert에 없으면 Supabase에서 직접 조회
      let password = cert.pin || "";
      if (!password) {
        const savedPin = await store.get(`studentPin_${cert.studentId}`);
        if (savedPin) password = savedPin;
      }
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
          password,
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
            password,
            sheetName: EDITABLE.safetySheet?.sheetName || "",
          });
          try {
            await fetch(`${url}?${params.toString()}`, { method: "GET" });
          } catch (err2) {
            console.error("GET 재시도도 실패:", err2);
          }
        }
      }
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
        next[cert.studentId] = { pin: password || cert.pin, approved: true };
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

      addLog(`[관리자] 이수증 승인: ${cert.studentName}(${cert.studentId})`, "admin");
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
    addLog(`[관리자] 이수증 반려: ${cert.studentName}(${cert.studentId})${reason ? ` | 사유: ${reason}` : ""}`, "admin");
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
          <div style={{ fontSize: 11, color: theme.red, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>Admin Portal</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>관리자 설정</div>
          <Badge color="red" style={{ marginTop: 8 }}>관리자</Badge>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Button variant="ghost" size="sm" onClick={toggleDark}>{isDark ? <Icons.sun size={15} /> : <Icons.moon size={15} />}</Button>
          <Button variant="ghost" size="sm" onClick={onLogout}><Icons.logout size={15} /> 로그아웃</Button>
        </div>
      </div>

      <div style={{ paddingTop: 24 }}>
        <Tabs
          tabs={[
            { id: "roomToggle", label: "실기실 ON/OFF", icon: <Icons.power size={15} /> },

            { id: "idPhoto", label: "학생증 사진 변경", icon: <Icons.upload size={15} />, badge: pendingIdPhotoCount, badgeCircle: true },
            { id: "forms", label: "양식함 관리", icon: <Icons.clipboard size={15} /> },
            { id: "adminLog", label: "관리 이력", icon: <Icons.log size={15} /> },
            { id: "integration", label: "연동 설정", icon: <Icons.refresh size={15} /> },
          ]}
          active={tab} onChange={setTab} isMobile={isMobile} wrap
        />
      </div>

      {tab === "roomToggle" && (
        <div>
          <SectionTitle icon={<Icons.power size={16} color={theme.accent} />}>실기실 예약 ON/OFF</SectionTitle>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
              각 실기실의 예약 가능 여부를 제어합니다. OFF로 설정하면 학생이 해당 실기실을 예약할 수 없습니다.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ROOMS.map(room => {
                const isOn = roomStatus?.[room.id] !== false;
                return (
                  <div key={room.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "14px 18px", borderRadius: theme.radius,
                    background: theme.surface, border: `1px solid ${isOn ? theme.greenBorder : theme.redBorder}`,
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: isOn ? theme.green : theme.red,
                        boxShadow: `0 0 6px ${isOn ? theme.green : theme.red}`,
                      }} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{room.name}</div>
                        <div style={{ fontSize: 11, color: theme.textDim, marginTop: 2 }}>{room.building} · {room.floor} · {room.equipment}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newVal = !isOn;
                        updateRoomStatus(prev => ({ ...prev, [room.id]: newVal }));
                        addLog(`[관리자] 실기실 ${room.name} 예약 ${newVal ? "활성화(ON)" : "비활성화(OFF)"}`, "admin");
                      }}
                      style={{
                        padding: "8px 20px", borderRadius: 20, border: "none",
                        background: isOn ? theme.green : theme.red,
                        color: "#fff", fontSize: 13, fontWeight: 700,
                        cursor: "pointer", transition: "all 0.2s",
                        fontFamily: theme.font, minWidth: 70,
                      }}
                    >
                      {isOn ? "ON" : "OFF"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === "adminLog" && (
        <div>
          <SectionTitle icon={<Icons.log size={16} color={theme.accent} />}>관리자 작업 이력</SectionTitle>
          {adminLogs.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
              {logSelectMode ? (
                <>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (selectedLogIds.size === adminLogs.length) {
                      setSelectedLogIds(new Set());
                    } else {
                      setSelectedLogIds(new Set(adminLogs.map(l => l.id)));
                    }
                  }}>
                    {selectedLogIds.size === adminLogs.length ? "전체 해제" : "전체 선택"}
                  </Button>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>
                    {selectedLogIds.size}건 선택
                  </div>
                  {logDeleteConfirm ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: theme.red, fontWeight: 600 }}>삭제하시겠습니까?</span>
                      <Button size="sm" variant="danger" onClick={() => {
                        updateLogs(prev => prev.filter(l => !selectedLogIds.has(l.id)));
                        setSelectedLogIds(new Set());
                        setLogDeleteConfirm(false);
                        setLogSelectMode(false);
                      }}>확인</Button>
                      <Button size="sm" variant="ghost" onClick={() => setLogDeleteConfirm(false)}>취소</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="danger" disabled={selectedLogIds.size === 0} onClick={() => setLogDeleteConfirm(true)}>
                      <Icons.trash size={14} /> 선택 삭제
                    </Button>
                  )}
                  <div style={{ flex: 1 }} />
                  <Button size="sm" variant="ghost" onClick={() => { setLogSelectMode(false); setSelectedLogIds(new Set()); setLogDeleteConfirm(false); }}>취소</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setLogSelectMode(true)}>
                  <Icons.trash size={14} /> 선택 삭제
                </Button>
              )}
            </div>
          )}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {adminLogs.length === 0 ? (
              <Empty icon={<Icons.log size={28} />} text="관리 이력이 없습니다" />
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                {adminLogs.map(log => (
                  <div key={log.id}
                    style={{
                      padding: "12px 18px", borderBottom: `1px solid ${theme.border}`,
                      borderLeft: `3px solid ${selectedLogIds.has(log.id) ? theme.accent : theme.red}`,
                      background: selectedLogIds.has(log.id) ? theme.accentBg : "transparent",
                      cursor: logSelectMode ? "pointer" : "default",
                      transition: "background 0.15s",
                    }}
                    onClick={() => {
                      if (!logSelectMode) return;
                      setSelectedLogIds(prev => {
                        const next = new Set(prev);
                        if (next.has(log.id)) next.delete(log.id);
                        else next.add(log.id);
                        return next;
                      });
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {logSelectMode && (
                        <input
                          type="checkbox"
                          checked={selectedLogIds.has(log.id)}
                          onChange={() => {}}
                          style={{ marginTop: 2, accentColor: theme.accent, cursor: "pointer" }}
                        />
                      )}
                      <code style={{ fontSize: 11, color: theme.textDim, fontFamily: theme.fontMono, whiteSpace: "nowrap", marginTop: 1 }}>{log.time}</code>
                      <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.5 }}>{log.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}



      {tab === "idPhoto" && (
        <div className="fade-in" style={{ paddingTop: 24 }}>
          <SectionTitle icon={<Icons.upload size={16} color={theme.accent} />}>
            학생증 사진 변경
            <Badge color="accent">{pendingIdPhotoCount}건 대기</Badge>
          </SectionTitle>

          {/* 필터 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[
              { id: "all", label: "전체" },
              { id: "pending", label: "대기중" },
              { id: "answered", label: "처리완료" },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setIdPhotoFilter(f.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: theme.radiusSm,
                  border: `1px solid ${idPhotoFilter === f.id ? theme.accent : theme.border}`,
                  background: idPhotoFilter === f.id ? theme.accentBg : "transparent",
                  color: idPhotoFilter === f.id ? theme.accent : theme.textMuted,
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: theme.font,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {(() => {
            const filtered = idPhotoInquiries.filter(i => {
              if (idPhotoFilter === "pending") return i.status === "pending";
              if (idPhotoFilter === "answered") return i.status === "answered";
              return true;
            });
            return filtered.length === 0 ? (
              <Card>
                <Empty icon={<Icons.upload size={32} />} text="학생증 사진 변경 신청이 없습니다" />
              </Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map(inq => (
                  <Card key={inq.id} style={{ padding: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4 }}>
                          {inq.name}
                          <span style={{ fontSize: 12, fontWeight: 400, color: theme.textMuted, marginLeft: 8 }}>{inq.contact}</span>
                        </div>
                        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 4 }}>
                          {inq.content}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textDim }}>{inq.createdAt}</div>
                      </div>
                      <Badge color={inq.status === "pending" ? "yellow" : "green"} style={{ flexShrink: 0, marginLeft: 12 }}>
                        {inq.status === "pending" ? "대기중" : "처리완료"}
                      </Badge>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {inq.idPhotoDriveFileId ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => window.open(`https://drive.google.com/file/d/${inq.idPhotoDriveFileId}/view`, "_blank")}
                        >
                          <Icons.file size={14} /> 사진 미리보기 (Drive)
                        </Button>
                      ) : (
                        <span style={{ fontSize: 12, color: theme.textDim, padding: "4px 8px" }}>첨부 파일 없음</span>
                      )}
                      {inq.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          style={{ color: theme.green }}
                          onClick={() => {
                            updateInquiries(prev => prev.map(i =>
                              i.id === inq.id
                                ? { ...i, status: "answered", answer: { text: "처리 완료", answeredBy: "관리자", answeredAt: ts() } }
                                : i
                            ));
                            addLog(`[학생증사진] ${inq.name} 처리 완료`, "inquiry");
                            if (inq.contact && sendEmailNotification) {
                              sendEmailNotification({
                                to: inq.contact,
                                subject: `[국민대 건축대학] 학생증 사진 변경 처리 완료`,
                                body: emailTemplate(inq.name, "신청하신 학생증 사진 변경이 완료되었습니다.\n\n변경된 사진은 다음 학기 학생증 발급 시 반영됩니다.\n추가 문의사항은 건축대학 교학팀(복지관 602호)으로 연락해 주세요."),
                              });
                            }
                          }}
                        >
                          ✅ 처리 완료
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: theme.red }}
                        onClick={async () => {
                          if (!confirm("이 신청을 삭제하시겠습니까?\n구글 드라이브에 저장된 사진 파일도 함께 삭제됩니다.")) return;
                          updateInquiries(prev => prev.filter(i => i.id !== inq.id));
                          if (inq.idPhotoDriveFileId) {
                            const driveUrl = EDITABLE.driveUpload?.url?.trim();
                            if (driveUrl) {
                              try {
                                await fetch(driveUrl, {
                                  method: "POST",
                                  headers: { "Content-Type": "text/plain;charset=UTF-8" },
                                  body: JSON.stringify({
                                    action: "delete_from_drive",
                                    key: EDITABLE.apiKey,
                                    fileId: inq.idPhotoDriveFileId,
                                  }),
                                });
                              } catch (err) {
                                console.error("Drive 사진 파일 삭제 실패:", err);
                              }
                            }
                          }
                        }}
                      >
                        삭제
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {tab === "integration" && (
        <div>
          <SectionTitle icon={<Icons.refresh size={16} color={theme.accent} />}>구글 시트 연동</SectionTitle>
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
              예약 발생 시 구글 시트로 실시간 전송됩니다. Google Apps Script 웹앱 URL을 입력하세요.
            </div>
            <Input
              label="실기실 예약 GAS URL"
              placeholder="https://script.google.com/macros/s/XXX/exec"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
            />
            <div style={{ marginTop: 12 }}>
              <Input
                label="출력 관리 GAS URL"
                placeholder="https://script.google.com/macros/s/XXX/exec"
                value={printSheetUrl}
                onChange={e => setPrintSheetUrl(e.target.value)}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Input
                label="물품대여 관리 GAS URL"
                placeholder="https://script.google.com/macros/s/XXX/exec"
                value={equipSheetUrl}
                onChange={e => setEquipSheetUrl(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <Button size="sm" onClick={saveSheetConfig}>저장</Button>
              <Button size="sm" variant="ghost" onClick={() => { setSheetUrl(""); setPrintSheetUrl(""); setEquipSheetUrl(""); }}>초기화</Button>
            </div>
          </Card>
          <Card style={{ background: theme.blueBg, borderColor: theme.blueBorder, padding: 14 }}>
            <div style={{ fontSize: 12, color: theme.blue, lineHeight: 1.6 }}>
              시트로 전송되는 데이터: 학생 정보, 실기실, 날짜/시간, 목적, 인원, 생성시간. 물품대여: 학생 정보, 물품명, 수량, 반납일, 비고.
              CORS 허용과 POST 수신이 가능한 웹앱으로 배포되어야 합니다.
            </div>
          </Card>
        </div>
      )}

      {/* 양식함 관리 탭 */}
      {tab === "forms" && (
        <div>
          <SectionTitle icon={
            <AnimatedBorderButton radius={5} duration={3}>
              <div style={{ padding: "5px 6px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <Icons.clipboard size={14} color={theme.accent} />
              </div>
            </AnimatedBorderButton>
          }>
            양식함 관리
          </SectionTitle>
          <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 16 }}>
            학생들이 다운로드할 수 있는 PDF 양식 파일을 관리합니다.
          </div>

          <Button variant="primary" onClick={() => { setShowFormUpload(true); setFormUploadFile(null); setFormUploadName(""); setFormUploadDesc(""); setFormUploadError(""); }}>
            <Icons.upload size={15} /> 파일 업로드
          </Button>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {(!formFiles || formFiles.length === 0) ? (
              <Empty icon={<Icons.file size={36} />} text="등록된 양식 파일이 없습니다." />
            ) : formFiles.map(file => (
              <Card key={file.id} style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Icons.file size={20} color={theme.accent} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div title={file.name} style={{ fontWeight: 600, fontSize: 13, color: theme.text }}>{file.name}</div>
                    {file.description && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{file.description}</div>}
                    <div style={{ fontSize: 10, color: theme.textDim, marginTop: 3 }}>{file.uploadedAt?.slice(0, 10)}</div>
                  </div>
                  <Button variant="danger" size="sm" onClick={async () => {
                    if (!window.confirm(`"${file.name}" 파일을 삭제하시겠습니까?`)) return;
                    await formStorage.remove(file.path);
                    updateFormFiles(prev => prev.filter(f => f.id !== file.id));
                  }}>
                    <Icons.trash size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* 업로드 모달 */}
          {showFormUpload && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
              onClick={e => { if (e.target === e.currentTarget) setShowFormUpload(false); }}>
              <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: theme.radius, padding: 24, width: "100%", maxWidth: 440 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <Icons.upload size={16} color={theme.accent} /> 양식 파일 업로드
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>PDF 파일 선택</label>
                  <input type="file" accept=".pdf,application/pdf"
                    style={{ width: "100%", padding: "10px 14px", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm, color: theme.text, fontSize: 13, fontFamily: theme.font, boxSizing: "border-box" }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setFormUploadFile(f); if (!formUploadName) setFormUploadName(f.name.replace(/\.pdf$/i, "")); }
                    }}
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <Input label="표시 이름" value={formUploadName} onChange={e => setFormUploadName(e.target.value)} placeholder="예: 실기실 예약 신청서" />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <Input label="설명 (선택)" value={formUploadDesc} onChange={e => setFormUploadDesc(e.target.value)} placeholder="파일에 대한 간단한 설명" />
                </div>

                {formUploadError && (
                  <div style={{ fontSize: 12, color: theme.red, marginBottom: 12, padding: "8px 12px", background: theme.redBg, borderRadius: theme.radiusSm, border: `1px solid ${theme.redBorder}` }}>
                    {formUploadError}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="ghost" onClick={() => setShowFormUpload(false)} disabled={formUploading}>취소</Button>
                  <Button variant="primary" disabled={formUploading || !formUploadFile || !formUploadName.trim()} onClick={async () => {
                    if (!formUploadFile || !formUploadName.trim()) return;
                    setFormUploading(true);
                    setFormUploadError("");
                    try {
                      const fileName = formUploadName.trim().endsWith(".pdf") ? formUploadName.trim() : `${formUploadName.trim()}.pdf`;
                      const { path, error } = await formStorage.upload(formUploadFile, fileName);
                      if (error) { setFormUploadError(`업로드 실패: ${error}`); return; }
                      const newFile = { id: uid(), name: formUploadName.trim(), description: formUploadDesc.trim(), path, uploadedAt: new Date().toISOString() };
                      updateFormFiles(prev => [...(prev || []), newFile]);
                      setShowFormUpload(false);
                      addLog(`[양식함] "${formUploadName.trim()}" 파일 업로드`, "admin");
                    } catch (e) {
                      setFormUploadError(e?.message || "업로드 중 오류가 발생했습니다.");
                    } finally {
                      setFormUploading(false);
                    }
                  }}>
                    {formUploading ? "업로드 중..." : <><Icons.upload size={14} /> 업로드</>}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


    </div>
    </>
  );
}

export default AdminPortal;
