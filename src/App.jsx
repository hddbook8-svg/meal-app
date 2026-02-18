import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://raxcndbcbuncpuiyelzc.supabase.co",
  "sb_publishable_5vV7cnciN-MRStJX9RTzBQ_bg7dRQVu"
);

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      setUser(data.user);
      loadProfile(data.user.id);
    }
  }

  async function loadProfile(uid) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    setProfile(data);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  if (!user) return <Login onLogin={init} />;
  if (!profile) return null;

  if (profile.role === "coach")
    return <CoachDashboard logout={logout} />;

  return <div>Only coach demo here</div>;
}

function Login({ onLogin }) {
  async function login(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    const { error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) return alert(error.message);
    onLogin();
  }

  return (
    <div style={{ padding: 40 }}>
      <form onSubmit={login}>
        <h2>Đăng nhập</h2>
        <input name="email" placeholder="Email" required />
        <br /><br />
        <input name="password" type="password" placeholder="Password" required />
        <br /><br />
        <button>Login</button>
      </form>
    </div>
  );
}

function CoachDashboard({ logout }) {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadReports(selectedDate);
  }, [selectedDate]);

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "athlete");

    setUsers(data || []);
  }

  async function loadReports(date) {
    const { data } = await supabase
      .from("meals")
      .select("*")
      .eq("date", date);

    setReports(data || []);
  }

  function getPublicUrl(path) {
    const { data } = supabase.storage
      .from("meal-photos")
      .getPublicUrl(path);

    return data.publicUrl + "?t=" + Date.now(); // phá cache
  }

  function exportExcel() {
    const data = users.map(u => {
      const userMeals = reports.filter(r => r.user_id === u.id);
      const hasLunch = userMeals.some(m => m.meal_type === "lunch");
      const hasDinner = userMeals.some(m => m.meal_type === "dinner");

      return {
        Tên: u.full_name,
        Email: u.email,
        Trưa: hasLunch ? "✔" : "✘",
        Tối: hasDinner ? "✔" : "✘"
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer]), `report-${selectedDate}.xlsx`);
  }

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>

      <h2>📊 Dashboard HLV</h2>

      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
        style={{ marginBottom: 15 }}
      />

      <button onClick={exportExcel}>📈 Xuất Excel</button>

      <div style={{ marginTop: 20 }}>
        {users.map((u) => {
  const userMeals = reports.filter(r => r.user_id === u.id);

  const hasLunch = userMeals.some(m => m.meal_type === "lunch");
  const hasDinner = userMeals.some(m => m.meal_type === "dinner");

  let rowColor = "#ffe5e5"; // đỏ - chưa chấm

  if (hasLunch && hasDinner) {
    rowColor = "#e8ffe8"; // xanh - đủ 2 bữa
  } else if (hasLunch || hasDinner) {
    rowColor = "#fff4cc"; // vàng - thiếu 1 bữa
  }

  return (
    <div
      key={u.id}
      style={{
        padding: 16,
        background: rowColor,
        borderRadius: 14,
        marginBottom: 12
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        {u.full_name}
      </div>

      {/* Thumbnail khu vực */}
      <div style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap"
      }}>
        {userMeals.map((m) => {
          const { data } = supabase.storage
            .from("meal-photos")
            .getPublicUrl(m.image_url);

          return (
            <div key={m.id} style={{ textAlign: "center" }}>
              <img
                src={data.publicUrl + "?t=" + Date.now()}
                alt="thumb"
                style={{
                  width: 90,
                  height: 90,
                  objectFit: "cover",
                  borderRadius: 10,
                  cursor: "pointer",
                  border: "2px solid white",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                }}
                onClick={() =>
                  setPreviewImage(
                    data.publicUrl + "?t=" + Date.now()
                  )
                }
              />
              <div style={{
                fontSize: 13,
                marginTop: 4,
                fontWeight: 500
              }}>
                {m.meal_type === "lunch" ? "Trưa" : "Tối"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})}
      </div>

      {previewImage && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            style={{ maxWidth: "90%", maxHeight: "90%" }}
            alt=""
          />
        </div>
      )}

      <button
        onClick={logout}
        style={{
          marginTop: 20,
          background: "#e53935",
          color: "white",
          padding: 10,
          borderRadius: 8
        }}
      >
        Logout
      </button>
    </div>
  );
}