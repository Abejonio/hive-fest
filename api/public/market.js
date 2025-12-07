document.addEventListener("DOMContentLoaded", () => {
  async function checkSession() {
    try {
      const res = await fetch("/api/me", { method: "GET", credentials: "include" });
      if (!res.ok) throw new Error("not ok");
      const data = await res.json();
      if (!(data && data.ok && data.profile)) {
        window.location.href = "/login";
      }
    } catch (e) {
      window.location.href = "/login";
    }
  }
  checkSession();
  setInterval(checkSession, 30000);
})