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
  const [meals, setMeals] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      setUser(data.user);
      await loadProfile(data.user.id);
    }
  }

  async function loadProfile(uid) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .single();

    if (!data) return;

    setProfile(data);

    if (data.role === "athlete") {
      loadMeals(uid);
    }
  }

  async function loadMeals(uid) {
    const today = getToday();
    const { data } = await supabase
      .from("meals")
      .select("*")
      .eq("user_id", uid)
      .eq("date", today);

    setMeals(data || []);
  }

  async function uploadMeal(type, file) {
    if (!file) return;

    const today = getToday();
    const hour = new Date().getHours();

    if (type === "lunch" && hour >= 17) {
      alert("Đã quá giờ chấm cơm trưa (17:00)");
      return;
    }
    if (type === "dinner" && hour >= 23) {
      alert("Đã quá giờ chấm cơm tối (23:00)");
      return;
    }

    const isLate = type === "lunch" ? hour > 13 : hour > 19;
    const filePath = `${user.id}/${today}-${type}.jpg`;

    await supabase.storage
      .from("meal-photos")
      .upload(filePath, file, { upsert: true });

    await supabase.from("meals").upsert(
      {
        user_id: user.id,
        full_name: profile.full_name,
        email: profile.email,
        date: today,
        meal_type: type,
        image_url: filePath,
        is_late: isLate,
      },
      { onConflict: "user_id,date,meal_type" }
    );

    loadMeals(user.id);
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setMeals([]);
  }

  if (!user) return <Login onLogin={init} />;
  if (!profile) return <div style={{ padding: 40 }}>Loading...</div>;

  if (profile.role === "coach")
    return <CoachDashboard profile={profile} logout={logout} />;

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: "auto" }}>
      <h2>🍱 Xin chào {profile.full_name}</h2>

      {["lunch", "dinner"].map((type) => {
        const done = meals.find((m) => m.meal_type === type);
        const label =
          type === "lunch" ? "Bữa trưa" : "Bữa tối";

        return (
          <div
            key={type}
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 12,
              marginBottom: 15,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              <span>{label}</span>
              <span>{done ? "✅" : "❌"}</span>
            </div>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) =>
                uploadMeal(type, e.target.files[0])
              }
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
              }}
            />

            {/* PATCH: HISTORY THUMBNAIL */}
            {done && (
              <img
                src={
                  supabase.storage
                    .from("meal-photos")
                    .getPublicUrl(done.image_url).data.publicUrl +
                  "?t=" +
                  Date.now()
                }
                style={{
                  width: 100,
                  height: 100,
                  objectFit: "cover",
                  borderRadius: 10,
                  marginTop: 10,
                  cursor: "pointer",
                }}
                onClick={() =>
                  setPreviewImage(
                    supabase.storage
                      .from("meal-photos")
                      .getPublicUrl(done.image_url).data.publicUrl +
                      "?t=" +
                      Date.now()
                  )
                }
              />
            )}
          </div>
        );
      })}

      {/* PATCH: FULLSCREEN PREVIEW */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            style={{ maxWidth: "90%", maxHeight: "90%" }}
          />
        </div>
      )}

      <button
        onClick={logout}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 10,
          border: "none",
          background: "#e53935",
          color: "white",
          fontWeight: 600,
        }}
      >
        Logout
      </button>
    </div>
  );
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
  // ⭐ MOBILE FIELD STYLE
const fieldStyle = {
  width: "100%",
  padding: "16px",
  borderRadius: 14,
  marginBottom: 14,
  fontSize: 16,
  boxSizing: "border-box",
};

  return (
    <div
  style={{
    minHeight: "100vh",
    background: "#f3f4f6",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  }}
>
      <form
        onSubmit={login}
        style={{
  background: "white",
  padding: 24,
  borderRadius: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
  width: "100%",
  maxWidth: 380,
}}
      >
        <h2
          style={{
            marginBottom: 20,
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          🍱 Đăng nhập
        </h2>

        <input
          name="email"
          placeholder="Email"
          required
          style={{
  ...fieldStyle,
  border: "1px solid #e5e7eb",
  background: "white",
}}
        />

        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          style={{
  ...fieldStyle,
  border: "1px solid #e5e7eb",
  background: "white",
}}
        />

        <button
          style={{
  ...fieldStyle,
  border: "none",
  background: "#4a90e2",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: 0,
}}
        >
          Login
        </button>
      </form>
    </div>
  );
}

function CoachDashboard({ profile, logout }) {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [fromDate, setFromDate] = useState(getToday());
  const [toDate, setToDate] = useState(getToday());
  const [previewImage, setPreviewImage] = useState(null); // ✅ chỉ 1 cái
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [creating, setCreating] = useState(false);
  // ⭐ CREATE USER FIELD STYLE
const fieldStyle = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  marginBottom: 10,
  fontSize: 15,
  boxSizing: "border-box",
};
  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
  loadReports();
}, [fromDate, toDate]);

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "athlete");
    setUsers(data || []);
  }
  // ===== CREATE USER =====
