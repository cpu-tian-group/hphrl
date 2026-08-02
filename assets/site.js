(() => {
  const nav = document.querySelector(".mobile-nav");
  const active = nav?.querySelector(".active");
  if (!nav || !active) return;

  const target = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
  nav.scrollLeft = Math.max(0, target);
})();
