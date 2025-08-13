// Rotates the gear SVG as the user scrolls
window.addEventListener("scroll", () => {
  const gears = document.querySelectorAll(".gear-rotate-on-scroll");
  gears.forEach((gear) => {
    const scrollY = window.scrollY || window.pageYOffset;
    const isReverse = gear.dataset.direction === "reverse";
    // Rotate up to 720deg for 2000px scroll, adjust as needed
    const maxRotation = 720;
    const maxScroll = 2000;
    const rotation = Math.min((scrollY / maxScroll) * maxRotation, maxRotation);
    gear.style.transform = `rotate(${isReverse ? -rotation : rotation}deg)`;
  });
});
