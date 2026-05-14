/**
 * Bee game: movement, collisions, pollination, sounds (click, errorse, rightse, winse).
 * Success label text is set in JS (Unicode escapes) to avoid mojibake if HTML encoding breaks.
 */
document.addEventListener("DOMContentLoaded", () => {
  const gameArea = document.getElementById("game-area");
  const bee = document.getElementById("obj-bee");
  const directionPad = document.getElementById("direction-pad");
  const berry = document.getElementById("obj-berry");
  const scallion = document.getElementById("obj-scallion");
  const dragonfly = document.getElementById("obj-dragonfly");
  const flowerPink = document.getElementById("obj-flower-pink");
  const flowerRed = document.getElementById("obj-flower-red");
  const okPink = document.getElementById("ok-flower-pink");
  const okRed = document.getElementById("ok-flower-red");
  const pollinationSuccess = document.getElementById("pollination-success");

  if (!gameArea || !bee || !directionPad) return;
  if (!berry || !scallion || !dragonfly) return;
  if (!flowerPink || !flowerRed || !okPink || !okRed || !pollinationSuccess) {
    return;
  }

  const baseMoveSpeed = 220;

  /** Success text via Unicode escapes (avoids HTML encoding issues). */
  pollinationSuccess.textContent = "\u6388\u7c89\u6210\u529f";
  let moveSpeed = baseMoveSpeed;

  let strawberryBoostUsed = false;
  let scallionPenaltyUsed = false;
  let dragonflyHazardArmed = false;

  let pinkPollinated = false;
  let redPollinated = false;

  let vx = 0;
  let vy = 0;

  let beeX = 0;
  let beeY = 0;

  let rafId = 0;
  let lastTs = 0;

  const keyToDir = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
  };

  const keyboardDir = {
    up: false,
    down: false,
    left: false,
    right: false,
  };

  const pointerIdToDir = new Map();

  /** ??? click ??????????????? */
  const MOVE_CLICK_INTERVAL_MS = 130;
  let lastMoveClickAt = 0;

  function playOneShot(src) {
    const a = new Audio(src);
    a.play().catch(() => {});
  }

  function tickMoveClickSound() {
    if (vx === 0 && vy === 0) return;
    const now = performance.now();
    if (now - lastMoveClickAt < MOVE_CLICK_INTERVAL_MS) return;
    lastMoveClickAt = now;
    playOneShot("click.mp3");
  }

  function clampBee() {
    const maxX = Math.max(0, gameArea.clientWidth - bee.offsetWidth);
    const maxY = Math.max(0, gameArea.clientHeight - bee.offsetHeight);
    beeX = Math.min(Math.max(0, beeX), maxX);
    beeY = Math.min(Math.max(0, beeY), maxY);
  }

  function applyBeePos() {
    bee.style.left = `${beeX}px`;
    bee.style.top = `${beeY}px`;
  }

  function setInitialBeePosition() {
    const margin = 4;
    beeX = margin;
    const h = bee.offsetHeight || 1;
    beeY = (gameArea.clientHeight - h) / 2;
    clampBee();
    applyBeePos();
  }

  function resetBeeToStart() {
    setInitialBeePosition();
    vx = 0;
    vy = 0;
    dragonflyHazardArmed = false;
    computeVelocity();
  }

  function rectInGameArea(el) {
    const er = el.getBoundingClientRect();
    const ar = gameArea.getBoundingClientRect();
    return {
      left: er.left - ar.left,
      top: er.top - ar.top,
      right: er.right - ar.left,
      bottom: er.bottom - ar.top,
    };
  }

  function beeRect() {
    return {
      left: beeX,
      top: beeY,
      right: beeX + bee.offsetWidth,
      bottom: beeY + bee.offsetHeight,
    };
  }

  function overlaps(a, b) {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  /** ?????? ok ???????? */
  function layoutOkAboveFlower(okEl, flowerEl) {
    const ar = gameArea.getBoundingClientRect();
    const fr = flowerEl.getBoundingClientRect();
    const gap = 6;
    const maxW = gameArea.clientWidth * 0.11;
    const nw = okEl.naturalWidth || 48;
    const nh = okEl.naturalHeight || 48;
    const w = Math.min(maxW, nw);
    const h = (w / nw) * nh;
    const cx = fr.left + fr.width / 2 - ar.left;
    const topY = fr.top - ar.top - h - gap;
    okEl.style.left = `${Math.round(cx - w / 2)}px`;
    okEl.style.top = `${Math.max(2, Math.round(topY))}px`;
    okEl.style.right = "auto";
    okEl.style.transform = "none";
  }

  function layoutFlowerOks() {
    layoutOkAboveFlower(okPink, flowerPink);
    layoutOkAboveFlower(okRed, flowerRed);
  }

  function tryShowPollinationSuccess() {
    if (!pinkPollinated || !redPollinated) return;
    if (!pollinationSuccess.hidden) return;
    pollinationSuccess.hidden = false;
    playOneShot("winse.mp3");
  }

  function resolveCollisions() {
    const b = beeRect();
    const dragon = rectInGameArea(dragonfly);
    const touchingDragon = overlaps(b, dragon);

    if (!dragonflyHazardArmed) {
      if (!touchingDragon) dragonflyHazardArmed = true;
    } else if (touchingDragon) {
      playOneShot("errorse.mp3");
      resetBeeToStart();
      return;
    }

    if (!pinkPollinated && overlaps(b, rectInGameArea(flowerPink))) {
      pinkPollinated = true;
      playOneShot("rightse.mp3");
      okPink.classList.add("is-visible");
      layoutOkAboveFlower(okPink, flowerPink);
      tryShowPollinationSuccess();
    }

    if (!redPollinated && overlaps(b, rectInGameArea(flowerRed))) {
      redPollinated = true;
      playOneShot("rightse.mp3");
      okRed.classList.add("is-visible");
      layoutOkAboveFlower(okRed, flowerRed);
      tryShowPollinationSuccess();
    }

    if (!strawberryBoostUsed && overlaps(b, rectInGameArea(berry))) {
      moveSpeed += 10;
      strawberryBoostUsed = true;
    }

    if (!scallionPenaltyUsed && overlaps(b, rectInGameArea(scallion))) {
      moveSpeed -= 5;
      scallionPenaltyUsed = true;
    }
  }

  function computeVelocity() {
    let left = keyboardDir.left;
    let right = keyboardDir.right;
    let up = keyboardDir.up;
    let down = keyboardDir.down;

    for (const d of pointerIdToDir.values()) {
      if (d === "left") left = true;
      if (d === "right") right = true;
      if (d === "up") up = true;
      if (d === "down") down = true;
    }

    vx = 0;
    vy = 0;

    if (left) vx += moveSpeed;
    if (right) vx -= moveSpeed;
    if (up) vy -= moveSpeed;
    if (down) vy += moveSpeed;
  }

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;

    computeVelocity();
    tickMoveClickSound();
    beeX += vx * dt;
    beeY += vy * dt;
    clampBee();
    applyBeePos();
    resolveCollisions();

    rafId = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (rafId) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function resetPollinationUi() {
    pinkPollinated = false;
    redPollinated = false;
    okPink.classList.remove("is-visible");
    okRed.classList.remove("is-visible");
    okPink.style.left = "";
    okPink.style.top = "";
    okPink.style.right = "";
    okPink.style.transform = "";
    okPink.style.width = "";
    okPink.style.height = "";
    okRed.style.left = "";
    okRed.style.top = "";
    okRed.style.right = "";
    okRed.style.transform = "";
    okRed.style.width = "";
    okRed.style.height = "";
    pollinationSuccess.hidden = true;
    layoutFlowerOks();
  }

  function boot() {
    moveSpeed = baseMoveSpeed;
    strawberryBoostUsed = false;
    scallionPenaltyUsed = false;
    dragonflyHazardArmed = false;
    resetPollinationUi();
    setInitialBeePosition();
    vx = 0;
    vy = 0;
    computeVelocity();
    startLoop();
  }

  window.addEventListener("keydown", (e) => {
    const dir = keyToDir[e.code];
    if (!dir) return;
    if (e.repeat) return;
    e.preventDefault();
    keyboardDir[dir] = true;
    computeVelocity();
  });

  window.addEventListener("keyup", (e) => {
    const dir = keyToDir[e.code];
    if (!dir) return;
    e.preventDefault();
    keyboardDir[dir] = false;
    computeVelocity();
  });

  window.addEventListener("blur", () => {
    keyboardDir.up = false;
    keyboardDir.down = false;
    keyboardDir.left = false;
    keyboardDir.right = false;
    computeVelocity();
  });

  directionPad.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button[data-dir]");
    if (!btn || !directionPad.contains(btn)) return;
    e.preventDefault();
    const dir = btn.dataset.dir;
    if (!dir) return;
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    pointerIdToDir.set(e.pointerId, dir);
    computeVelocity();
  });

  function clearPointer(e) {
    if (pointerIdToDir.has(e.pointerId)) {
      pointerIdToDir.delete(e.pointerId);
      computeVelocity();
    }
  }

  directionPad.addEventListener("pointerup", clearPointer);
  directionPad.addEventListener("pointercancel", clearPointer);

  const ro = new ResizeObserver(() => {
    clampBee();
    applyBeePos();
    layoutFlowerOks();
  });
  ro.observe(gameArea);

  if (document.readyState === "complete") {
    boot();
  } else {
    window.addEventListener("load", boot, { once: true });
  }
});
