import { useState } from "react";
import theme from "../constants/theme";
import Icons from "../components/Icons";
import { Button } from "../components/ui";
import AnimatedBorderButton from "../components/AnimatedBorderButton";

const Section = ({ title, children, accent }) => (
  <div style={{ marginBottom: 36 }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
      paddingBottom: 10, borderBottom: `1px solid ${theme.border}`,
    }}>
      <div style={{ width: 3, height: 18, background: accent || theme.accent, borderRadius: 2, flexShrink: 0 }} />
      <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, margin: 0 }}>{title}</h2>
    </div>
    {children}
  </div>
);

const StepCard = ({ num, title, desc, color }) => (
  <div style={{
    display: "flex", gap: 14, padding: "14px 16px",
    background: theme.card, border: `1px solid ${theme.border}`,
    borderRadius: theme.radius, alignItems: "flex-start",
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: "50%",
      background: color || theme.accent, color: "#fff",
      fontSize: 13, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{num}</div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>{desc}</div>
    </div>
  </div>
);

const FeatureRow = ({ icon, label, desc }) => (
  <div style={{
    display: "flex", gap: 14, padding: "14px 16px",
    background: theme.card, border: `1px solid ${theme.border}`,
    borderRadius: theme.radius, alignItems: "flex-start", marginBottom: 8,
  }}>
    <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{label}</div>
      <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 1.55 }}>{desc}</div>
    </div>
  </div>
);

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      border: `1px solid ${theme.border}`, borderRadius: theme.radiusSm,
      marginBottom: 8, overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: "100%", textAlign: "left", padding: "13px 16px",
          background: open ? theme.surface : theme.card,
          border: "none", cursor: "pointer", fontFamily: theme.font,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          color: theme.text, fontSize: 13, fontWeight: 600,
        }}
      >
        <span>Q. {q}</span>
        <span style={{ color: theme.textDim, fontSize: 16, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "none" }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "12px 16px 14px", background: theme.card, fontSize: 13, color: theme.textMuted, lineHeight: 1.7, borderTop: `1px solid ${theme.border}` }}>
          {a}
        </div>
      )}
    </div>
  );
};

const TAB_STUDENT = "student";
const TAB_WORKER = "worker";
const TAB_ADMIN = "admin";

