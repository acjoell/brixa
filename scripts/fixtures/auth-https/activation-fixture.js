const fragment = new URLSearchParams(location.hash.slice(1));
const token = fragment.get("token");
history.replaceState(null, "", location.pathname);

const form = document.querySelector("#activation");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = form.querySelector("input");
  window.activationResult = fetch("/api/auth/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
    body: JSON.stringify({ token, password: input.value }),
  }).then((response) => response.status);
  input.value = "";
});
form.dataset.ready = "";
