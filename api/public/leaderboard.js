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

  const lbSec = document.querySelector(".lbSec");
  const contentDiv = document.querySelector(".content");
  const titleEl = document.querySelector(".lbtitle, .newLbTitle");

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function formatNumber(x) {
    try { return new Intl.NumberFormat('en-US').format(x); } catch { return String(x); }
  }

  function clearEl(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function makeRow(rank, username, value, iconPath) {
    const div = document.createElement("div");
    div.className = "lbPlayer";
    div.innerHTML = `
      <div class="play1">
        <h1 class="top">${ordinal(rank)}</h1>
        <h1>${username ?? "Unknown"}</h1>
      </div>
      <div class="play2">
        <h1>${formatNumber(value)}</h1>
        <img src="${iconPath}" alt="icon">
      </div>
    `;
    return div;
  }

  function switchToSelectorMode() {
    const initSec = document.querySelector(".initSec");
    if (!initSec) return;
    initSec.classList.add("firstSec");
    initSec.classList.remove("initSec");

    const title = document.querySelector(".lbtitle");
    title.classList.add("newLbTitle");
    title.classList.remove("lbtitle");

    const lbs = document.querySelector(".lbs");
    lbs.classList.add("lbSelector");
    lbs.classList.remove("lbs");
    
    document.querySelectorAll(".init").forEach(el => {
      el.classList.add("new");
      el.classList.remove("init");
    });
  }

  function markSelected(btn) {
    const last = document.querySelector(".selectedNew");
    if (last) last.classList.remove("selectedNew");
    btn.classList.add("selectedNew");
  }

  async function loadLeaderboard(metric, displayTitle, btn) {
    switchToSelectorMode();
    if (titleEl) titleEl.innerHTML = `<h1 class="tr">${displayTitle} Leaderboard</h1>`;
    markSelected(btn);

    if (lbSec) lbSec.style.display = "flex";
    clearEl(lbSec);

    try {
      const res = await fetch(`/api/leaderboard?metric=${encodeURIComponent(metric)}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Error loading leaderboard");

      const list = Array.isArray(data.items) ? data.items : [];
      if (list.length === 0) {
        lbSec.appendChild(makeRow(1, "No data yet", 0));
      } else {
        let iconPath = "./assets/honey.png";
        if (metric === "totalhoney") iconPath = "./assets/totalHoneyIcon.png";
        else if (metric === "uniquehivees") iconPath = "./assets/unlockIcon.png";
        else if (metric === "totalhivees") iconPath = "./assets/totalHivees.png";

        list.forEach((it, i) => {
          lbSec.appendChild(makeRow(i + 1, it.username, it.value, iconPath));
        });

      }
      if (contentDiv) contentDiv.scrollTop = 0;
    } catch (err) {
      console.error(err);
      const row = document.createElement("div");
      row.className = "lbPlayer";
      row.innerHTML = `
        <div class="play1"><h1>Error</h1></div>
        <div class="play2"><h1>—</h1><img src="./assets/honey.png" alt="icon"></div>
      `;
      lbSec.appendChild(row);
    }
  }

  document.querySelectorAll(".lb").forEach(lb => {
    lb.addEventListener("click", () => {
      if (lb.classList.contains("honey")) {
        loadLeaderboard("honey", "Honey", lb);
      } else if (lb.classList.contains("totalHoney")) {
        loadLeaderboard("totalhoney", "Total Honey", lb);
      } else if (lb.classList.contains("hivees")) {
        loadLeaderboard("uniquehivees", "Unique Hivees", lb);
      } else if (lb.classList.contains("totalHivees")) {
        loadLeaderboard("totalhivees", "Total Hivees", lb);
      }
    });
  });
});