export default function HelpPage({ onBack, isMobile, isDark, toggleDark }) {
  const [userTab, setUserTab] = useState(TAB_STUDENT);

  const tabs = [
    { id: TAB_STUDENT, label: "학생", color: theme.green },
    { id: TAB_WORKER, label: "근로학생", color: theme.blue },
    { id: TAB_ADMIN, label: "관리자", color: theme.accent },
  ];

  return (
    <>
      <div className="aurora-bg" />
      <div style={{ position: "fixed", inset: 0, zIndex: 0, background: isDark ? "rgba(26,27,30,0.7)" : "rgba(248,250,252,0.7)", pointerEvents: "none" }} />

      <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", zIndex: 1, paddingBottom: 60 }}>
        {/* Header */}
        <div style={{
          padding: "20px 0 16px", borderBottom: `1px solid ${theme.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, color: theme.accent, fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase" }}>국민대학교 건축대학</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>포털 이용 안내</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <AnimatedBorderButton radius={6}>
              <Button variant="ghost" size="sm" onClick={toggleDark}>{isDark ? <Icons.sun size={15} /> : <Icons.moon size={15} />}</Button>
            </AnimatedBorderButton>
            <Button variant="ghost" size="sm" onClick={onBack}><Icons.logout size={15} /> 돌아가기</Button>
          </div>
        </div>

        {/* Intro Banner */}
        <div style={{
          marginTop: 24, marginBottom: 24, padding: "20px 22px",
          background: theme.accentBg, border: `1px solid ${theme.accentBorder}`,
          borderRadius: theme.radius,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.accent, marginBottom: 6 }}>국민대학교 건축대학 포털사이트</div>
          <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.8 }}>
            실기실 예약, 물품 대여, 출력 신청, 안전교육 이수증 관리 등 건축대학 생활에 필요한 기능을 한 곳에서 이용할 수 있습니다.
            아래에서 역할을 선택하면 해당 이용 안내를 확인할 수 있습니다.
          </div>
        </div>

        {/* 역할 선택 탭 */}
        <div style={{
          display: "flex", gap: 6, padding: 4,
          background: theme.surface, borderRadius: theme.radius,
          marginBottom: 28,
        }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setUserTab(t.id)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 7, border: "none",
                cursor: "pointer", fontSize: 13, fontWeight: 700,
                fontFamily: theme.font, transition: "all 0.2s",
                background: userTab === t.id ? theme.card : "transparent",
                color: userTab === t.id ? t.color : theme.textMuted,
                boxShadow: userTab === t.id ? "0 1px 4px rgba(0,0,0,0.2)" : "none",
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* 학생 안내 */}
        {userTab === TAB_STUDENT && (
          <>
            <Section title="로그인 방법">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StepCard num={1} color={theme.green}
                  title="안전교육 이수증 업로드 (최초 1회)"
                  desc="로그인 화면에서 '이수증 업로드' 버튼을 눌러 학번, 이름, 학년, 전공, 이메일, 4자리 비밀번호 설정 후 안전교육 이수증 파일을 제출합니다. 관리자 승인 후 로그인이 가능합니다."
                />
                <StepCard num={2} color={theme.green}
                  title="로그인"
                  desc="학번과 이름을 입력하고, 이수증 업로드 시 설정한 4자리 숫자 비밀번호를 입력한 뒤 로그인 버튼을 누릅니다."
                />
                <div style={{
                  marginTop: 4, padding: "12px 16px",
                  background: theme.greenBg, border: `1px solid ${theme.greenBorder}`,
                  borderRadius: theme.radiusSm, fontSize: 12, color: theme.green,
                }}>
                  💡 로그인 화면 하단의 '로그인 기억' 체크박스를 선택하면 다음 접속 시 자동으로 로그인됩니다.
                </div>
              </div>
            </Section>

            <Section title="학생 포털 기능" accent={theme.green}>
              <FeatureRow icon="🏠" label="대시보드"
                desc="다가오는 실기실 예약, 현재 대여 중인 물품, 처리 대기 중인 출력 신청, 최근 이용내역, 미답변 문의를 한 화면에서 확인할 수 있습니다."
              />
              <FeatureRow icon="🚪" label="실기실 예약"
                desc="모형제작실, 3D프린팅, 캐드실, 레이저커팅실, 사진실 중 원하는 실기실과 날짜·시간대를 선택해 예약을 신청합니다. 예약 승인 여부는 대시보드에서 확인할 수 있습니다. 안전교육 이수자만 예약 가능합니다."
              />
              <FeatureRow icon="🔧" label="물품 대여"
                desc="전동 공구, 수공구, 계측 장비 등 다양한 물품을 대여 신청합니다. 물품별 재고 수량을 확인한 뒤 신청하며, 반납 시 반납 처리가 필요합니다. 안전교육 이수자만 대여 가능합니다."
              />
              <FeatureRow icon="🖨️" label="출력 신청"
                desc="Coated(평면/이미지), Matt, Gloss, 흑백, 컬러 등 출력 종류를 선택하고 파일 정보를 입력해 출력을 신청합니다. 근로학생이 처리 후 상태가 업데이트됩니다."
              />
              <FeatureRow icon="📋" label="내 이용내역"
                desc="실기실 예약 내역과 물품 대여 내역을 한눈에 볼 수 있습니다. 진행 중인 예약이나 대여는 취소할 수도 있습니다."
              />
              <FeatureRow icon="💬" label="문의 내역"
                desc="포털 내에서 문의를 작성하고, 근로학생이 답변한 내역을 확인할 수 있습니다. 미답변·답변완료 상태가 구분 표시됩니다."
              />
            </Section>
          </>
        )}

        {/* 근로학생 안내 */}
        {userTab === TAB_WORKER && (
          <>
            <Section title="로그인 방법">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StepCard num={1} color={theme.blue}
                  title="근로학생 탭 선택"
                  desc="로그인 화면 상단의 탭에서 '근로학생'을 선택합니다."
                />
                <StepCard num={2} color={theme.blue}
                  title="아이디 / 비밀번호 입력"
                  desc="관리자로부터 부여받은 근로학생 아이디와 비밀번호를 입력합니다. 계정 정보는 관리자에게 문의하세요."
                />
                <div style={{
                  marginTop: 4, padding: "12px 16px",
                  background: theme.blueBg, border: `1px solid ${theme.blueBorder}`,
                  borderRadius: theme.radiusSm, fontSize: 12, color: theme.blue,
                }}>
                  💡 근로학생 계정 관리(계정 추가·수정·삭제)는 관리자 포털에서 이루어집니다.
                </div>
              </div>
            </Section>

            <Section title="근로학생 포털 기능" accent={theme.blue}>
              <FeatureRow icon="📊" label="대시보드"
                desc="실기실 예약 현황, 물품 대여 현황, 알림 목록을 한눈에 확인합니다. 예약 승인·거절, 대여 상태 변경(수령 확인·반납 처리)을 이 화면에서 처리합니다."
              />
              <FeatureRow icon="🖨️" label="출력 관리"
                desc="학생들이 신청한 출력 요청 목록을 확인하고, 처리 중·완료 등 상태를 업데이트합니다. 완료된 출력물은 Google Drive에 아카이브할 수 있습니다."
              />
              <FeatureRow icon="💬" label="문의"
                desc="학생이 제출한 문의와 로그인 없이 접수된 문의를 모두 확인하고 답변합니다."
              />
              <FeatureRow icon="⚠️" label="경고 / 블랙리스트"
                desc="규정 위반 학생에게 경고를 부여하거나 블랙리스트에 등록합니다. 블랙리스트 학생은 포털 사용이 제한됩니다."
              />
              <FeatureRow icon="✏️" label="배너 관리"
                desc="로그인 화면의 환영 배너 제목과 부제목을 수정하고 미리 확인합니다."
              />
              <FeatureRow icon="📋" label="출력 안내 관리"
                desc="학생 포털에 표시되는 출력 입금 계좌, 운영시간, 수령장소와 안내 문구를 관리합니다."
              />
              <FeatureRow icon="📓" label="일지"
                desc="근무 중 발생한 사항을 일지로 기록합니다. 날짜별 로그가 자동 기록되며, 직접 메모를 추가할 수도 있습니다."
              />
            </Section>
          </>
        )}

        {/* 관리자 안내 */}
        {userTab === TAB_ADMIN && (
          <>
            <Section title="로그인 방법">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <StepCard num={1} color={theme.accent}
                  title="관리자 탭 선택"
                  desc="로그인 화면 상단의 탭에서 '관리자'를 선택합니다."
                />
                <StepCard num={2} color={theme.accent}
                  title="아이디 / 비밀번호 입력"
                  desc="관리자 아이디와 비밀번호를 입력합니다. 초기 계정 정보는 시스템 담당자에게 확인하세요."
                />
                <div style={{
                  marginTop: 4, padding: "12px 16px",
                  background: theme.accentBg, border: `1px solid ${theme.accentBorder}`,
                  borderRadius: theme.radiusSm, fontSize: 12, color: theme.accent,
                }}>
                  💡 관리자 계정 비밀번호는 코드 내 <code style={{ fontFamily: theme.fontMono, fontSize: 11 }}>data.js</code>의 <code style={{ fontFamily: theme.fontMono, fontSize: 11 }}>adminAccount</code> 항목에서 변경할 수 있습니다.
                </div>
              </div>
            </Section>

            <Section title="관리자 포털 기능" accent={theme.accent}>
              <FeatureRow icon="👥" label="근로학생 계정 관리"
                desc="근로학생 계정을 추가, 수정, 삭제합니다. 각 계정의 이름, 아이디, 비밀번호, 근무 시간대를 설정할 수 있습니다."
              />
              <FeatureRow icon="🔌" label="실기실 ON/OFF"
                desc="각 실기실을 일시적으로 닫을 수 있습니다. 공사, 청소 등으로 사용 불가한 경우 OFF로 설정하면 학생 예약이 차단됩니다."
              />
              <FeatureRow icon="📄" label="이수증 관리"
                desc="학생이 업로드한 안전교육 이수증을 검토하고 승인 또는 반려합니다. 승인된 학생만 실기실 예약과 물품 대여를 이용할 수 있습니다."
              />
              <FeatureRow icon="🛠️" label="물품 관리"
                desc="대여 가능한 물품 목록을 관리합니다. 물품 추가, 수량 수정, 비활성화 등을 처리할 수 있습니다."
              />
              <FeatureRow icon="📜" label="관리 이력"
                desc="예약 승인/거절, 대여 처리, 경고 부여 등 주요 관리 행위가 자동으로 기록됩니다."
              />
              <FeatureRow icon="⚙️" label="연동 설정"
                desc="Google Sheets 연동을 위한 웹훅 URL을 설정합니다. 예약 정보와 출력 요청이 구글 시트에 자동으로 동기화됩니다."
              />
            </Section>
          </>
        )}

        {/* FAQ */}
        <Section title="자주 묻는 질문 (FAQ)">
          <FaqItem
            q="안전교육 이수증을 업로드했는데 로그인이 안 돼요."
            a="이수증 업로드 후 관리자가 승인해야 로그인이 가능합니다. 관리자 포털 → '이수증 관리' 탭에서 승인 여부를 확인하세요. 승인 전까지는 로그인이 제한됩니다."
          />
          <FaqItem
            q="비밀번호를 잊어버렸어요."
            a="학생 비밀번호는 이수증 업로드 시 설정한 4자리 숫자입니다. 잊어버린 경우 관리자에게 문의하거나, 이수증을 다시 업로드해 새 비밀번호를 설정하세요."
          />
          <FaqItem
            q="실기실 예약을 신청했는데 승인이 안 됐어요."
            a="예약 신청 후 근로학생이 대시보드에서 승인을 처리해야 합니다. 승인되면 '대시보드' → '다가오는 예약'에서 확인할 수 있으며, 거절 시 거절됨으로 상태가 변경됩니다."
          />
          <FaqItem
            q="물품 대여 재고가 0인데 빌릴 수 있나요?"
            a="재고가 0이면 대여 신청이 불가합니다. 다른 학생의 반납을 기다리거나 근로학생에게 직접 문의하세요."
          />
          <FaqItem
            q="출력 신청은 얼마나 걸리나요?"
            a="출력 신청 후 근로학생이 처리 중 → 완료 순서로 상태를 업데이트합니다. 처리 시간은 근무 시간대와 대기 수량에 따라 다릅니다. '출력 신청' 탭에서 현재 상태를 확인하세요."
          />
          <FaqItem
            q="근로학생 계정 아이디/비밀번호를 모르겠어요."
            a="근로학생 계정 정보는 관리자 포털 → '근로학생 계정' 탭에서 확인하거나 변경할 수 있습니다. 관리자에게 문의하세요."
          />
          <FaqItem
            q="포털에 접속이 안 될 때는 어떻게 하나요?"
            a="인터넷 연결 상태를 먼저 확인하세요. 데이터가 로컬에 저장되어 있어 오프라인에서도 일부 기능은 사용 가능하지만, Supabase 연동 기능은 인터넷이 필요합니다. 지속적인 문제는 관리자에게 문의하세요."
          />
        </Section>

        {/* 문의 안내 */}
        <div style={{
          padding: "18px 22px",
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: theme.radius, textAlign: "center",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 6 }}>추가 문의</div>
          <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.8 }}>
            포털 이용 중 문제가 발생하면 로그인 화면의 '문의하기' 기능을 이용하거나<br />
            건축대학 교학팀에 직접 문의해주세요.
          </div>
        </div>
      </div>
    </>
  );
}
