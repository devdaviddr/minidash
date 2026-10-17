// Runs before first paint so a saved Light/Dark choice never flashes the wrong theme.
// Must stay a separate same-origin file: the container's CSP blocks inline scripts.
try {
  var t = localStorage.getItem('minidash.theme')
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t)
} catch {
  /* storage blocked: follow the system theme */
}
