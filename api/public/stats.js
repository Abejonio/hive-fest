// dashboard.js — gestión de sesión en el área privada
document.addEventListener("DOMContentLoaded", () => {
  const statusEl = document.querySelector(".status");   // <div id="status"></div>
  const logoutBtn = document.querySelector(".logoutBtn"); // <button id="logoutBtn">Logout</button>

  // 1) Comprobar si hay sesión
  async function checkSession() {
    try {
      const res = await fetch("/api/me", { 
        method: "GET",
        credentials: "include" 
      });
      if (!res.ok) throw new Error("not ok");
      const data = await res.json();

      if (data?.ok && data.profile) {
        document.querySelector('.favImage').src = data.profile.favCharacImage || "./assets/HiveFest.png";
        document.querySelector('.username').textContent = data.profile.username;
        let totalPrizes = Object.values(data.profile.collection).reduce((acc, num) => acc + num, 0);
        document.querySelector('.totalPrizes').textContent = `Total Prizes: ${totalPrizes.toLocaleString('en-US')}`;

        document.querySelector('.bigPrizes').textContent = data.profile.stats.bigPrizes.toLocaleString('en-US');
        document.querySelector('.greatPrizes').textContent = data.profile.stats.greatPrizes.toLocaleString('en-US');
        document.querySelector('.goodPrizes').textContent = data.profile.stats.goodPrizes.toLocaleString('en-US');
        document.querySelector('.played').textContent = data.profile.stats.played.toLocaleString('en-US');
        document.querySelector('.totalHoney').textContent = data.profile.stats.totalHoney.toLocaleString('en-US');
        document.querySelector('.honey').textContent = data.profile.honey.toLocaleString('en-US');
        document.querySelector('.totalCollection').textContent = Object.keys(data.profile.collection).length.toLocaleString('en-US');
      } else {
        window.location.href = "/login";
      }
    } catch {
      window.location.href = "/login";
    }
  }

  async function doLogout() {
    try {
      const res = await fetch("/api/logout", { 
        method: "POST",
        credentials: "include"
      });
      await res.json().catch(() => ({}));
    } catch {}
    window.location.href = "/login";
  }

  logoutBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    doLogout();
  });

  checkSession();

  setInterval(checkSession, 30_000);
});