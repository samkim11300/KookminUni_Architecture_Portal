import { useState } from "react";
import { EDITABLE, TIME_SLOTS } from "../constants/data";
import theme from "../constants/theme";
import { ts } from "../utils/helpers";
import Icons from "../components/Icons";
import { Badge, Card, Button, Input, SectionTitle, Empty, Divider } from "../components/ui";

// 여러 시간대를 선택한 예약은 가장 이른 시작 시간 기준, 시간 미정은 마지막에 표시한다.
const getReservationStart = reservation => Math.min(
  24,
  ...(reservation.slots || []).map(id => TIME_SLOTS.find(slot => slot.id === id)?.start ?? 24),
);

function WorkerDashboard({ reservations, updateReservations, equipRentals, updateEquipRentals, equipmentDB, setEquipmentDB, notifications, markNotifRead, markAllNotifsRead, unreadCount, addLog, workerName, sendEmailNotification, printRequests, visitCount, dailyVisits, isMobile }) {
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [expandedChecklist, setExpandedChecklist] = useState(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);
  const [visitorPeriod, setVisitorPeriod] = useState("day"); // day | week | month
  const [visitorDate, setVisitorDate] = useState(""); // 선택 날짜 (빈 값 = 오늘)
  const [visitorHover, setVisitorHover] = useState(null);
  const todayRes = reservations.filter(r => r.status === "approved");
  const pendingRes = reservations.filter(r => r.status === "pending");
  const pendingRentals = equipRentals.filter(r => r.status === "pending_pickup");
  const activeRentals = equipRentals.filter(r => r.status === "pending_pickup" || r.status === "ready");
  const pendingPrints = (printRequests || []).filter(p => p.status === "pending" || p.status === "processing").length;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // 체크리스트 완료 상태
  const checklistItems = [
    { key: "rental", label: "물품 수령/반납 처리", icon: <Icons.package size={16} />, count: activeRentals.length, done: activeRentals.length === 0 },
    { key: "print", label: "출력 대기 처리", icon: <Icons.file size={16} />, count: pendingPrints, done: pendingPrints === 0 },
  ];
  const doneCount = checklistItems.filter(c => c.done).length;

  // 통계 데이터 계산
  const totalReservations = reservations.length;
  const totalRentals = equipRentals.length;
  const returnedRentals = equipRentals.filter(r => r.status === "returned").length;

  // 예약 기간 범위
  const resDates = reservations.map(r => r.date).filter(Boolean).sort();
  const resDateRange = resDates.length > 0
    ? `${resDates[0]} ~ ${resDates[resDates.length - 1]}`
    : today;

  // 원형 진행률 표시 컴포넌트
  const CircularProgress = ({ value, max, size = 50, color }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashLength = (percentage / 100) * circumference;

    return (
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.surface} strokeWidth={4} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", fontSize: 10, fontWeight: 700, color }}>{Math.round(percentage)}%</div>
      </div>
    );
  };

  const markEquipReady = (rentalId) => {
    updateEquipRentals(prev => prev.map(r => r.id === rentalId ? {
      ...r,
      status: "ready",
      returnChecklist: r.returnChecklist || EDITABLE.equipmentReturnChecklist.map(label => ({ label, done: false })),
    } : r));
    const rental = equipRentals.find(r => r.id === rentalId);
    if (rental) {
      addLog(`[준비완료] ${rental.studentName}의 기구대여 준비 완료 → ${rental.items.map(i => i.name).join(", ")}`, "equipment");
      if (rental.studentEmail) {
        sendEmailNotification?.({
          to: rental.studentEmail,
          subject: `[물품 준비 완료] ${rental.studentName}님 · ${rental.items.map(i => i.name).join(", ")}`,
          body: `물품 대여 준비가 완료되었습니다.\n\n- 물품: ${rental.items.map(i => `${i.icon} ${i.name}`).join(", ")}\n- 대여 예정일: ${rental.rentDate || "미정"}\n- 반납 예정일: ${rental.returnDate || "미정"}\n\n교학팀에서 수령해주세요.\n\n※※※ 신분증 또는 학생증 지참 무조건 해주셔야합니다 ※※※`,
        });
      }
    }
  };

  const markEquipReturned = (rentalId) => {
    updateEquipRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: "returned", returnedAt: ts() } : r));
    const rental = equipRentals.find(r => r.id === rentalId);
    if (rental) {
      setEquipmentDB?.(prev => prev.map(eq => {
        const matched = rental.items?.find(i => i.id === eq.id);
        if (!matched) return eq;
        const returnQty = matched.qty || 1;
        return { ...eq, available: Math.min(eq.total, (eq.available || 0) + returnQty) };
      }));
      addLog(`[반납완료] ${rental.studentName}의 기구 반납 완료 → ${rental.items.map(i => i.name).join(", ")}`, "equipment");
    }
  };

  const rejectEquipRental = (rentalId) => {
    const rental = equipRentals.find(r => r.id === rentalId);
    updateEquipRentals(prev => prev.map(r => r.id === rentalId ? { ...r, status: "rejected", rejectedAt: ts() } : r));
    if (rental) {
      // 신청 시 차감했던 재고 복구
      setEquipmentDB?.(prev => prev.map(eq => {
        const matched = rental.items?.find(i => i.id === eq.id);
        if (!matched) return eq;
        const returnQty = matched.qty || 1;
        return { ...eq, available: Math.min(eq.total, (eq.available || 0) + returnQty) };
      }));
      addLog(`[대여반려] ${rental.studentName}(${rental.studentId})의 기구대여 반려 → ${rental.items.map(i => i.name).join(", ")}`, "equipment");
      if (rental.studentEmail) {
        sendEmailNotification?.({
          to: rental.studentEmail,
          subject: `[물품 대여 반려] ${rental.studentName}님 · ${rental.items.map(i => i.name).join(", ")}`,
          body: `요청하신 물품 대여가 반려되었습니다.\n\n- 물품: ${rental.items.map(i => `${i.icon} ${i.name}`).join(", ")}\n- 대여 예정일: ${rental.rentDate || "미정"}\n- 반납 예정일: ${rental.returnDate || "미정"}\n\n자세한 사항은 교학팀으로 문의해주세요.`,
        });
      }
    }
  };

  const rejectReservation = (resId) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;
    if (!window.confirm(`${res.studentName}님의 ${res.roomName} 예약을 반려하시겠습니까?\n(${res.date} ${res.slotLabels?.join(", ")})`)) return;
    updateReservations(prev => prev.map(r => r.id === resId ? { ...r, status: "rejected", rejectedAt: ts() } : r));
    addLog(`[예약반려] ${res.studentName}(${res.studentId}) → ${res.roomName} 예약 반려 | ${res.date} ${res.slotLabels?.join(", ")}`, "reservation");
    if (res.studentEmail) {
      sendEmailNotification?.({
        to: res.studentEmail,
        subject: `[국민대 건축대학] ${res.roomName} 예약 반려 안내`,
        body: `${res.studentName}님의 ${res.roomName} 예약이 반려되었습니다.\n\n- 날짜: ${res.date}\n- 시간: ${res.slotLabels?.join(", ")}\n\n예약 시간에 방문하지 않아 반려 처리되었습니다. 자세한 사항은 교학팀으로 문의해주세요.`,
      });
    }
  };

  const toggleChecklistItem = (rentalId, idx) => {
    updateEquipRentals(prev => prev.map(r => {
      if (r.id !== rentalId) return r;
      const list = r.returnChecklist || EDITABLE.equipmentReturnChecklist.map(label => ({ label, done: false }));
      const next = list.map((item, i) => i === idx ? { ...item, done: !item.done } : item);
      return { ...r, returnChecklist: next };
    }));
  };

  return (
    <div className="fade-in">
      {/* ═══ Header ═══ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: theme.text }}>관리 대시보드</h2>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: theme.green }} />
            <span style={{ fontSize: 12, color: theme.textMuted }}>실시간</span>
          </div>
          {/* 알림 벨 */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowNotifPopup(!showNotifPopup)} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: showNotifPopup ? theme.accent : theme.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", transition: "all 0.2s" }}>
              <Icons.bell size={18} color={showNotifPopup ? "#fff" : theme.textMuted} />
              {unreadCount > 0 && (
                <span style={{ position: "absolute", top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, background: theme.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", border: `2px solid ${theme.bg}` }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifPopup && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 360, maxHeight: 400, background: theme.card, borderRadius: theme.radius, border: `1px solid ${theme.border}`, boxShadow: "0 10px 40px rgba(0,0,0,0.4)", zIndex: 1000, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>알림</span>
                    {unreadCount > 0 && <Badge color="red">{unreadCount}</Badge>}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); markAllNotifsRead(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: theme.accent, fontWeight: 600, fontFamily: theme.font }}>모두 읽음</button>
                  )}
                </div>
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center" }}>
                      <Icons.bell size={32} color={theme.textDim} />
                      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 12 }}>알림이 없습니다</div>
                    </div>
                  ) : (
                    notifications.slice(0, 15).map((n, i) => (
                      <div key={n.id} onClick={() => markNotifRead(n.id)} style={{ padding: "12px 16px", cursor: "pointer", transition: "background 0.15s", borderBottom: i < Math.min(notifications.length, 15) - 1 ? `1px solid ${theme.border}` : "none", background: !n.read ? (n.urgent ? "rgba(212,93,93,0.06)" : "rgba(212,160,83,0.06)") : "transparent", opacity: n.read ? 0.6 : 1 }}
                        onMouseEnter={e => e.currentTarget.style.background = theme.surfaceHover}
                        onMouseLeave={e => e.currentTarget.style.background = !n.read ? (n.urgent ? "rgba(212,93,93,0.06)" : "rgba(212,160,83,0.06)") : "transparent"}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: n.urgent ? theme.red : theme.accent, marginTop: 5, flexShrink: 0 }} />}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.5 }}>{n.text}</div>
                            <div style={{ fontSize: 11, color: theme.textDim, marginTop: 4 }}>{n.time}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>



      {/* ═══ 간단 요약 카드 ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "오늘 예약", value: todayRes.filter(r => r.date === today).length, icon: <Icons.calendar size={15} color={theme.accent} />, color: theme.accent },
          { label: "오늘 물품대여", value: equipRentals.filter(r => r.createdAt && r.createdAt.startsWith(today)).length, icon: <Icons.package size={15} color={theme.yellow} />, color: theme.yellow },
          { label: "오늘 방문자", value: (dailyVisits || {})[today] || 0, icon: <Icons.users size={15} color={theme.green} />, color: theme.green },
        ].map((stat, i) => (
          <Card key={i} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {stat.icon}
              <span style={{ fontSize: 11, color: theme.textMuted }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, fontFamily: theme.fontMono }}>{stat.value}</div>
          </Card>
        ))}
      </div>

      {/* ═══ 2컬럼 그리드 레이아웃 (좌: 퇴근 전 체크리스트, 우: 승인대기 & 활성 예약) ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 20, alignItems: "stretch" }}>
        {/* 왼쪽 컬럼: 퇴근 전 체크리스트 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
            {/* 체크리스트 헤더 */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icons.shield size={18} color={doneCount === checklistItems.length ? theme.green : theme.accent} />
                <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>퇴근 전 체크리스트</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 80, height: 6, borderRadius: 3, background: theme.surface, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(doneCount / checklistItems.length) * 100}%`, background: doneCount === checklistItems.length ? theme.green : theme.accent, borderRadius: 3, transition: "width 0.3s" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: doneCount === checklistItems.length ? theme.green : theme.accent, fontFamily: theme.fontMono }}>{doneCount}/{checklistItems.length}</span>
              </div>
            </div>

            {/* 체크리스트 항목들 */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {checklistItems.map((item, idx) => (
                <div key={item.key} style={{ flex: expandedChecklist ? "0 0 auto" : 1, display: "flex", flexDirection: "column", justifyContent: "center", borderBottom: idx < checklistItems.length - 1 || expandedChecklist === item.key ? `1px solid ${theme.border}` : "none" }}>
                  {/* 항목 행 */}
                  <div
                    onClick={() => setExpandedChecklist(expandedChecklist === item.key ? null : item.key)}
                    style={{
                      padding: "16px 20px", cursor: "pointer", transition: "background 0.15s",
                      display: "flex", alignItems: "center", gap: 12, width: "100%",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = theme.surfaceHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    {/* 체크 아이콘 */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: item.done ? theme.greenBg : theme.surface,
                      border: `2px solid ${item.done ? theme.green : theme.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s"
                    }}>
                      {item.done && <Icons.check size={14} color={theme.green} />}
                    </div>
                    {/* 아이콘 + 라벨 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                      <span style={{ color: item.done ? theme.green : theme.textMuted }}>{item.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: item.done ? theme.green : theme.text, textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.7 : 1 }}>{item.label}</span>
                    </div>
                    {/* 카운트 뱃지 */}
                    {item.done ? (
                      <Badge color="green">완료</Badge>
                    ) : (
                      <Badge color={item.count > 0 ? "yellow" : "dim"}>{item.count}건 남음</Badge>
                    )}
                    {/* 펼침 화살표 */}
                    <span style={{ fontSize: 11, color: theme.textDim, transition: "transform 0.2s", transform: expandedChecklist === item.key ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                  </div>

                  {/* 펼침 콘텐츠 */}
                  <div style={{
                    maxHeight: expandedChecklist === item.key ? 600 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.3s ease-in-out",
                    background: "rgba(0,0,0,0.15)",
                  }}>
                    <div style={{ padding: "12px 20px", maxHeight: 350, overflowY: "auto" }}>
                      {/* 1) 물품 수령/반납 */}
                      {item.key === "rental" && (
                        activeRentals.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "20px 0", color: theme.textDim, fontSize: 13 }}>
                            <Icons.check size={24} color={theme.green} /><div style={{ marginTop: 8 }}>진행 중인 대여가 없습니다</div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {activeRentals.map(rental => (
                              <div key={rental.id} style={{ padding: 14, background: theme.card, borderRadius: theme.radiusSm, border: `1px solid ${theme.border}` }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>
                                    {rental.studentName} <span style={{ color: theme.textMuted, fontWeight: 400 }}>({rental.studentId})</span>
                                    {rental.phone && <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 400, marginLeft: 8 }}>📞 {rental.phone}</span>}
                                  </div>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    {rental.returnDate && rental.returnDate < today && <Badge color="red">연체</Badge>}
                                    <Badge color={rental.status === "ready" ? "blue" : "yellow"}>{rental.status === "ready" ? "준비완료" : "준비 필요"}</Badge>
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 6 }}>{rental.items.map(i => `${i.icon} ${i.name}${i.qty > 1 ? ` x${i.qty}` : ""}`).join("  ·  ")}</div>
                                <div style={{ fontSize: 12, color: theme.textDim, marginBottom: 8 }}>{rental.rentDate ? `대여: ${rental.rentDate} · ` : ""}반납: {rental.returnDate}</div>
                                {rental.status === "ready" && (
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, marginBottom: 6 }}>반납 체크리스트</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                      {(rental.returnChecklist || EDITABLE.equipmentReturnChecklist.map(label => ({ label, done: false }))).map((cl, cidx) => (
                                        <label key={cidx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: theme.textMuted, cursor: "pointer" }}>
                                          <input type="checkbox" checked={!!cl.done} onChange={() => toggleChecklistItem(rental.id, cidx)} />
                                          {cl.label}
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                  {rental.status === "pending_pickup" && <Button size="sm" onClick={() => markEquipReady(rental.id)}>✓ 준비 완료</Button>}
                                  {rental.status === "pending_pickup" && <Button size="sm" variant="ghost" onClick={() => rejectEquipRental(rental.id)} style={{ color: theme.red }}>✕ 반려</Button>}
                                  {rental.status === "ready" && <Button size="sm" variant="success" onClick={() => markEquipReturned(rental.id)} disabled={(rental.returnChecklist || []).some(i => !i.done)}>↩ 반납 처리</Button>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )}

                      {/* 2) 출력 대기 */}
                      {item.key === "print" && (
                        pendingPrints === 0 ? (
                          <div style={{ textAlign: "center", padding: "20px 0", color: theme.textDim, fontSize: 13 }}>
                            <Icons.check size={24} color={theme.green} /><div style={{ marginTop: 8 }}>대기 중인 출력이 없습니다</div>
                          </div>
                        ) : (
                          <div style={{ padding: 14, background: theme.card, borderRadius: theme.radiusSm, border: `1px solid ${theme.yellowBorder}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.yellow }}>
                              <Icons.alert size={16} />
                              <span style={{ fontWeight: 600 }}>{pendingPrints}건의 출력 요청이 대기 중입니다.</span>
                            </div>
                            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>출력 대기 탭에서 처리해주세요.</div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 오른쪽 컬럼: 승인 대기 & 활성 예약 */}
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          {/* 승인 대기 예약 (캐드실) */}
          {pendingRes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Card style={{ padding: 0, overflow: "hidden", borderColor: theme.yellowBorder }}>
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: theme.yellowBg }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icons.alert size={18} color={theme.yellow} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>승인 대기 예약</span>
                  </div>
                  <Badge color="yellow">{pendingRes.length}건</Badge>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {pendingRes.map((res, i) => (
                    <div key={res.id} style={{ padding: "14px 18px", borderBottom: i < pendingRes.length - 1 ? `1px solid ${theme.border}` : "none", background: theme.yellowBg }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{res.studentName}</span>
                          <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 8 }}>{res.studentDept}</span>
                        </div>
                        <Badge color="yellow">승인 대기</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{res.roomName} · {res.date} · {res.slotLabels?.join(", ")}</div>
                      {res.purpose && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>목적: {res.purpose}</div>}
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <Button size="sm" onClick={() => {
                          updateReservations(prev => prev.map(r => r.id === res.id ? { ...r, status: "approved" } : r));
                          addLog(`[승인] ${res.studentName}(${res.studentId}) → ${res.roomName} 예약 승인 | ${res.date} ${res.slotLabels?.join(", ")}`, "reservation");
                          sendEmailNotification?.({
                            to: res.studentEmail || undefined,
                            subject: `[국민대 건축대학] 캐드실 예약 승인`,
                            body: `${res.studentName}님의 캐드실 예약이 승인되었습니다.\n\n- 날짜: ${res.date}\n- 시간: ${res.slotLabels?.join(", ")}\n- 목적: ${res.purpose}\n\n※※※ 신분증 또는 학생증 지참 무조건 해주셔야합니다 ※※※`,
                          });
                        }}>✓ 승인</Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          updateReservations(prev => prev.map(r => r.id === res.id ? { ...r, status: "rejected" } : r));
                          addLog(`[거절] ${res.studentName}(${res.studentId}) → ${res.roomName} 예약 거절 | ${res.date} ${res.slotLabels?.join(", ")}`, "reservation");
                          sendEmailNotification?.({
                            to: res.studentEmail || undefined,
                            subject: `[국민대 건축대학] 캐드실 예약 거절`,
                            body: `${res.studentName}님의 캐드실 예약이 거절되었습니다.\n\n- 날짜: ${res.date}\n- 시간: ${res.slotLabels?.join(", ")}\n\n문의사항은 교학팀으로 연락해주세요.`,
                          });
                        }} style={{ color: theme.red }}>✕ 거절</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* 활성 예약 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icons.calendar size={18} color={theme.accent} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: theme.text }}>활성 예약</span>
                </div>
                <Badge color="green">{todayRes.length}건</Badge>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: todayRes.length === 0 ? "center" : "flex-start", maxHeight: 320, minHeight: 180, overflowY: "auto" }}>
                {todayRes.length === 0 ? (
                  <Empty icon={<Icons.calendar size={28} />} text="승인된 예약이 없습니다" />
                ) : (
                  (() => {
                    const groups = todayRes.reduce((acc, res) => {
                      const key = res.date || "미정";
                      (acc[key] = acc[key] || []).push(res);
                      return acc;
                    }, {});
                    const sortedDates = Object.keys(groups).sort((a, b) => {
                      if (a === b) return 0;
                      if (a === today) return -1;
                      if (b === today) return 1;
                      if (a === "미정") return 1;
                      if (b === "미정") return -1;
                      return a.localeCompare(b);
                    });
                    const dayMap = ["일", "월", "화", "수", "목", "금", "토"];
                    return sortedDates.map((date, gi) => {
                      const items = [...groups[date]].sort((a, b) => getReservationStart(a) - getReservationStart(b));
                      const label = date === "미정"
                        ? "날짜 미정"
                        : `${date} (${dayMap[new Date(date + "T00:00:00").getDay()]})`;
                      return (
                        <div key={date}>
                          <div style={{
                            padding: "8px 18px", background: theme.surface,
                            borderTop: gi > 0 ? `1px solid ${theme.border}` : "none",
                            borderBottom: `1px solid ${theme.border}`,
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            position: "sticky", top: 0, zIndex: 1,
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: date === today ? theme.accent : theme.textMuted, fontFamily: theme.fontMono }}>
                              {date === today ? `오늘 · ${label}` : label}
                            </span>
                            <span style={{ fontSize: 11, color: theme.textDim }}>{items.length}건</span>
                          </div>
                          {items.map((res, i) => (
                            <div key={res.id} style={{ padding: "14px 18px", borderBottom: i < items.length - 1 ? `1px solid ${theme.border}` : "none" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  <span style={{ fontSize: 14, fontWeight: 600 }}>{res.studentName}</span>
                                  <span style={{ fontSize: 12, color: theme.textMuted, marginLeft: 8 }}>{res.studentDept}</span>
                                </div>
                                <Badge color="green">{res.autoApproved ? "자동승인" : "승인"}</Badge>
                              </div>
                              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{res.roomName} · {res.slotLabels?.join(", ")}</div>
                              {res.purpose && <div style={{ fontSize: 12, color: theme.textDim, marginTop: 2 }}>목적: {res.purpose}</div>}
                              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                <Button size="sm" variant="ghost" onClick={() => rejectReservation(res.id)} style={{ color: theme.red }}>✕ 반려</Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ═══ Analytics (접을 수 있음) ═══ */}
      <div style={{ marginBottom: 20 }}>
        <div
          onClick={() => setAnalyticsOpen(!analyticsOpen)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: analyticsOpen ? 12 : 0, padding: "8px 0" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: theme.text }}>
            <Icons.grid size={16} color={theme.accent} />
            Analytics
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: theme.textDim }}>{analyticsOpen ? "접기" : "펼치기"}</span>
            <span style={{ fontSize: 11, color: theme.textDim, transition: "transform 0.2s", display: "inline-block", transform: analyticsOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </div>
        </div>
        <div style={{ maxHeight: analyticsOpen ? 1600 : 0, overflow: "hidden", transition: "max-height 0.4s ease-in-out" }}>
          {/* 방문자 통계 (일간/주간/월간 선 그래프) */}
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {(() => {
              // ─── 날짜 유틸 (로컬 시간 기준) ───
              const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              const parse = (s) => new Date(s + "T00:00:00");
              const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
              const weekStart = (d) => addDays(d, -((d.getDay() + 6) % 7)); // 월요일 시작
              const visits = dailyVisits || {};
              const sumRange = (start, days) => {
                let s = 0;
                for (let i = 0; i < days; i++) s += visits[fmt(addDays(start, i))] || 0;
                return s;
              };

              const todayDate = parse(today);
              const selDate = visitorDate ? parse(visitorDate) : todayDate;
              const period = visitorPeriod;

              // ─── 기간별 데이터 포인트 생성 (선택일 기준 과거 N개) ───
              const points = [];
              if (period === "day") {
                for (let i = 14; i >= 0; i--) {
                  const d = addDays(selDate, -i);
                  points.push({ key: fmt(d), date: d, count: visits[fmt(d)] || 0, label: `${d.getDate()}일`, sub: `${d.getMonth() + 1}월` });
                }
              } else if (period === "week") {
                const ws = weekStart(selDate);
                for (let i = 11; i >= 0; i--) {
                  const d = addDays(ws, -7 * i);
                  points.push({ key: fmt(d), date: d, count: sumRange(d, 7), label: `${d.getMonth() + 1}.${d.getDate()}.`, sub: `${d.getFullYear()}` });
                }
              } else {
                for (let i = 11; i >= 0; i--) {
                  const d = new Date(selDate.getFullYear(), selDate.getMonth() - i, 1);
                  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                  points.push({ key: fmt(d), date: d, count: sumRange(d, days), label: `${d.getMonth() + 1}월`, sub: `${d.getFullYear()}` });
                }
              }
              const n = points.length;
              const selIdx = n - 1;
              const activeIdx = visitorHover != null && visitorHover < n ? visitorHover : selIdx;
              const active = points[activeIdx];

              // ─── 헤더 날짜 표기 ───
              const dot = (d) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}.`;
              const pointTitle = (p) => {
                if (period === "day") return dot(p.date);
                if (period === "week") { const e = addDays(p.date, 6); return `${dot(p.date)} ~ ${String(e.getMonth() + 1).padStart(2, "0")}.${String(e.getDate()).padStart(2, "0")}.`; }
                return `${p.date.getFullYear()}.${String(p.date.getMonth() + 1).padStart(2, "0")}.`;
              };

              // ─── 이전/다음 이동 ───
              const shift = (dir) => {
                let d;
                if (period === "day") d = addDays(selDate, dir);
                else if (period === "week") d = addDays(selDate, 7 * dir);
                else {
                  d = new Date(selDate.getFullYear(), selDate.getMonth() + dir, 1);
                  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                  d.setDate(Math.min(selDate.getDate(), last));
                }
                if (d > todayDate) d = todayDate;
                setVisitorHover(null);
                setVisitorDate(fmt(d) === today ? "" : fmt(d));
              };
              const canNext = (() => {
                if (period === "day") return selDate < todayDate;
                if (period === "week") return weekStart(selDate) < weekStart(todayDate);
                return selDate.getFullYear() * 12 + selDate.getMonth() < todayDate.getFullYear() * 12 + todayDate.getMonth();
              })();

              // ─── Y축 범위 (최소~최대 자동, 3개 기준선) ───
              const counts = points.map(p => p.count);
              let yMin = Math.min(...counts);
              let yMax = Math.max(...counts);
              if (yMax === yMin) { yMin = Math.max(0, yMin - 1); yMax = yMin + 2; }
              const pad = (yMax - yMin) * 0.12;
              const lo = Math.max(0, yMin - pad);
              const hi = yMax + pad;
              const yPct = (v) => 100 - ((v - lo) / (hi - lo)) * 100;
              const xPct = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
              const gridVals = [yMax, Math.round((yMax + yMin) / 2), yMin];

              const green = theme.green;
              const chartH = 190;
              const labelEvery = 2; // X축 라벨 격일 표시

              const NavBtn = ({ dir, disabled }) => (
                <button onClick={() => !disabled && shift(dir)} disabled={disabled}
                  style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.25 : 1, padding: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.textMuted} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={dir < 0 ? "M15 4l-8 8 8 8" : "M9 4l8 8-8 8"} />
                  </svg>
                </button>
              );

              return (
                <>
                  {/* 타이틀 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 18px", borderBottom: `1px solid ${theme.border}` }}>
                    <Icons.users size={15} color={green} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>방문자 통계</span>
                  </div>

                  {/* 날짜 네비게이션 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "14px 18px", borderBottom: `1px solid ${theme.border}` }}>
                    <NavBtn dir={-1} />
                    <span style={{ fontSize: 16, fontWeight: 600, color: theme.text, fontFamily: theme.fontMono, minWidth: period === "week" ? 190 : 110, textAlign: "center" }}>
                      {pointTitle(points[selIdx])}
                    </span>
                    <label style={{ position: "relative", display: "flex", alignItems: "center", cursor: "pointer" }} title="날짜 선택">
                      <Icons.calendar size={18} color={theme.textMuted} />
                      <input type="date" value={fmt(selDate)} max={today}
                        onChange={e => { if (e.target.value) { setVisitorHover(null); setVisitorDate(e.target.value > today ? "" : e.target.value); } }}
                        onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
                        style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%", cursor: "pointer", colorScheme: "dark" }}
                      />
                    </label>
                    <NavBtn dir={1} disabled={!canNext} />
                  </div>

                  <div style={{ padding: 18 }}>
                    {/* 일간/주간/월간 탭 */}
                    <div style={{ display: "flex", marginBottom: 18 }}>
                      {[["day", "일간"], ["week", "주간"], ["month", "월간"]].map(([k, label], i) => {
                        const on = period === k;
                        return (
                          <button key={k} onClick={() => { setVisitorPeriod(k); setVisitorHover(null); }}
                            style={{
                              flex: 1, padding: "10px 0", fontSize: 14, fontWeight: on ? 700 : 500, fontFamily: theme.font, cursor: "pointer",
                              color: on ? green : theme.textMuted, background: on ? `${green}14` : "transparent",
                              border: `1px solid ${on ? green : theme.border}`, marginLeft: i === 0 ? 0 : -1, position: "relative", zIndex: on ? 1 : 0,
                              borderRadius: i === 0 ? `${theme.radiusSm}px 0 0 ${theme.radiusSm}px` : i === 2 ? `0 ${theme.radiusSm}px ${theme.radiusSm}px 0` : 0,
                            }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* 선택 포인트 날짜 + 큰 숫자 */}
                    <div style={{ fontSize: 12, color: theme.textDim, fontFamily: theme.fontMono, marginBottom: 2 }}>{pointTitle(active)}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: theme.text, fontFamily: theme.fontMono, marginBottom: 14 }}>
                      {active.count.toLocaleString()}
                    </div>

                    {/* 선 그래프 */}
                    <div style={{ position: "relative", height: chartH, margin: "0 8px" }} onMouseLeave={() => setVisitorHover(null)}>
                      {/* 기준선 + 값 */}
                      {gridVals.map((v, i) => (
                        <div key={i} style={{ position: "absolute", left: -8, right: -8, top: `${yPct(v)}%`, borderTop: `1px solid ${theme.border}`, opacity: 0.7 }}>
                          <span style={{ position: "absolute", left: 0, top: 2, fontSize: 10, color: theme.textDim, fontFamily: theme.fontMono }}>{v.toLocaleString()}</span>
                        </div>
                      ))}

                      {/* 선택 포인트 세로선 */}
                      <div style={{ position: "absolute", top: `${yPct(active.count)}%`, bottom: -6, left: `${xPct(activeIdx)}%`, width: 1, background: theme.border, transform: "translateX(-0.5px)" }} />

                      {/* 선 */}
                      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
                        <polyline
                          points={points.map((p, i) => `${xPct(i)},${yPct(p.count)}`).join(" ")}
                          fill="none" stroke={green} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
                        />
                      </svg>

                      {/* 선택 포인트 점 */}
                      <div style={{ position: "absolute", left: `${xPct(activeIdx)}%`, top: `${yPct(active.count)}%`, width: 14, height: 14, borderRadius: "50%", background: green, transform: "translate(-50%, -50%)", boxShadow: `0 0 0 4px ${green}33`, transition: "left 0.15s, top 0.15s" }} />

                      {/* 호버/클릭 영역 */}
                      <div style={{ position: "absolute", inset: "0 -8px", display: "flex" }}>
                        {points.map((p, i) => (
                          <div key={p.key} title={`${pointTitle(p)} ${p.count.toLocaleString()}명`}
                            onMouseEnter={() => setVisitorHover(i)}
                            onClick={() => {
                              setVisitorHover(null);
                              const d = period === "week" && addDays(p.date, 6) > todayDate ? todayDate : p.date;
                              setVisitorDate(fmt(d) === today ? "" : fmt(d));
                            }}
                            style={{ flex: 1, cursor: "pointer" }} />
                        ))}
                      </div>
                    </div>

                    {/* X축 라벨 */}
                    <div style={{ position: "relative", height: 38, margin: "10px 8px 0" }}>
                      {points.map((p, i) => {
                        const isActive = i === activeIdx;
                        const show = isActive || ((n - 1 - i) % labelEvery === 0 && Math.abs(i - activeIdx) > 1);
                        if (!show) return null;
                        const showSub = i === 0 || (period === "day" && p.date.getDate() === 1) || (period !== "day" && p.date.getMonth() === 0 && (period === "month" || p.date.getDate() <= 7));
                        return (
                          <div key={p.key} style={{ position: "absolute", left: `${xPct(i)}%`, transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ fontSize: isActive ? 13 : 11, fontWeight: isActive ? 800 : 400, color: isActive ? theme.text : theme.textDim, fontFamily: theme.fontMono }}>{p.label}</div>
                            {showSub && <div style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>{p.sub}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              );
            })()}
          </Card>

        </div>
      </div>
    </div>
  );
}

export default WorkerDashboard;
