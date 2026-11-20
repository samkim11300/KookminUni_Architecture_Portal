import { useState, useMemo } from "react";
import theme from "../constants/theme";
import { formatDate } from "../utils/helpers";
import Icons from "../components/Icons";
import { Badge, Card, Button, SectionTitle, Empty } from "../components/ui";

function StudentHistory({ user, reservations, equipRentals, updateReservations, updateEquipRentals, sendEmailNotification, addLog, addNotification }) {
  const [cancelConfirm, setCancelConfirm] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [filter, setFilter] = useState("all"); // all | room | equipment
  const [selected, setSelected] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const myRes = reservations.filter(r => r.studentId === user.id);
  const myRentals = equipRentals.filter(r => r.studentId === user.id);
  const all = [...myRes.map(r => ({ ...r, sortTime: r.createdAt })), ...myRentals.map(r => ({ ...r, sortTime: r.createdAt }))]
    .sort((a, b) => b.sortTime.localeCompare(a.sortTime));
  const filtered = filter === "all" ? all : all.filter(item => item.type === filter);

  // 예약이 취소 가능한지 확인 (예약일이 아직 지나지 않은 경우)
  const canCancel = (item) => {
    if (item.type !== "room") return false;
    if (["cancelled", "rejected", "completed"].includes(item.status)) return false;
    const today = new Date().toISOString().slice(0, 10);
    return item.date >= today;
  };

  // 이용내역 삭제 가능 여부 (종료된 항목만 삭제 가능)
  const canDelete = (item) => {
    if (item.type === "room") return ["cancelled", "rejected", "completed"].includes(item.status) || item.date < new Date().toISOString().slice(0, 10);
    if (item.type === "equipment") return ["returned", "cancelled", "rejected"].includes(item.status);
    return false;
  };

  const deletableInView = useMemo(() => filtered.filter(canDelete), [filtered]);
  const selectedCount = selected.size;
  const allDeletableSelected = deletableInView.length > 0 && deletableInView.every(item => selected.has(item.id));

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setShowDeleteConfirm(false);
  };

  const toggleSelectAll = () => {
    if (allDeletableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deletableInView.map(item => item.id)));
    }
    setShowDeleteConfirm(false);
  };

  const handleDeleteSelected = () => {
    const toDelete = selected;
    const roomIds = new Set();
    const equipIds = new Set();
    for (const item of all) {
      if (!toDelete.has(item.id)) continue;
      if (item.type === "room") roomIds.add(item.id);
      else if (item.type === "equipment") equipIds.add(item.id);
    }
    if (roomIds.size > 0) updateReservations(prev => prev.filter(r => !roomIds.has(r.id)));
    if (equipIds.size > 0 && updateEquipRentals) updateEquipRentals(prev => prev.filter(r => !equipIds.has(r.id)));
    setSelected(new Set());
    setShowDeleteConfirm(false);
  };

  const handleCancelReservation = (item) => {
    setCancelling(true);
    setTimeout(() => {
      updateReservations(prev =>
        prev.map(r => r.id === item.id ? { ...r, status: "cancelled", cancelledAt: new Date().toISOString().replace('T', ' ').slice(0, 19) } : r)
      );
      addLog?.(`[예약취소] ${user.name}(${user.id}) → ${item.roomName} | ${item.date} ${item.slotLabels?.join(", ")} 예약을 취소했습니다.`, "reservation", { studentId: user.id, roomId: item.roomId });
      addNotification?.(`❌ 예약 취소: ${user.name} → ${item.roomName} (${item.date})`, "room");

      sendEmailNotification?.({
        to: user.email || undefined,
        subject: `[실기실 예약 취소] ${user.name} · ${item.roomName}`,
        body: [
          "국민대학교 건축대학 실기실 예약이 취소되었습니다.",
          "",
          "[취소된 예약 정보]",
          `- 예약자: ${user.name} (${user.id})`,
          `- 전공/학년: ${user.dept} ${user.year}학년`,
          `- 실기실: ${item.roomName}`,
          `- 날짜: ${item.date}`,
          `- 시간: ${item.slotLabels?.join(", ")}`,
          `- 목적: ${item.purpose || "개인 작업"}`,
          "",
          "[안내]",
          "- 예약이 취소되어 해당 시간대는 다른 학생이 예약할 수 있습니다.",
          "- 다시 예약이 필요한 경우 새로 예약을 진행해주세요.",
          "",
          "국민대학교 건축대학 교학팀",
        ].join("\n"),
      });

      setCancelling(false);
      setCancelConfirm(null);
      alert("✅ 예약이 취소되었습니다.\n확인 이메일이 발송됩니다.");
    }, 500);
  };

  const checkboxStyle = (checked) => ({
    width: 18,
    height: 18,
    borderRadius: 4,
    border: `2px solid ${checked ? theme.accent : theme.border}`,
    background: checked ? theme.accent : "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.15s",
  });

  return (
    <div className="fade-in">
      <SectionTitle icon={<Icons.history size={16} color={theme.accent} />}>이용 내역
        <Badge color="dim">{all.length}건</Badge>
      </SectionTitle>
      <div style={{ fontSize: 12, color: theme.textDim, marginTop: -8, marginBottom: 12 }}>
        실기실 사용일 및 물품 반납일 기준 7일 뒤 이용내역이 자동 삭제됩니다.
      </div>
      {all.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[
            { key: "all", label: "전체", count: all.length },
            { key: "room", label: "실기실", count: myRes.length },
            { key: "equipment", label: "기구대여", count: myRentals.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setFilter(t.key); setSelected(new Set()); setCancelConfirm(null); setShowDeleteConfirm(false); }}
              style={{
                padding: "5px 12px",
                fontSize: 12,
                fontWeight: filter === t.key ? 600 : 400,
                border: `1px solid ${filter === t.key ? theme.accent : theme.border}`,
                borderRadius: 6,
                background: filter === t.key ? theme.accent + "18" : "transparent",
                color: filter === t.key ? theme.accent : theme.textMuted,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t.label} <span style={{ opacity: 0.7 }}>{t.count}</span>
            </button>
          ))}
        </div>
      )}
      {/* 선택 바 */}
      {deletableInView.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", marginBottom: 10, borderRadius: 8,
          background: selectedCount > 0 ? theme.accent + "12" : theme.card,
          border: `1px solid ${selectedCount > 0 ? theme.accent + "40" : theme.border}`,
          transition: "all 0.15s",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div onClick={toggleSelectAll} style={checkboxStyle(allDeletableSelected)}>
              {allDeletableSelected && <Icons.check size={12} color="#fff" />}
            </div>
            <span style={{ fontSize: 12, color: theme.textMuted }}>
              {selectedCount > 0 ? `${selectedCount}건 선택됨` : "전체 선택"}
            </span>
          </div>
          {selectedCount > 0 && (
            showDeleteConfirm ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: theme.red }}>{selectedCount}건 삭제할까요?</span>
                <Button variant="primary" size="sm" style={{ background: theme.red, padding: "3px 12px", fontSize: 12 }} onClick={handleDeleteSelected}>삭제</Button>
                <Button variant="ghost" size="sm" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => setShowDeleteConfirm(false)}>취소</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" style={{ color: theme.red, borderColor: theme.red, padding: "3px 12px", fontSize: 12 }} onClick={() => setShowDeleteConfirm(true)}>
                <Icons.x size={12} /> 선택 삭제
              </Button>
            )
          )}
        </div>
      )}
      {filtered.length === 0 ? (
        <Empty icon={<Icons.calendar size={32} />} text={all.length === 0 ? "아직 이용 내역이 없습니다" : "해당 카테고리에 내역이 없습니다"} />
      ) : (
        <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(item => {
              const deletable = canDelete(item);
              const checked = selected.has(item.id);
              return (
                <Card key={item.id} style={{
                  padding: 16,
                  border: checked ? `1.5px solid ${theme.accent}80` : undefined,
                  transition: "border 0.15s",
                }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    {/* 체크박스 영역 */}
                    {deletable ? (
                      <div onClick={() => toggleSelect(item.id)} style={{ ...checkboxStyle(checked), marginTop: 1 }}>
                        {checked && <Icons.check size={12} color="#fff" />}
                      </div>
                    ) : (
                      <div style={{ width: 18, flexShrink: 0 }} />
                    )}
                    {/* 컨텐츠 영역 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <Badge color={item.type === "room" ? "blue" : "accent"}>{item.type === "room" ? "실기실" : "기구대여"}</Badge>
                        <Badge color={item.status === "approved" ? "green" : item.status === "ready" ? "blue" : item.status === "cancelled" || item.status === "rejected" ? "red" : "yellow"}>
                          {item.status === "approved" ? "승인" : item.status === "ready" ? "준비완료" : item.status === "cancelled" ? "취소" : item.status === "rejected" ? "반려" : item.status === "returned" ? "반납" : "대기중"}
                        </Badge>
                      </div>
                      {item.type === "room" ? (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.roomName}</div>
                          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{item.date} · {item.slotLabels?.join(", ")}</div>
                          {item.purpose && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>목적: {item.purpose}</div>}
                          {canCancel(item) && (
                            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                              {cancelConfirm === item.id ? (
                                <>
                                  <span style={{ fontSize: 13, color: theme.red }}>정말 취소하시겠습니까?</span>
                                  <Button variant="primary" size="sm" style={{ background: theme.red }} onClick={() => handleCancelReservation(item)} disabled={cancelling}>
                                    {cancelling ? "취소 중..." : "예, 취소합니다"}
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setCancelConfirm(null)}>아니오</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" style={{ color: theme.red, borderColor: theme.red }} onClick={() => setCancelConfirm(item.id)}>
                                  <Icons.x size={14} /> 예약 취소
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.items?.map(i => `${i.icon} ${i.name}`).join(", ")}</div>
                          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{item.rentDate ? `대여: ${item.rentDate} · ` : ""}반납: {item.returnDate}</div>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: theme.textDim, marginTop: 8 }}>{item.createdAt}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentHistory;
