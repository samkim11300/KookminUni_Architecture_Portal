const ACTIVE_RENTAL_STATUSES = new Set(["pending_pickup", "ready"]);

function parseStoredValue(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

export function isOverdueRental(rental, today) {
  return Boolean(
    rental?.id &&
    ACTIVE_RENTAL_STATUSES.has(rental.status) &&
    !rental.returnedAt && !rental.cancelledAt && !rental.rejectedAt &&
    typeof rental.returnDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(rental.returnDate) &&
    rental.returnDate < today
  );
}

// 화면 state나 localStorage를 읽지 않는다. 서버 확인에 실패하면 발송을 건너뛴다.
export function createOverdueChecker({ readRentals, readFlags, writeFlags, notify, onError }) {
  let running = false;
  let disposed = false;
  const sentDates = {};

  return {
    dispose() { disposed = true; },
    async run(now = new Date()) {
      // 브라우저의 시간대와 관계없이 한국 시간 오전 9시대에만 실행한다.
      const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      if (disposed || running || koreaTime.getUTCHours() !== 9) return;
      const today = koreaTime.toISOString().slice(0, 10);
      running = true;
      try {
        const [rawRentals, rawFlags] = await Promise.all([readRentals(), readFlags()]);
        const rentals = parseStoredValue(rawRentals);
        const flags = parseStoredValue(rawFlags) ?? {};
        if (disposed || !Array.isArray(rentals)) return;
        if (typeof flags !== "object" || Array.isArray(flags)) return;

        for (const rental of rentals) {
          if (disposed) return;
          if (!isOverdueRental(rental, today)) continue;
          if (flags[rental.id] === today || sentDates[rental.id] === today) continue;

          // 앞선 이메일을 보내는 동안 다른 기기에서 반납/취소했을 수 있다.
          const latestRentals = parseStoredValue(await readRentals());
          if (disposed || !Array.isArray(latestRentals)) return;
          const latest = latestRentals.find(item => item?.id === rental.id);
          if (!isOverdueRental(latest, today)) continue;

          const result = await notify(latest);
          if (!result?.ok) continue;
          sentDates[rental.id] = today;
          // 저장 실패 시에도 같은 탭에서는 이번 실행의 발송 결과를 기억한다.
          const latestFlags = parseStoredValue(await readFlags()) ?? {};
          if (typeof latestFlags !== "object" || Array.isArray(latestFlags)) return;
          if (!await writeFlags({ ...latestFlags, [rental.id]: today })) {
            throw new Error("연체 알림 발송 기록 저장 실패");
          }
        }
      } catch (error) {
        onError?.(error);
      } finally {
        running = false;
      }
    },
  };
}
