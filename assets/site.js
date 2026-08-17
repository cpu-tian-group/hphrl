(() => {
  const nav = document.querySelector(".mobile-nav");
  const active = nav?.querySelector(".active");
  if (nav && active) {
    const target = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
    nav.scrollLeft = Math.max(0, target);
  }

  // Keep the university link available on older cached HTML after a lightweight asset update.
  const universityLine = [...document.querySelectorAll(".footer-grid p")].find(
    (item) => item.textContent.trim() === "中国药科大学中药学院",
  );
  if (universityLine) {
    universityLine.innerHTML =
      '<a class="footer-university-link" href="https://www.cpu.edu.cn/" target="_blank" rel="noopener noreferrer" aria-label="访问中国药科大学官方网站">中国药科大学</a><span> · 中药学院</span>';
  }
})();
