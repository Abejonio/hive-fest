// signup.js — validación por longitud con mensajes rojos/verde y botón solo disabled por términos
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // Límites
  const USER_MIN = 2, USER_MAX = 20;
  const PASS_MIN = 3, PASS_MAX = 28;

  // Elementos esperados en el HTML:
  //  - <input id="username">
  //  - <input id="password" type="password">
  //  - <input id="acceptTerms" type="checkbox">
  //  - <button id="signupBtn">Sign up</button>
  //  (No hace falta #errorMsg; usaremos un único contenedor de mensajes)

  const usernameEl = $("username");
  const passwordEl = $("password");
  const acceptEl   = $("acceptTerms");
  const signupBtn  = $("signupBtn");

  // Contenedor de mensajes (rojo/verde). Si no existe, lo creamos.
  let msgBox = document.getElementById("errorMsg");
  if (!msgBox) {
    msgBox = document.createElement("div");
    msgBox.id = "errorMsg";
    msgBox.style.display = "none";           // oculto por defecto
    msgBox.style.whiteSpace = "pre-line";    // respeta \n
    // Intenta colocarlo justo encima del botón
    if (signupBtn?.parentNode) {
      signupBtn.parentNode.insertBefore(msgBox, signupBtn);
    } else {
      document.body.appendChild(msgBox);
    }
  }

  // Navegación opcional (ajusta si tus clases cambian)
  document.querySelector(".login")?.addEventListener("click", () => (window.location.href = "/login"));
  document.querySelector(".title")?.addEventListener("click", () => (window.location.href = "/"));

  // Estado: solo mostramos errores tras intentar enviar
  let submittedOnce = false;

  function setMsg(text, type) {
    // type: "error" (rojo) | "success" (verde) | "none"
    if (type === "none" || !text) {
      msgBox.style.display = "none";
      msgBox.textContent = "";
      return;
    }
    msgBox.textContent = text;
    msgBox.style.display = "block";
    if (type === "error") {
      msgBox.style.color = "#ef4444";   // rojo
    } else if (type === "success") {
      msgBox.style.color = "#16a34a";   // verde
    }
  }

  function collectLengthErrors(u, p) {
    const lines = [];
    if (u.length > USER_MAX) lines.push("Username length must be under 20");
    else if (u.length < USER_MIN) lines.push("Username length must be over 2");

    if (p.length > PASS_MAX) lines.push("Password length must be under 28");
    else if (p.length < PASS_MIN) lines.push("Password length must be over 3");
    return lines;
  }

  function updateButtonDisabled() {
    // Solo disabled si NO están aceptados los términos
    if (signupBtn) signupBtn.disabled = !(acceptEl && acceptEl.checked);
  }

  function maybeUpdateErrorsLive() {
    // Solo actualiza el bloque rojo si ya se intentó enviar al menos una vez
    if (!submittedOnce) return;
    const u = (usernameEl?.value || "").trim();
    const p = passwordEl?.value || "";
    const errs = collectLengthErrors(u, p);
    if (errs.length === 0) {
      setMsg("", "none"); // ya es correcto: ocultamos el bloque rojo
    } else {
      setMsg(errs.join("\n"), "error");
    }
  }

  // Eventos de inputs
  usernameEl?.addEventListener("input", () => {
    maybeUpdateErrorsLive();
  });
  passwordEl?.addEventListener("input", () => {
    maybeUpdateErrorsLive();
  });
  acceptEl?.addEventListener("change", updateButtonDisabled);

  // Inicializa estado del botón
  updateButtonDisabled();

  async function doSignup() {
    submittedOnce = true;

    const u = (usernameEl?.value || "").trim();
    const p = passwordEl?.value || "";

    // Muestra errores rojos SOLO al pulsar Sign up
    const errs = collectLengthErrors(u, p);
    if (errs.length > 0) {
      setMsg(errs.join("\n"), "error");
      return;
    } else {
      setMsg("", "none"); // oculto si todo OK antes de llamar a la API
    }

    // Llamada a la API
    if (signupBtn) signupBtn.disabled = true; // se reactivará en finally según checkbox
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      let data = null;
      try { data = await res.json(); } catch {}

      if (!res.ok || !data?.ok) {
        // Mensaje de error del servidor (rojo)
        setMsg((data?.message || "Unable to sign up."), "error");
        return;
      }

      // ÉXITO: mensaje verde con dos líneas
      setMsg("You have successfully created an account!\nGo to the login page to enter", "success");
    } catch (err) {
      console.error(err);
      setMsg("Network error. Please try again.", "error");
    } finally {
      // El botón queda disabled SOLO si terms no está marcado
      updateButtonDisabled();
    }
  }

  signupBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    // Si el botón está disabled por términos, no hacemos nada
    if (signupBtn.disabled) return;
    doSignup();
  });

  // Enter para enviar
  [usernameEl, passwordEl].forEach((el) =>
    el?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!signupBtn.disabled) doSignup();
      }
    })
  );
});

