import { useEffect, useState, useMemo } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { Table } from "../components/Table";
import { useNavigate } from "react-router-dom";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const ADMIN_UID = "4IQNhyFFHTWQJnSVR4zXVYCqpo03";

export default function AdminLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const navigate = useNavigate();

  // 행별 드롭다운 선택값
  const [selectedEndpoints, setSelectedEndpoints] = useState<Record<number, string>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user || user.uid !== ADMIN_UID) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      const q = query(collection(db, "logs"), orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // endpoint 리스트
  const endpointList = useMemo(() => Array.from(new Set(logs.map((l) => l.endpoint))), [logs]);

  // 날짜+uid별로 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, { date: string; uid: string; endpoints: Record<string, number> }>();
    logs.forEach((log) => {
      const date = new Date(log.timestamp.seconds * 1000).toISOString().slice(0, 10);
      const key = `${date}_${log.uid}`;
      if (!map.has(key)) {
        map.set(key, { date, uid: log.uid, endpoints: {} });
      }
      const endpoints = map.get(key)!.endpoints;
      endpoints[log.endpoint] = (endpoints[log.endpoint] || 0) + (log.tokensUsed || 0);
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  // ======== 카드 요약 값 계산 ========
  // 오늘 날짜
  const todayStr = new Date().toISOString().slice(0, 10);

  // 이번 달, 저번 달 계산
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // 이번 달(YYYY-MM)
  const thisMonthStr = `${year}-${month.toString().padStart(2, "0")}`;
  // 저번 달(YYYY-MM)
  const lastMonth =
    month === 1
      ? { y: year - 1, m: 12 }
      : { y: year, m: month - 1 };
  const lastMonthStr = `${lastMonth.y}-${lastMonth.m.toString().padStart(2, "0")}`;

  // 오늘 토큰 합
  const tokensToday = logs
    .filter((l) => new Date(l.timestamp.seconds * 1000).toISOString().slice(0, 10) === todayStr)
    .reduce((a, b) => a + (b.tokensUsed || 0), 0);

  // 이번달 토큰 합
  const tokensThisMonth = logs
    .filter((l) =>
      new Date(l.timestamp.seconds * 1000)
        .toISOString()
        .slice(0, 7) === thisMonthStr
    )
    .reduce((a, b) => a + (b.tokensUsed || 0), 0);

  // 저번달 토큰 합
  const tokensLastMonth = logs
    .filter((l) =>
      new Date(l.timestamp.seconds * 1000)
        .toISOString()
        .slice(0, 7) === lastMonthStr
    )
    .reduce((a, b) => a + (b.tokensUsed || 0), 0);

  if (loading) return <p className="p-4 text-sm">불러오는 중...</p>;
  if (accessDenied) return <p className="p-4 text-red-500 text-sm">접근 권한이 없습니다.</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* ← 홈으로 돌아가기 버튼 + 제목 중앙정렬 */}
      <div className="relative mb-7 mt-4 h-14">
        <button
          onClick={() => navigate("/")}
          className={`
            absolute left-0 top-1/2 -translate-y-1/2
            px-4 py-4 rounded-2xl font-normal text-base border-none
            transition select-none text-white shadow-md
            bg-white/10 w-[68px]
          `}
          style={{ minWidth: 0, minHeight: 44 }}
        >
          ←
        </button>
        <h1 className="select-none text-4xl md:text-4xl font-base relative left-1/2 -translate-x-1/2 text-center w-fit mt-7">
          GPT 사용 로그
        </h1>
      </div>
      {/* 카드 3개: 저번달 | 오늘 | 이번달 */}
      <div className="flex flex-row gap-4 mb-4">
        <div className="flex-1 p-4 rounded-xl bg-white/10 shadow text-white text-sm font-normal select-none mb-0 text-center">
          <div className="text-xs text-gray-300">저번달 토큰</div>
          <div className="text-2xl font-bold mt-1">{tokensLastMonth.toLocaleString()}</div>
        </div>
        <div className="flex-1 p-4 rounded-xl bg-white/10 shadow text-white text-sm font-normal select-none mb-0 text-center">
          <div className="text-xs text-gray-300">오늘 토큰</div>
          <div className="text-2xl font-bold mt-1">{tokensToday.toLocaleString()}</div>
        </div>
        <div className="flex-1 p-4 rounded-xl bg-white/10 shadow text-white text-sm font-normal select-none mb-0 text-center">
          <div className="text-xs text-gray-300">이번달 토큰</div>
          <div className="text-2xl font-bold mt-1">{tokensThisMonth.toLocaleString()}</div>
        </div>
      </div>
      {/* 표 */}
      <Table>
        <thead>
          <tr className="bg-white/5">
            <th className="py-2 px-3 text-left text-sm font-thin select-none">Date</th>
            <th className="py-2 px-3 text-left text-sm font-thin select-none">UID</th>
            <th className="py-2 px-3 text-left text-sm font-thin select-none">Endpoint</th>
            <th className="py-2 px-3 text-right text-sm font-thin select-none">TokensUsed</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((row, idx) => (
            <tr key={row.date + row.uid} className="border-t border-white/10 hover:bg-white/10">
              <td className="py-1 px-3 text-left text-sm font-thin">{row.date}</td>
              <td className="py-1 px-3 font-thin text-left text-sm">{row.uid}</td>
              <td className="py-1 px-3 text-left text-base">
                <select
                  className="px-2 py-1 rounded font-thin bg-white/10 text-base"
                  style={{
                    color: "#fff",
                    border: "none",
                    outline: "none",
                  }}
                  value={selectedEndpoints[idx] || "ALL"}
                  onChange={e => setSelectedEndpoints(prev => ({
                    ...prev,
                    [idx]: e.target.value,
                  }))}
                >
                  <option value="ALL" style={{ color: "#3EE9CB", fontSize: "0.875rem", fontWeight: 100 }}>ALL</option>
                  {endpointList.map((ep) => (
                    <option
                      key={ep}
                      value={ep}
                      style={{
                        color: "#3EE9CB",
                        fontSize: "0.875rem",
                        fontWeight: 100,
                      }}
                    >
                      {ep}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-1 px-3 text-right text-sm">
                {
                  (!selectedEndpoints[idx] || selectedEndpoints[idx] === "ALL")
                    ? Object.values(row.endpoints).reduce((a, b) => a + b, 0)
                    : (row.endpoints[selectedEndpoints[idx]] ?? 0)
                }
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {grouped.length === 0 && (
        <div className="text-center text-gray-400 p-6 text-sm">결과 없음</div>
      )}
    </div>
  );
}
