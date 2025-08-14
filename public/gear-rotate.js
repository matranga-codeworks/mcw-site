// Rotates the gear SVG as the user scrolls, and slowly auto-rotates when idle
const gears = document.querySelectorAll(".gear-rotate-on-scroll");
let lastScrollY = window.scrollY || window.pageYOffset;
let lastRotation = 0;
let autoRotation = 0;
let lastTimestamp = null;

function updateGearRotation(rotation) {
  gears.forEach((gear) => {
    const isReverse = gear.dataset.direction === "reverse";
    gear.style.transform = `rotate(${isReverse ? -rotation : rotation}deg)`;
  });
}

function animate(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const scrollY = window.scrollY || window.pageYOffset;

  // If scrolling, rotate based on scroll position
  if (scrollY !== lastScrollY) {
    const maxRotation = 720;
    const maxScroll = 2000;
    lastRotation = Math.min((scrollY / maxScroll) * maxRotation, maxRotation);
    autoRotation = lastRotation; // Sync autoRotation to scroll-based rotation
    updateGearRotation(lastRotation);
    lastScrollY = scrollY;
  } else {
    // Not scrolling: slowly auto-rotate
    const delta = (timestamp - lastTimestamp) / 1000; // seconds
    const slowSpeed = 10; // degrees per second
    autoRotation += slowSpeed * delta;
    updateGearRotation(autoRotation);
    lastRotation = autoRotation;
  }

  lastTimestamp = timestamp;
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
