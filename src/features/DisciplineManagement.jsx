import { useState } from "react";
import { ts } from "../utils/helpers";
import theme from "../constants/theme";
import Icons from "../components/Icons";
import { Card, Button, Input, SectionTitle, Empty } from "../components/ui";

export default function DisciplineManagement({ warnings, updateWarnings, blacklist, updateBlacklist, printBlacklist, updatePrintBlacklist, addLog, isMobile }) {
  const [warnForm, setWarnForm] = useState({ studentId: "", name: "", reason: "" });
  const [blkForm, setBlkForm] = useState({ studentId: "", name: "", reason: "" });
  const [pblkForm, setPblkForm] = useState({ studentId: "", name: "", reason: "" });

  const addWarning = () => {
    if (!warnForm.studentId.trim()) return;
    updateWarnings(prev => {
      const prevItem = prev[warnForm.studentId] || { count: 0 };
      const next = {
        ...prev,
        [warnForm.studentId]: {
          studentId: warnForm.studentId.trim(),
          name: warnForm.name.trim() || prevItem.name || "",
          count: (prevItem.count || 0) + 1,
          reason: warnForm.reason.trim() || prevItem.reason || "",
          updatedAt: ts(),
        }
      };
      return next;
    });
    addLog(`[근로학생] 경고 추가: ${warnForm.studentId} ${warnForm.name} ${warnForm.reason ? `| ${warnForm.reason}` : ""}`, "admin");
    setWarnForm({ studentId: "", name: "", reason: "" });
  };

  const removeWarning = (studentId) => {
    updateWarnings(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    addLog(`[근로학생] 경고 삭제: ${studentId}`, "admin");
  };

  const addBlacklist = () => {
    if (!blkForm.studentId.trim()) return;
    updateBlacklist(prev => ({
      ...prev,
      [blkForm.studentId.trim()]: {
        studentId: blkForm.studentId.trim(),
        name: blkForm.name.trim() || "",
        reason: blkForm.reason.trim() || "",
        updatedAt: ts(),
      }
    }));
    addLog(`[근로학생] 블랙리스트 등록: ${blkForm.studentId} ${blkForm.name} ${blkForm.reason ? `| ${blkForm.reason}` : ""}`, "admin");
    setBlkForm({ studentId: "", name: "", reason: "" });
  };

  const removeBlacklist = (studentId) => {
    updateBlacklist(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    addLog(`[근로학생] 블랙리스트 해제: ${studentId}`, "admin");
  };

  const addPrintBlacklist = () => {
    if (!pblkForm.studentId.trim()) return;
    updatePrintBlacklist(prev => ({
      ...prev,
      [pblkForm.studentId.trim()]: {
        studentId: pblkForm.studentId.trim(),
        name: pblkForm.name.trim() || "",
        reason: pblkForm.reason.trim() || "",
        updatedAt: ts(),
      }
    }));
    addLog(`[근로학생] 출력 블랙리스트 등록: ${pblkForm.studentId} ${pblkForm.name} ${pblkForm.reason ? `| ${pblkForm.reason}` : ""}`, "admin");
    setPblkForm({ studentId: "", name: "", reason: "" });
  };

  const removePrintBlacklist = (studentId) => {
    updatePrintBlacklist(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    addLog(`[근로학생] 출력 블랙리스트 해제: ${studentId}`, "admin");
  };

  return (
    <div>
      <SectionTitle icon={<Icons.alert size={16} color={theme.red} />}>경고 누적</SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Input label="학번" value={warnForm.studentId} onChange={e => setWarnForm(p => ({ ...p, studentId: e.target.value }))} />
          <Input label="이름" value={warnForm.name} onChange={e => setWarnForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <Input label="사유 (선택)" value={warnForm.reason} onChange={e => setWarnForm(p => ({ ...p, reason: e.target.value }))} />
        <div style={{ marginTop: 12 }}>
          <Button size="sm" onClick={addWarning}>경고 추가</Button>
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        {Object.keys(warnings || {}).length === 0 ? (
          <Empty icon={<Icons.alert size={28} />} text="경고 대상이 없습니다" />
        ) : (
          Object.values(warnings).map((w) => (
            <div key={w.studentId} style={{ padding: "12px 18px", borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{w.name || "(이름 없음)"} <span style={{ color: theme.textMuted }}>({w.studentId})</span></div>
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: 4 }}>누적: {w.count}회 {w.reason ? `· ${w.reason}` : ""}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeWarning(w.studentId)}>삭제</Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <SectionTitle icon={<Icons.shield size={16} color={theme.red} />}>블랙리스트</SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Input label="학번" value={blkForm.studentId} onChange={e => setBlkForm(p => ({ ...p, studentId: e.target.value }))} />
          <Input label="이름" value={blkForm.name} onChange={e => setBlkForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <Input label="사유 (선택)" value={blkForm.reason} onChange={e => setBlkForm(p => ({ ...p, reason: e.target.value }))} />
        <div style={{ marginTop: 12 }}>
          <Button size="sm" variant="danger" onClick={addBlacklist}>블랙리스트 등록</Button>
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {Object.keys(blacklist || {}).length === 0 ? (
          <Empty icon={<Icons.shield size={28} />} text="블랙리스트가 없습니다" />
        ) : (
          Object.values(blacklist).map((b) => (
            <div key={b.studentId} style={{ padding: "12px 18px", borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name || "(이름 없음)"} <span style={{ color: theme.textMuted }}>({b.studentId})</span></div>
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: 4 }}>{b.reason || "사유 없음"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeBlacklist(b.studentId)}>해제</Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <div style={{ marginTop: 32 }} />
      <SectionTitle icon={<Icons.file size={16} color={theme.orange} />}>출력실 블랙리스트</SectionTitle>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 12 }}>
        출력실 블랙리스트에 등록된 학생은 로그인은 가능하지만 출력 접수 탭 이용이 제한됩니다.
      </div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <Input label="학번" value={pblkForm.studentId} onChange={e => setPblkForm(p => ({ ...p, studentId: e.target.value }))} />
          <Input label="이름" value={pblkForm.name} onChange={e => setPblkForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <Input label="사유 (선택)" value={pblkForm.reason} onChange={e => setPblkForm(p => ({ ...p, reason: e.target.value }))} />
        <div style={{ marginTop: 12 }}>
          <Button size="sm" variant="danger" onClick={addPrintBlacklist}>출력 블랙리스트 등록</Button>
        </div>
      </Card>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {Object.keys(printBlacklist || {}).length === 0 ? (
          <Empty icon={<Icons.file size={28} />} text="출력 블랙리스트가 없습니다" />
        ) : (
          Object.values(printBlacklist).map((b) => (
            <div key={b.studentId} style={{ padding: "12px 18px", borderBottom: `1px solid ${theme.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{b.name || "(이름 없음)"} <span style={{ color: theme.textMuted }}>({b.studentId})</span></div>
                  <div style={{ fontSize: 12, color: theme.textDim, marginTop: 4 }}>{b.reason || "사유 없음"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removePrintBlacklist(b.studentId)}>해제</Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
