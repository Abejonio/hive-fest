// login.js — login sin validaciones de longitud visibles
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const usernameEl = $("username");
  const passwordEl = $("password");
  const loginBtn   = $("loginBtn");
  const errorMsg   = $("errorMsg");

  // Navegación opcional
  document.querySelector(".signUp")?.addEventListener("click", () => (window.location.href = "/signup"));
  document.querySelector(".title")?.addEventListener("click", () => (window.location.href = "/"));

  function setError(msg) {
    if (!errorMsg) return;
    errorMsg.textContent = msg || "";
    errorMsg.style.color = "#ef4444"; // rojo
  }

  function clearError() {
    if (errorMsg) errorMsg.textContent = "";
  }

  async function doLogin() {
    const u = usernameEl.value.trim();
    const p = passwordEl.value;

    if (!u || !p) {
      setError("Please enter username and password.");
      return;
    }

    loginBtn.disabled = true;
    clearError();

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setError(data?.message || "Invalid Credentials");
        return;
      }

      // Éxito → redirige al home/stats
      window.location.href = "/stats";
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      loginBtn.disabled = false;
    }
  }

  loginBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    doLogin();
  });

  // Enter también envía
  [usernameEl, passwordEl].forEach((el) =>
    el?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doLogin();
      }
    })
  );
});
