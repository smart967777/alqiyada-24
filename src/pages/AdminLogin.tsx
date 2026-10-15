import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User, Loader2 } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/integrations/firebase/client";

const AdminLogin = () => {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    const email = username.includes("@") ? username.trim() : `${username.trim()}@alqiyada24.local`;
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      sessionStorage.setItem("alqiada24_admin", "true"); navigate("/admin/dashboard", { replace: true });
    } catch (e: any) {
      const message = e?.code === "auth/invalid-credential" || e?.code === "auth/user-not-found" ? "بيانات الدخول غير صحيحة" : "تعذر تسجيل الدخول. تحقق من إعداد Firebase.";
      setError(message);
    } finally { setLoading(false); }
  };
  return <div dir="rtl" className="min-h-screen flex items-center justify-center" style={{ background: "hsl(var(--admin-bg))" }}>
    <div className="admin-surface p-8 w-full max-w-md">
      <div className="text-center mb-8"><h1 className="text-2xl font-bold" style={{ color: "hsl(var(--admin-text))" }}>القيادة <span className="text-accent">24</span></h1><p className="text-sm mt-2" style={{ color: "hsl(var(--admin-text-muted))" }}>دخول لوحة التحكم عبر Firebase</p></div>
      <form onSubmit={handleLogin} className="space-y-4">
        <div><label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>اسم المستخدم</label><div className="relative"><User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" /><input required value={username} onChange={(e) => setUsername(e.target.value)} className="admin-input pr-10" placeholder="admin967" dir="ltr" /></div></div>
        <div><label className="block text-sm mb-1.5" style={{ color: "hsl(var(--admin-text-muted))" }}>كلمة المرور</label><div className="relative"><Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" /><input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="admin-input pr-10" placeholder="••••••••" dir="ltr" /></div></div>
        {error && <p className="text-sm text-urgent">{error}</p>}
        <button type="submit" disabled={loading} className="btn-admin-primary w-full flex items-center justify-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />}تسجيل الدخول</button>
      </form>
    </div>
  </div>;
};
export default AdminLogin;
