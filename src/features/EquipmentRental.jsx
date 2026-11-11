import { useState } from "react";
import { EDITABLE } from "../constants/data";
import theme from "../constants/theme";
import { uid, ts } from "../utils/helpers";
import Icons from "../components/Icons";
import { Badge, Card, Button, Input, SectionTitle, Empty, AlertPopup } from "../components/ui";

const isWeekend = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  return day === 0 || day === 6;
};

const isPast = (dateStr) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return d < today;
};

const nextWeekday = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function EquipmentRental({ user, equipRentals, updateEquipRentals, equipmentDB, setEquipmentDB, categoryOrder, addLog, addNotification, syncEquipToSheet, isMobile, onNavigateTab }) {
  const [selected, setSelected] = useState(null);
  const [rentDate, setRentDate] = useState(() => nextWeekday(ts().slice(0, 10)));
  const [returnConfirmed, setReturnConfirmed] = useState(false);
  const returnDate = rentDate;
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showWeekendPopup, setShowWeekendPopup] = useState(false);
  const [filterCat, setFilterCat] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [standQty, setStandQty] = useState(1);
  const [phone, setPhone] = useState("");

  const allCats = [...new Set(equipmentDB.map(e => e.category))];
  const orderedCats = categoryOrder && categoryOrder.length > 0
    ? [...categoryOrder.filter(c => allCats.includes(c)), ...allCats.filter(c => !categoryOrder.includes(c))]
    : allCats;
  const categories = ["전체", ...orderedCats];
  const filtered = equipmentDB.filter(e => {
    const matchesCat = filterCat === "전체" || e.category === filterCat;
    const matchesSearch = !searchQuery.trim() ||
      e.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      (e.category && e.category.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return matchesCat && matchesSearch;
  });

  // 대여는 당일만 가능하며, 날짜 변경 시 반납 안내를 다시 확인합니다.
  const handleRentDateChange = (val) => {
    if (!val) return;
    if (isWeekend(val)) setShowWeekendPopup(true);
    setRentDate(val);
    setReturnConfirmed(false);
  };

  const toggleEquip = (id) => {
    setSelected(prev => prev === id ? null : id);
    setStandQty(1);
    setReturnConfirmed(false);
  };

  const handleSubmit = () => {
    if (!selected || submitting || !phone.trim() || !returnConfirmed) return;
    if (isWeekend(rentDate)) { setShowWeekendPopup(true); return; }
    if (isPast(rentDate)) return;
    setSubmitting(true);
    setTimeout(() => {
      const item = equipmentDB.find(e => e.id === selected);
      if (!item) return;
      const qty = item.isStand ? Math.min(standQty, item.available) : 1;
      const rental = {
        id: uid(), type: "equipment", studentId: user.id, studentName: user.name, studentDept: user.dept, studentEmail: user.email || "",
        items: [{ id: item.id, name: item.name, icon: item.icon, qty }],
        rentDate, returnDate, note: note || "", phone: phone.trim(), status: "pending_pickup", createdAt: ts(),
      };
      updateEquipRentals(prev => [rental, ...prev]);
      setEquipmentDB(prev => prev.map(e => e.id === item.id ? { ...e, available: Math.max(0, e.available - qty) } : e));
      addLog(`[기구대여] ${user.name}(${user.id}) → ${item.name} x${qty} | 대여: ${rentDate} · 반납: ${returnDate}`, "equipment", { studentId: user.id });
      addNotification(`🔧 기구대여 요청: ${user.name} → ${item.name} x${qty}`, "equipment", true);
      syncEquipToSheet?.(rental);
      setSuccess(rental);
      setShowPopup(true);
      setSubmitting(false);
      setSelected(null);
      setNote("");
      setPhone("");
      setReturnConfirmed(false);
    }, 800);
  };

  const returnConfirmation = (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      marginTop: 14, padding: "12px 14px", borderRadius: 8,
      background: theme.yellowBg, border: `1px solid ${theme.yellowBorder}`,
      fontSize: 13, color: theme.text, lineHeight: 1.6, wordBreak: "keep-all", cursor: "pointer",
    }}>
      <input
        type="checkbox"
        required
        checked={returnConfirmed}
        onChange={e => setReturnConfirmed(e.target.checked)}
        style={{ width: 18, height: 18, margin: "3px 0 0", flexShrink: 0, accentColor: theme.accent }}
      />
      <span>
        <strong style={{ color: theme.yellow }}>[필수] 당일 반납 안내 확인</strong><br />
        물품은 대여 당일 하루만 이용할 수 있으며, 반드시 대여 당일 오후 4시 30분까지 반납해야 함을 확인했습니다.
      </span>
    </label>
  );
  const submitDisabled = submitting || isWeekend(rentDate) || isPast(rentDate) || !phone.trim() || !returnConfirmed;
  const submitLabel = submitting ? "신청 중..." : isPast(rentDate) ? "과거 날짜는 설정 불가" : isWeekend(rentDate) ? "주말은 대여일로 설정 불가" : !phone.trim() ? "연락처를 입력해주세요" : !returnConfirmed ? "당일 반납 안내를 확인해주세요" : null;

  return (
    <div className="fade-in">
      {success && (
        <Card style={{ marginBottom: 20, background: theme.greenBg, borderColor: theme.greenBorder }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icons.check size={20} color={theme.green} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.green }}>대여 신청 완료!</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>
                {success.items.map(i => i.name).join(", ")} · 대여 {success.rentDate} · 반납 {success.returnDate} 오후 4시 30분까지
              </div>
            </div>
            <Button variant="ghost" size="sm" style={{ marginLeft: "auto" }} onClick={() => setSuccess(null)}><Icons.x size={14} /></Button>
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 20, padding: 14, background: theme.blueBg, borderColor: theme.blueBorder }}>
        <div style={{ fontSize: 13, color: theme.blue, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.bell size={16} /> 신청 완료 시 근로학생에게 즉시 알림이 전송됩니다. 교학팀에서 수령해주세요.
        </div>
      </Card>

      {/* Two Column Layout */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 16 : 24, minHeight: isMobile ? "auto" : 500 }}>
        {/* Left: Equipment List */}
        <div style={{ width: isMobile ? "100%" : 320, flexShrink: 0 }}>
          <SectionTitle icon={<Icons.tool size={16} color={theme.accent} />}>물품 선택</SectionTitle>

          {/* Search Bar & Notice */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <div style={{ position: "absolute", left: 12, color: theme.textMuted, display: "flex", alignItems: "center" }}>
                <Icons.search size={16} />
              </div>
              <input
                type="text"
                placeholder="물품명 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 32px 9px 36px",
                  borderRadius: theme.radiusSm || 8,
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.text,
                  fontSize: 13,
                  fontFamily: theme.font,
                  outline: "none",
                  transition: "border-color 0.2s",
                  boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = theme.accent}
                onBlur={e => e.target.style.borderColor = theme.border}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute", right: 10, background: "none", border: "none",
                    color: theme.textMuted, cursor: "pointer", padding: 2, display: "flex", alignItems: "center"
                  }}
                >
                  <Icons.x size={14} />
                </button>
              )}
            </div>

            {/* Inquiry Notice under Search Bar */}
            <div style={{
              marginTop: 8,
              padding: "9px 12px",
              borderRadius: 8,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              fontSize: 12,
              color: theme.textMuted,
              lineHeight: 1.5,
              display: "flex",
              alignItems: "flex-start",
              gap: 6
            }}>
              <Icons.info size={14} color={theme.accent} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>
                찾으시는 물품이 없거나 재고가 없는 경우,{" "}
                <span
                  onClick={() => onNavigateTab?.("inquiries")}
                  style={{
                    color: theme.accent,
                    fontWeight: 700,
                    cursor: onNavigateTab ? "pointer" : "default",
                    textDecoration: "underline"
                  }}
                >
                  문의 내역
                </span>
                을 통해 문의해 주세요.
              </span>
            </div>
          </div>

          {/* Category Filter */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {categories.map(c => (
              <button key={c} onClick={() => setFilterCat(c)} style={{
                padding: "6px 14px", borderRadius: 20, border: `1px solid ${filterCat === c ? theme.accent : theme.border}`,
                background: filterCat === c ? theme.accentBg : "transparent",
                color: filterCat === c ? theme.accent : theme.textMuted,
                fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: theme.font, transition: "all 0.15s",
              }}>{c}</button>
            ))}
          </div>

          {/* Equipment Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: isMobile ? "none" : 450, overflowY: isMobile ? "visible" : "auto", paddingRight: isMobile ? 0 : 4 }}>
            {filtered.length === 0 ? (
              <Empty
                icon={<Icons.search size={24} />}
                text={
                  searchQuery ? (
                    <span>
                      '{searchQuery}' 검색 결과가 없습니다.<br />
                      찾는 물품이 없으면{" "}
                      <span
                        onClick={() => onNavigateTab?.("inquiries")}
                        style={{ color: theme.accent, cursor: "pointer", textDecoration: "underline", fontWeight: 600 }}
                      >
                        문의 내역
                      </span>
                      을 통해 문의해 주세요.
                    </span>
                  ) : (
                    "물품이 없습니다."
                  )
                }
              />
            ) : (
              filtered.map(eq => {
                const sel = selected === eq.id;
                const soldOut = eq.available === 0;
                return (
                  <Card key={eq.id} onClick={() => !soldOut && toggleEquip(eq.id)} style={{
                    padding: 14, cursor: soldOut ? "not-allowed" : "pointer", opacity: soldOut ? 0.4 : 1,
                    borderColor: sel ? theme.accent : theme.border,
                    background: sel ? theme.accentBg : theme.card,
                    borderLeft: sel ? `3px solid ${theme.accent}` : `3px solid transparent`,
                    display: "flex", alignItems: "center", gap: 12,
                    transition: "all 0.2s",
                  }}>
                    <div style={{ fontSize: 28, width: 40, textAlign: "center" }}>{eq.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: sel ? theme.accent : theme.text }}>{eq.name}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                        <Badge color={eq.available > 0 ? "dim" : "red"} style={{ fontSize: 10 }}>재고 {eq.available}/{eq.total}</Badge>
                      </div>
                    </div>
                    {sel && <div style={{ color: theme.accent }}><Icons.check size={20} /></div>}
                  </Card>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Details Panel — Desktop only */}
        {!isMobile && <div style={{ flex: 1 }}>
          {!selected ? (
            <div style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: theme.surface,
              borderRadius: 16,
              border: `2px dashed ${theme.border}`,
              padding: 40,
            }}>
              <div style={{ fontSize: 64, marginBottom: 16, opacity: 0.5 }}>🔧</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>물품을 선택해주세요</div>
              <div style={{ fontSize: 13, color: theme.textDim, textAlign: "center" }}>
                왼쪽 목록에서 대여할 물품을 클릭하면<br />대여 정보를 입력할 수 있습니다
              </div>
            </div>
          ) : (() => {
            const eq = equipmentDB.find(e => e.id === selected);
            if (!eq) return null;
            return (
              <div>
                {/* Equipment Details */}
                <SectionTitle icon={<Icons.info size={16} color={theme.accent} />}>물품 상세 정보</SectionTitle>
                <Card style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, background: theme.surface, borderRadius: 8 }}>
                    <div style={{ fontSize: 32, width: 50, textAlign: "center" }}>{eq.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 }}>{eq.name}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Badge color="dim">재고 {eq.available}/{eq.total}</Badge>
                        {eq.deposit && <Badge color="yellow">보증금 필요</Badge>}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 전시받침대 개수 선택 */}
                {eq.isStand && (
                  <>
                    <SectionTitle icon={<Icons.package size={16} color={theme.accent} />}>수량 선택</SectionTitle>
                    <Card style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button onClick={() => setStandQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`, background: theme.surface, cursor: "pointer", fontSize: 18, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font }}>−</button>
                        <span style={{ fontSize: 20, fontWeight: 800, color: theme.accent, fontFamily: theme.fontMono, minWidth: 40, textAlign: "center" }}>{standQty}</span>
                        <button onClick={() => setStandQty(q => Math.min(eq.available, q + 1))} style={{ width: 36, height: 36, borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`, background: theme.surface, cursor: "pointer", fontSize: 18, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font }}>+</button>
                        <span style={{ fontSize: 12, color: theme.textDim }}>/ 최대 {eq.available}개</span>
                      </div>
                    </Card>
                  </>
                )}

                {/* Rent / Return Info */}
                <SectionTitle icon={<Icons.calendar size={16} color={theme.accent} />}>대여·반납 정보</SectionTitle>
                <Card style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Input label="대여 예정일" type="date" value={rentDate} onChange={e => handleRentDateChange(e.target.value)}
                        style={{ maxWidth: 180, borderColor: (isWeekend(rentDate) || isPast(rentDate)) ? theme.red : undefined }} />
                      <div style={{ fontSize: 11, color: (isWeekend(rentDate) || isPast(rentDate)) ? theme.red : theme.textDim, fontWeight: (isWeekend(rentDate) || isPast(rentDate)) ? 600 : 400 }}>
                        {isPast(rentDate) ? "⚠️ 과거 날짜는 불가" : isWeekend(rentDate) ? "⚠️ 주말은 대여 불가" : "물품을 수령할 날짜"}
                      </div>
                    </div>
                    <div style={{ minWidth: 180 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <Input
                          label="연락처 (필수)"
                          type="tel"
                          placeholder="01012345678"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          style={{ borderColor: !phone.trim() ? theme.red : undefined }}
                        />
                        {!phone.trim() && (
                          <div style={{ fontSize: 11, color: theme.red, fontWeight: 600 }}>⚠️ 연락처를 입력해주세요</div>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Input label="비고 (선택)" placeholder="예: 수업용, 팀프로젝트 등" value={note} onChange={e => setNote(e.target.value)} />
                    </div>
                  </div>
                  {returnConfirmation}
                </Card>

                {/* Summary */}
                <Card style={{ marginBottom: 20, background: theme.surface, padding: 16 }}>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>대여 요약</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                    <Badge color="accent">{eq.icon} {eq.name}{eq.isStand ? ` x${standQty}` : ""}</Badge>
                    <Badge color="blue">대여: {rentDate}</Badge>
                    <Badge color="blue">당일 오후 4시 30분까지 반납</Badge>
                  </div>
                </Card>

                <Button size="lg" onClick={handleSubmit} disabled={submitDisabled} style={{ width: "100%", justifyContent: "center", marginBottom: 40 }}>
                  {submitLabel || `${eq.name} 대여 신청`}
                </Button>
              </div>
            );
          })()}
        </div>}
      </div>

      {/* ═══ Mobile Bottom Sheet ═══ */}
      {isMobile && selected && (() => {
        const eq = equipmentDB.find(e => e.id === selected);
        if (!eq) return null;
        return (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: "flex", flexDirection: "column" }} onClick={() => setSelected(null)}>
            <div style={{ flex: "0 0 auto", minHeight: 60, background: "rgba(0,0,0,0.5)" }} />
            <div onClick={e => e.stopPropagation()} style={{ flex: 1, background: theme.bg, borderRadius: "20px 20px 0 0", padding: "12px 20px 32px", overflowY: "auto", boxShadow: "0 -4px 30px rgba(0,0,0,0.3)" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: theme.border }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: theme.text }}>대여 신청</div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><Icons.x size={18} /></Button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: theme.surface, borderRadius: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 36, width: 50, textAlign: "center" }}>{eq.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 6 }}>{eq.name}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge color="dim">재고 {eq.available}/{eq.total}</Badge>
                    {eq.deposit && <Badge color="yellow">보증금 필요</Badge>}
                  </div>
                </div>
              </div>
              {/* 전시받침대 수량 선택 (모바일) */}
              {eq.isStand && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, marginBottom: 8 }}>수량 선택</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <button onClick={() => setStandQty(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`, background: theme.surface, cursor: "pointer", fontSize: 18, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font }}>−</button>
                    <span style={{ fontSize: 20, fontWeight: 800, color: theme.accent, fontFamily: theme.fontMono, minWidth: 40, textAlign: "center" }}>{standQty}</span>
                    <button onClick={() => setStandQty(q => Math.min(eq.available, q + 1))} style={{ width: 36, height: 36, borderRadius: theme.radiusSm, border: `1px solid ${theme.border}`, background: theme.surface, cursor: "pointer", fontSize: 18, fontWeight: 700, color: theme.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.font }}>+</button>
                    <span style={{ fontSize: 12, color: theme.textDim }}>/ 최대 {eq.available}개</span>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <Input label="대여 예정일" type="date" value={rentDate} onChange={e => handleRentDateChange(e.target.value)}
                  style={{ borderColor: (isWeekend(rentDate) || isPast(rentDate)) ? theme.red : undefined }} />
                <div style={{ fontSize: 11, marginTop: 4, color: (isWeekend(rentDate) || isPast(rentDate)) ? theme.red : theme.textDim, fontWeight: (isWeekend(rentDate) || isPast(rentDate)) ? 600 : 400 }}>
                  {isPast(rentDate) ? "⚠️ 과거 날짜는 불가" : isWeekend(rentDate) ? "⚠️ 주말은 대여 불가" : "물품을 수령할 날짜"}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <Input
                  label="연락처 (필수)"
                  type="tel"
                  placeholder="01012345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ borderColor: !phone.trim() ? theme.red : undefined }}
                />
                {!phone.trim() && (
                  <div style={{ fontSize: 11, marginTop: 4, color: theme.red, fontWeight: 600 }}>⚠️ 연락처를 입력해주세요</div>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <Input label="비고 (선택)" placeholder="예: 수업용, 팀프로젝트 등" value={note} onChange={e => setNote(e.target.value)} />
              </div>
              <div style={{ marginBottom: 20 }}>{returnConfirmation}</div>
              <Card style={{ marginBottom: 16, background: theme.surface, padding: 14 }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 8 }}>대여 요약</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <Badge color="accent">{eq.icon} {eq.name}{eq.isStand ? ` x${standQty}` : ""}</Badge>
                  <Badge color="blue">대여: {rentDate}</Badge>
                  <Badge color="blue">당일 오후 4시 30분까지 반납</Badge>
                </div>
              </Card>
              <Button size="lg" onClick={handleSubmit} disabled={submitDisabled} style={{ width: "100%", justifyContent: "center" }}>
                {submitLabel || `${eq.name} 대여 신청`}
              </Button>
            </div>
          </div>
        );
      })()}

      {/* ═══ 주말 대여 불가 팝업 ═══ */}
      <AlertPopup
        isVisible={showWeekendPopup}
        icon="🚫"
        title="주말은 대여일로 설정할 수 없습니다"
        description="물품 대여와 당일 반납은 평일(월~금)에만 가능합니다. 평일 날짜를 선택해주세요."
        buttonText="확인"
        onClose={() => setShowWeekendPopup(false)}
        color={theme.red}
      />

      {/* ═══ 대여 신청 완료 강조 팝업 ═══ */}
      <AlertPopup
        isVisible={showPopup}
        icon="✅"
        title="대여 신청 완료!"
        description="물품 대여가 정상적으로 접수되었습니다. 대여 당일 오후 4시 30분까지 반드시 반납해주세요."
        buttonText="확인했습니다"
        onClose={() => setShowPopup(false)}
        color={theme.green}
      >
        <div style={{
          background: theme.surface, borderRadius: 14,
          padding: "18px 16px", border: `1px solid ${theme.border}`,
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: theme.text, lineHeight: 1.8,
            wordBreak: "keep-all", marginBottom: 14,
          }}>
            📌 대여 신청해주신 물품 교학팀에서 준비가 되면 확인 메일 보내드리겠습니다.
          </div>
          <div style={{
            padding: "14px 14px", borderRadius: 12,
            background: "linear-gradient(135deg, #e66b6b, #c11515)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.6 }}>
              ⚠️ 물품 받으러 교학팀에 오실 때는
            </div>
            <div style={{
              fontSize: 20, fontWeight: 900, color: "#ffeb3b", lineHeight: 1.6,
              letterSpacing: 1, textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>
              🪪 신분증 및 학생증
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1.6 }}>
              꼭!! 지참해주세요!! 🙏
            </div>
          </div>
        </div>
      </AlertPopup>
    </div>
  );
}

export default EquipmentRental;
