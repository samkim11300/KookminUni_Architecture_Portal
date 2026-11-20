import { useState } from "react";
import theme from "../constants/theme";
import Icons from "../components/Icons";
import { Card, Button, Input, SectionTitle } from "../components/ui";

export default function BannerManagement({ bannerText, updateBannerText, addLog, isMobile }) {
  // 배너 관리
  const [bannerTitle, setBannerTitle] = useState(bannerText?.title || "");
  const [bannerSubtitle, setBannerSubtitle] = useState(bannerText?.subtitle || "");
  const [bannerSaved, setBannerSaved] = useState(false);

  return (
    <div>
      <SectionTitle icon={<Icons.edit size={16} color={theme.accent} />}>홈페이지 환영 배너 수정</SectionTitle>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 16 }}>
        로그인 화면에 표시되는 환영 배너의 제목과 부제목을 수정할 수 있습니다.
      </div>
      <Card style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>배너 제목</div>
          <Input
            value={bannerTitle}
            onChange={e => { setBannerTitle(e.target.value); setBannerSaved(false); }}
            placeholder="예: 신입생분들 입학을 진심으로 환영합니다!"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 6 }}>배너 부제목</div>
          <Input
            value={bannerSubtitle}
            onChange={e => { setBannerSubtitle(e.target.value); setBannerSaved(false); }}
            placeholder="예: 함께 떠나봅시다! 🎉"
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button onClick={() => {
            updateBannerText({ title: bannerTitle, subtitle: bannerSubtitle });
            setBannerSaved(true);
            addLog("[근로학생] 배너 텍스트 수정", "admin");
          }}>저장</Button>
          <Button variant="ghost" onClick={() => {
            setBannerTitle(bannerText?.title || "");
            setBannerSubtitle(bannerText?.subtitle || "");
            setBannerSaved(false);
          }}>초기화</Button>
          {bannerSaved && <span style={{ fontSize: 12, color: theme.green, fontWeight: 600 }}>저장되었습니다</span>}
        </div>
      </Card>
      <Card style={{ marginTop: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, marginBottom: 12 }}>미리보기</div>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.2, background: "linear-gradient(135deg, #FF6B00 0%, #FF9A3C 60%, #FFD580 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            {bannerTitle || "제목을 입력하세요"}
          </div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, letterSpacing: "0.3px" }}>
            {bannerSubtitle || "부제목을 입력하세요"}
          </div>
        </div>
      </Card>
    </div>
  );
}