async function createUser() {
  if (!newName || !newEmail || !newPass) {
    alert("Nhập đủ thông tin");
    return;
  }

  try {
    setCreating(true);

    const res = await fetch(
      "https://raxcndbcbuncpuiyelzc.functions.supabase.co/admin-users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          email: newEmail,
          password: newPass,
          full_name: newName,
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Create failed");

    alert("Tạo user OK");

    setNewName("");
    setNewEmail("");
    setNewPass("");

    loadUsers();
  } catch (e) {
    alert(e.message);
  } finally {
    setCreating(false);
  }
}    

  async function loadReports() {
  const { data } = await supabase
    .from("meals")
    .select("*")
    .gte("date", fromDate)
    .lte("date", toDate);

  setReports(data || []);
}

  // ✅ FIX: getPublicUrl chuẩn
  function getPublicUrl(path) {
    const { data } = supabase.storage
      .from("meal-photos")
      .getPublicUrl(path);

    return data.publicUrl + "?t=" + Date.now();
  }

  function exportExcel() {
    const data = reports.map((r) => ({
      Tên: r.full_name,
      Email: r.email,
      Ngày: r.date,
      Bữa: r.meal_type === "lunch" ? "Trưa" : "Tối",
      Trễ: r.is_late ? "Có" : "Không",
      Ảnh: getPublicUrl(r.image_url), // ⭐ ADD
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    // ⭐ MAKE IMAGE COLUMN CLICKABLE
data.forEach((row, i) => {
  const cell = ws[`F${i + 2}`]; // cột F
  if (cell) {
    cell.l = { Target: row.Ảnh };
    cell.v = "Xem ảnh";
  }
});
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Báo cáo");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer]), `report-${selectedDate}.xlsx`);
  }

  const fullSubmitted = users.filter((u) => {
    const userMeals = reports.filter((r) => r.user_id === u.id);
    const hasLunch = userMeals.some((m) => m.meal_type === "lunch");
    const hasDinner = userMeals.some((m) => m.meal_type === "dinner");
    return hasLunch && hasDinner;
  }).length;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "auto" }}>
      <h2>📊 Dashboard HLV</h2>
      {/* ===== CREATE USER UI ===== */}
<div
  style={{
    background: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
  }}
>
  <h3>➕ Tạo VĐV</h3>

  <input
    placeholder="Full name"
    value={newName}
    onChange={(e) => setNewName(e.target.value)}
    style={{
  ...fieldStyle,
  border: "1px solid #e5e7eb",
  background: "white",
}}
  />

  <input
    placeholder="Email"
    value={newEmail}
    onChange={(e) => setNewEmail(e.target.value)}
    style={{
  ...fieldStyle,
  border: "1px solid #e5e7eb",
  background: "white",
}}
  />

  <input
    placeholder="Password"
    type="password"
    value={newPass}
    onChange={(e) => setNewPass(e.target.value)}
    style={{
  ...fieldStyle,
  border: "1px solid #e5e7eb",
  background: "white",
}}
  />

  <button
    onClick={createUser}
    style={{
  ...fieldStyle,
  border: "1px solid #e5e7eb",
  background: "white",
}}
  >
    {creating ? "Creating..." : "Create"}
  </button>
</div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
        <span>Đã đủ 2 bữa: {fullSubmitted}</span>
        <span>Chưa đủ: {users.length - fullSubmitted}</span>
      </div>

      {/* ⭐ DATE RANGE */}
<div style={{ display: "flex", gap: 10, marginBottom: 15, flexWrap: "wrap" }}>
  <input
    type="date"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
    style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
  />

  <input
    type="date"
    value={toDate}
    onChange={(e) => setToDate(e.target.value)}
    style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
  />
</div>

      <button onClick={exportExcel}>📈 Xuất Excel</button>

      {/* ===== LIST USER ===== */}
      <div style={{ marginTop: 20 }}>
        {users.map((u) => {
          const userMeals = reports.filter((r) => r.user_id === u.id);
          const hasLunch = userMeals.some((m) => m.meal_type === "lunch");
          const hasDinner = userMeals.some((m) => m.meal_type === "dinner");

          let bg = "#ffe5e5";
          if (hasLunch && hasDinner) bg = "#e8ffe8";
          else if (hasLunch || hasDinner) bg = "#fff4cc";

          return (
            <div
              key={u.id}
              style={{
                background: bg,
                padding: 12,
                borderRadius: 8,
                marginBottom: 8,
              }}
            >
              <strong>{u.full_name}</strong> –{" "}
              {userMeals.map((m) => (m.meal_type === "lunch" ? "Trưa" : "Tối")).join(", ")}

              {/* ✅ THUMBNAIL ZONE */}
<div
  style={{
    display: "flex",
    gap: 14,
    marginTop: 8,
    flexWrap: "wrap",
  }}
>
  {userMeals.map((m) => (
    <div
      key={m.id}
      style={{
        textAlign: "center",
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <img
        src={getPublicUrl(m.image_url)}
        alt=""
        style={{
          width: 70,
          height: 70,
          objectFit: "cover",
          borderRadius: 8,
          cursor: "pointer",
          border: "2px solid white",
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
        }}
        onClick={() =>
          setPreviewImage(getPublicUrl(m.image_url))
        }
      />

      {/* ✅ LABEL TRƯA / TỐI */}
      <div
  style={{
    marginTop: 4,
    lineHeight: 1.2,
    textAlign: "center",   // ⭐ thêm dòng này
    fontSize: 12,
  }}
>
  <div style={{ color: "#666" }}>{m.date}</div>
  <div style={{ fontWeight: 600 }}>
    {m.meal_type === "lunch" ? "Trưa" : "Tối"}
  </div>
</div>
    </div>
  ))}
</div>
            </div>
          );
        })}
      </div>

      {/* ✅ MODAL PREVIEW */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="" style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 12 }} />
        </div>
      )}

      <button
        onClick={logout}
        style={{
          marginTop: 20,
          width: "100%",
          padding: 12,
          background: "#e53935",
          color: "white",
          border: "none",
          borderRadius: 10,
        }}
      >
        Logout
      </button>
    </div>
  );
}