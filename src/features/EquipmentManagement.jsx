import { useState, useRef } from "react";
import theme from "../constants/theme";
import Icons from "../components/Icons";
import { Badge, Card, Button, Input, SectionTitle, Empty } from "../components/ui";

function EquipmentManagement({ equipmentDB, setEquipmentDB, categoryOrder, setCategoryOrder, addLog, workerName, isMobile }) {
  const [eqForm, setEqForm] = useState({ name: "", category: "", available: 0, total: 0, deposit: false, maxDays: 1, icon: "" });
  const [eqEditingId, setEqEditingId] = useState(null);
  const [eqDeleteConfirm, setEqDeleteConfirm] = useState(null);
  const dragCatIdx = useRef(null);
  const dragOverCatIdx = useRef(null);
  const [eqShowForm, setEqShowForm] = useState(false);
  const [eqOpenCats, setEqOpenCats] = useState({});
  const [eqNewCat, setEqNewCat] = useState(null);

  const resetEqForm = () => {
    const firstCat = [...new Set((equipmentDB || []).map(e => e.category))][0] || "";
    setEqForm({ name: "", category: firstCat, available: 0, total: 0, deposit: false, maxDays: 1, icon: "" });
    setEqNewCat(null);
    setEqEditingId(null);
    setEqShowForm(false);
  };

  const safeEquipmentDB = Array.isArray(equipmentDB) ? equipmentDB : [];
  const safeCategoryOrder = Array.isArray(categoryOrder) ? categoryOrder : [];

  return (
    <div className="fade-in">
      <SectionTitle icon={<Icons.tool size={16} color={theme.accent} />}>물품 관리</SectionTitle>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: theme.textMuted }}>
          등록된 물품: <strong style={{ color: theme.text }}>{safeEquipmentDB.length}개</strong>
        </div>
        <Button size="sm" onClick={() => { resetEqForm(); setEqShowForm(true); }}>
          <Icons.plus size={14} /> 물품 추가
        </Button>
      </div>

      {eqShowForm && (
        <Card style={{ marginBottom: 20, borderColor: theme.accentBorder }}>
          <SectionTitle icon={eqEditingId ? <Icons.edit size={16} color={theme.accent} /> : <Icons.plus size={16} color={theme.accent} />}>
            {eqEditingId ? "물품 수정" : "새 물품 등록"}
          </SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <Input
              label="물품명"
              placeholder="예: 3D 프린터"
              value={eqForm.name}
              onChange={e => setEqForm(p => ({ ...p, name: e.target.value }))}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                카테고리
              </label>
              <select
                value={eqNewCat !== null ? "__new__" : eqForm.category}
                onChange={e => {
                  if (e.target.value === "__new__") {
                    setEqNewCat("");
                    setEqForm(p => ({ ...p, category: "" }));
                  } else {
                    setEqNewCat(null);
                    setEqForm(p => ({ ...p, category: e.target.value }));
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  color: theme.text,
                  fontSize: 13,
                  fontFamily: theme.font,
                }}
              >
                {[...new Set(safeEquipmentDB.map(e => e.category))].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__new__">+ 새 카테고리 추가</option>
              </select>
              {eqNewCat !== null && (
                <input
                  autoFocus
                  placeholder="새 카테고리 이름 입력"
                  value={eqNewCat}
                  onChange={e => {
                    setEqNewCat(e.target.value);
                    setEqForm(p => ({ ...p, category: e.target.value }));
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid ${theme.accent}`,
                    background: theme.surface,
                    color: theme.text,
                    fontSize: 13,
                    fontFamily: theme.font,
                    outline: "none",
                  }}
                />
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <Input label="아이콘 (이모지)" placeholder="🔧" value={eqForm.icon} onChange={e => setEqForm(p => ({ ...p, icon: e.target.value }))} />
            <Input label="총 수량" type="number" value={eqForm.total} onChange={e => setEqForm(p => ({ ...p, total: Math.max(0, parseInt(e.target.value) || 0) }))} />
            <Input label="가용 수량" type="number" value={eqForm.available} onChange={e => setEqForm(p => ({ ...p, available: Math.max(0, parseInt(e.target.value) || 0) }))} />
            <Input label="최대 대여일" type="number" value={eqForm.maxDays} onChange={e => setEqForm(p => ({ ...p, maxDays: Math.max(1, parseInt(e.target.value) || 1) }))} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: theme.text, cursor: "pointer" }}>
              <input type="checkbox" checked={eqForm.deposit} onChange={e => setEqForm(p => ({ ...p, deposit: e.target.checked }))} />
              보증금 필요
            </label>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button
              size="sm"
              disabled={!eqForm.name.trim() || !eqForm.icon.trim() || eqForm.total <= 0 || !eqForm.category.trim()}
              onClick={() => {
                if (eqEditingId) {
                  setEquipmentDB(prev => (prev || []).map(e => e.id === eqEditingId ? { ...e, ...eqForm } : e));
                  addLog?.(`[근로학생] 물품 수정: "${eqForm.name}"`, "equipment");
                } else {
                  const newItem = { ...eqForm, id: `E${Date.now()}` };
                  setEquipmentDB(prev => [...(prev || []), newItem]);
                  addLog?.(`[근로학생] 물품 등록: "${eqForm.name}"`, "equipment");
                }
                resetEqForm();
              }}
            >
              {eqEditingId ? "수정 완료" : "등록"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetEqForm}>취소</Button>
          </div>
        </Card>
      )}

      {(() => {
        const allCats = [...new Set(safeEquipmentDB.map(e => e.category))];
        const cats = safeCategoryOrder.length > 0
          ? [...safeCategoryOrder.filter(c => allCats.includes(c)), ...allCats.filter(c => !safeCategoryOrder.includes(c))]
          : allCats;
        const toggleCat = (cat) => setEqOpenCats(prev => ({ ...prev, [cat]: !prev[cat] }));
        const handleDragStart = (idx) => { dragCatIdx.current = idx; };
        const handleDragOver = (e, idx) => { e.preventDefault(); dragOverCatIdx.current = idx; };
        const handleDrop = () => {
          if (dragCatIdx.current === null || dragOverCatIdx.current === null || dragCatIdx.current === dragOverCatIdx.current) return;
          const newCats = [...cats];
          const [moved] = newCats.splice(dragCatIdx.current, 1);
          newCats.splice(dragOverCatIdx.current, 0, moved);
          setCategoryOrder(newCats);
          dragCatIdx.current = null;
          dragOverCatIdx.current = null;
        };

        return cats.length === 0 ? (
          <Empty icon={<Icons.tool size={32} />} text="등록된 물품이 없습니다" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cats.map((cat, idx) => {
              const items = safeEquipmentDB.filter(e => e.category === cat);
              const isOpen = !!eqOpenCats[cat];
              return (
                <div
                  key={cat}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={handleDrop}
                >
                  <div
                    onClick={() => toggleCat(cat)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 18px", background: theme.surface, borderRadius: theme.radius,
                      border: `1px solid ${isOpen ? theme.accent : theme.border}`,
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        title="드래그하여 순서 변경"
                        onClick={e => e.stopPropagation()}
                        style={{ cursor: "grab", color: theme.textDim, fontSize: 14, lineHeight: 1, userSelect: "none", padding: "0 2px" }}
                      >
                        ⠿
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: isOpen ? theme.accent : theme.text }}>{cat}</div>
                      <Badge color={isOpen ? "accent" : "dim"} style={{ fontSize: 10 }}>{items.length}개</Badge>
                    </div>
                    <span style={{ fontSize: 12, color: theme.textDim, transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                  </div>
                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, paddingLeft: 12 }}>
                      {items.map(eq => (
                        <Card key={eq.id} style={{ padding: 14 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                            <div style={{ fontSize: 28, width: 40, textAlign: "center" }}>{eq.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 4 }}>{eq.name}</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <Badge color={eq.available > 0 ? "green" : "red"} style={{ fontSize: 10 }}>가용 {eq.available}/{eq.total}</Badge>
                                <Badge color="blue" style={{ fontSize: 10 }}>최대 {eq.maxDays}일</Badge>
                                {eq.deposit && <Badge color="yellow" style={{ fontSize: 10 }}>보증금</Badge>}
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEqForm({ name: eq.name, category: eq.category, available: eq.available, total: eq.total, deposit: eq.deposit, maxDays: eq.maxDays, icon: eq.icon });
                                  setEqNewCat(null);
                                  setEqEditingId(eq.id);
                                  setEqShowForm(true);
                                }}
                              >
                                <Icons.edit size={14} />
                              </Button>
                              {eqDeleteConfirm === eq.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    style={{ background: theme.red, color: "#fff" }}
                                    onClick={() => {
                                      setEquipmentDB(prev => (prev || []).filter(e => e.id !== eq.id));
                                      addLog?.(`[근로학생] 물품 삭제: "${eq.name}"`, "equipment");
                                      setEqDeleteConfirm(null);
                                    }}
                                  >
                                    삭제
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => setEqDeleteConfirm(null)}>취소</Button>
                                </>
                              ) : (
                                <Button variant="ghost" size="sm" style={{ color: theme.red }} onClick={() => setEqDeleteConfirm(eq.id)}>
                                  <Icons.x size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

export default EquipmentManagement;
