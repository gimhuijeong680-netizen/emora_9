// emora promo — onboarding, navigation, videos, scroll motion and section interactions.
// The page is the 1920px Figma canvas zoomed to the viewport (--z); everything below keeps to that.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (t) => 1 - (1 - t) ** 3;

// Runs on(el) when el enters the viewport and off(el) when it leaves
function whenVisible(el, on, off, { margin = "0px 0px -15% 0px", once = false } = {}) {
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { on(el); if (once) io.disconnect(); }
    else if (off) off(el);
  }, { rootMargin: margin });
  io.observe(el);
}

// ── Autoplay for the app prototypes (unchanged from the previous site) ──
// Runs a timed script while `root` is on screen and loops it. Each step is [delay after the previous
// step, fn]. A real tap pauses the demo for a while so it can still be explored by hand.
// Timers are always cleared before a (re)start, so loops never stack up.
function autoplay(root, script, { resumeAfter = 8000, margin = "0px 0px -15% 0px", onLeave, watch = root } = {}) {
  let timers = [], visible = false, resume = 0, pausedUntil = 0;
  const stop = () => { timers.forEach(clearTimeout); timers = []; };
  const run = () => {
    stop();
    if (!visible) return;
    let t = 0;
    script().forEach(([dt, fn]) => { t += dt; timers.push(setTimeout(fn, t)); });
    timers.push(setTimeout(run, t));
  };
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { visible = true; if (Date.now() >= pausedUntil) run(); }
    else { visible = false; stop(); onLeave?.(); }
  }, { rootMargin: margin });
  io.observe(watch);
  root.addEventListener("pointerdown", (e) => {
    if (!e.isTrusted) return;
    stop();
    clearTimeout(resume);
    pausedUntil = Date.now() + resumeAfter;
    resume = setTimeout(run, resumeAfter);
  }, true);
}
// A scripted tap: the pressed look first, then the control's own click handler on release
const tap = (el) => {
  el.classList.add("is-press");
  setTimeout(() => { el.classList.remove("is-press"); el.click(); }, 160);
};
const hold = () => {};

const toastEl = $(".toast");
let toastTimer = 0;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
}

// ── One scroll loop for every scroll-linked motion ──
// Each motion registers a frame function; the loop only runs while something asked for frames
// (a scroll, a resize, or a motion still easing toward its target), so idle pages cost nothing.
const frames = new Set();
let rafId = 0;
function loop() {
  rafId = 0;
  let again = false;
  frames.forEach((f) => { if (f()) again = true; });
  if (again) rafId = requestAnimationFrame(loop);
}
const kick = () => { if (!rafId) rafId = requestAnimationFrame(loop); };
addEventListener("scroll", kick, { passive: true });
addEventListener("resize", kick);

// ── Canvas fit ──
const root = document.documentElement;
const gnb = $("[data-gnb]");
let z = 1;
function fit() {
  z = root.clientWidth / 1920;
  root.style.setProperty("--z", z);
}
fit();
addEventListener("resize", fit);

// ── 0. Onboarding: a circle fills with the page's real loading, then opens onto the main video ──
// Progress = finished resources / resources needed for the first screen (non-lazy images, web fonts and
// the main video's first frame). The level may trail the real value to move evenly, never run ahead.
{
  const box = $("[data-loader]");
  const num = $("[data-loader-num]", box);
  const level = $(".loader__level", box);
  const orb = $(".loader__orb", box);
  // Always open onto the first screen, unless the address points at a section
  if ("scrollRestoration" in history && !location.hash) { history.scrollRestoration = "manual"; scrollTo(0, 0); }
  const imgs = $$("img").filter((img) => img.loading !== "lazy");
  const heroVid = $("[data-hero] video");
  const total = imgs.length + 1 + (heroVid ? 1 : 0); // + fonts + main video
  let done = 0, shown = 0, last = 0, finished = false;
  const settle = () => { done++; };
  imgs.forEach((img) => {
    if (img.complete) done++;
    else { img.addEventListener("load", settle, { once: true }); img.addEventListener("error", settle, { once: true }); }
  });
  document.fonts.ready.then(settle);
  if (heroVid) {
    if (heroVid.readyState >= 2) done++;
    else { heroVid.addEventListener("loadeddata", settle, { once: true }); heroVid.addEventListener("error", settle, { once: true }); }
  }

  const render = () => {
    const pct = Math.round(shown * 100);
    // Waterline: below the circle at 0, just above its top at 100 (the crest clears the rim)
    level.setAttribute("transform", `translate(0 ${(122 - shown * 125).toFixed(2)})`);
    num.textContent = String(pct).padStart(3, "0");
    box.setAttribute("aria-valuenow", pct);
  };
  // The veil opens from the disc's edge (32px) until it clears the farthest corner
  const open = () => {
    root.classList.add("is-ready", "is-open"); // scrolling is free; the main video settles in
    if (reduceMotion) { box.remove(); return; }
    const r0 = 32;
    const r1 = Math.hypot(innerWidth, innerHeight) / 2 + 2;
    const dur = 1150;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    box.classList.add("is-opening");
    let t0 = 0;
    const step = (now) => {
      t0 ||= now;
      const t = clamp((now - t0) / dur);
      const r = r0 + (r1 - r0) * ease(t);
      box.style.setProperty("--r", `${r.toFixed(1)}px`);
      // The mint disc grows with the opening and melts into the screen behind it
      orb.style.scale = String(r / r0);
      orb.style.opacity = String(1 - clamp(t / 0.35));
      if (t < 1) requestAnimationFrame(step);
      else box.remove();
    };
    requestAnimationFrame(step);
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    box.classList.add("is-full"); // number and outline step back
    setTimeout(open, reduceMotion ? 0 : 320);
  };
  const tick = (now) => {
    if (finished) return;
    const real = Math.min(1, done / total);
    const dt = last ? now - last : 16;
    last = now;
    // Even pace: at most a full rise per 800ms, and never past the real value
    shown = reduceMotion ? real : Math.min(real, shown + dt / 800);
    render();
    if (shown >= 1) { setTimeout(finish, reduceMotion ? 0 : 200); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // If something never reports back, don't hold the page: open without claiming 100
  setTimeout(finish, 10000);
}

// ── Navigation: smooth scroll clear of the bar; the section in view is marked ──
{
  const links = $$("[data-nav]", gnb).map((a) => ({ a, sec: $(a.getAttribute("href")) }));
  const navBottom = () => gnb.getBoundingClientRect().bottom;
  const goTo = (target) => {
    const y = target.id === "top" ? 0 : scrollY + target.getBoundingClientRect().top - navBottom();
    scrollTo({ top: Math.max(0, y), behavior: reduceMotion ? "auto" : "smooth" });
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const target = $(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    goTo(target);
  }));

  // Sections are not in menu order on the page (Design comes before Service), so pick by position
  const mark = () => {
    const line = navBottom() + innerHeight * 0.3;
    let cur = null, best = -Infinity;
    links.forEach((l) => { const t = l.sec.getBoundingClientRect().top; if (t <= line && t > best) { best = t; cur = l; } });
    links.forEach((l) => {
      l.a.classList.toggle("is-on", l === cur);
      l === cur ? l.a.setAttribute("aria-current", "true") : l.a.removeAttribute("aria-current");
    });
  };
  frames.add(() => { mark(); return false; });
  mark();
}

// ── Menu: opens while a mouse is over the pill, the gap or the list (one hover area); tap/click/keys elsewhere ──
{
  const m = $("[data-menu]");
  const btn = $("[data-menu-btn]", m);
  const items = $$(".gnb__list li", m);
  let closeT = 0, lastType = "mouse";
  const set = (open) => {
    clearTimeout(closeT);
    if (gnb.classList.contains("is-open") === open) return;
    gnb.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  };

  // Mouse: enter opens, leaving the whole area closes after a short grace (crossing a gap never closes it)
  m.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") set(true); });
  m.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    clearTimeout(closeT);
    closeT = setTimeout(() => set(false), 180);
  });

  // Touch and keyboard: the pill toggles. A mouse click only ever opens (hover already did), so they never fight
  m.addEventListener("pointerdown", (e) => { lastType = e.pointerType; }, true);
  btn.addEventListener("click", (e) => {
    const isMouse = e.detail > 0 && lastType === "mouse";
    set(isMouse ? true : !gnb.classList.contains("is-open"));
  });
  // Choosing an item: the existing smooth scroll handles the move; the menu folds away
  items.forEach((li) => li.firstElementChild.addEventListener("click", () => set(false)));
  document.addEventListener("pointerdown", (e) => { if (!m.contains(e.target)) set(false); });
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gnb.classList.contains("is-open")) { set(false); btn.focus(); }
  });
  m.addEventListener("focusout", (e) => { if (!m.contains(e.relatedTarget)) set(false); });
}

// ── Reveals: each element enters once, when it first comes into view ──
// Elements arriving in the same frame are staggered top-left first (70ms apart, at most ~0.5s),
// so a screenful of content flows in instead of popping all at once.
{
  const io = new IntersectionObserver((entries) => {
    const fresh = entries.filter((e) => e.isIntersecting);
    fresh.sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left));
    fresh.forEach((e, k) => {
      e.target.style.setProperty("--d", String(Math.min(k * 70, 490)));
      e.target.classList.add("in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  $$("[data-r]").forEach((el) => io.observe(el));
}

// ── Videos: muted inline loops that play only on screen, and start over each time you come back ──
{
  $$("[data-vid]").forEach((v) => {
    v.muted = true;
    v.defaultMuted = true;
    const ready = () => v.classList.add("is-ready");
    if (v.readyState >= 2) ready(); else v.addEventListener("loadeddata", ready, { once: true });
    if (reduceMotion) { v.removeAttribute("loop"); return; } // still frame only
    const box = v.closest(".vbox") ?? v;
    const isHero = box.hasAttribute("data-hero");
    const start = () => {
      // The main video waits for the onboarding to open onto it
      if (isHero && !root.classList.contains("is-open")) { setTimeout(start, 120); return; }
      try { v.currentTime = 0; } catch {}
      v.play().catch(() => {});
    };
    whenVisible(box, start, () => v.pause(), { margin: "0px 0px -10% 0px" });
  });
}

// ── Scroll Down cue: fades out as soon as the page moves, back when you return to the top ──
{
  const cue = $("[data-scrolldown]");
  let gone = false;
  frames.add(() => {
    const g = scrollY > 24;
    if (g !== gone) { gone = g; cue.classList.toggle("is-gone", g); }
    return false;
  });
}

// ── Overview video: comes in with the scroll — fade, a gentle scale, a short rise, corners easing square ──
// Progress is smoothed toward the scroll position each frame, so fast scrolls stay fluid and it settles in place.
{
  const box = $("[data-scrollin]");
  let shown = reduceMotion ? 1 : 0, on = false;
  const apply = (p) => {
    const e = easeOut(p);
    box.style.opacity = String(clamp(p * 1.6));
    box.style.transform = `translateY(${((1 - e) * 120).toFixed(1)}px) scale(${(0.9 + 0.1 * e).toFixed(4)})`;
    box.style.borderRadius = `${((1 - e) * 32).toFixed(1)}px`;
  };
  if (!reduceMotion) {
    apply(0);
    whenVisible(box, () => { on = true; kick(); }, () => { on = false; }, { margin: "20% 0px 20% 0px" });
    frames.add(() => {
      if (!on) return false;
      const r = box.getBoundingClientRect();
      // 0 when the top meets the bottom of the screen, 1 once it has risen 55% of the screen
      const target = clamp((innerHeight - r.top) / (innerHeight * 0.55));
      shown += (target - shown) * 0.12;
      if (Math.abs(target - shown) < 0.001) shown = target;
      apply(shown);
      return shown !== target;
    });
  }
}

// ── Archive: on arrival the phone and then the three windows float up like widgets, one by one, and stay ──
// A one-time entrance (delays in CSS); scrolling up or down afterwards never hides them again.
{
  const sec = $("[data-archive]");
  const phone = $("[data-arc-phone]", sec);
  if (reduceMotion) sec.classList.add("is-up");
  else {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      sec.classList.add("is-up");
      io.disconnect();
    }, { threshold: 0.3 });
    io.observe(phone);
  }
}

// ── Value image: a slight parallax inside its frame ──
if (!reduceMotion) {
  const box = $("[data-parallax]");
  let on = false;
  whenVisible(box, () => { on = true; kick(); }, () => { on = false; }, { margin: "0px" });
  frames.add(() => {
    if (!on) return false;
    const r = box.getBoundingClientRect();
    const t = clamp((innerHeight - r.top) / (innerHeight + r.height)); // 0 → 1 while it crosses the screen
    box.style.setProperty("--py", `${((t - 0.5) * -60).toFixed(1)}px`);
    return false;
  });
}

// ── Text ink: key copy starts pale and darkens word by word as it is scrolled through ──
// Only the glyph colour changes (light grey → the text's own colour); scrolling is never held.
if (!reduceMotion) {
  const blocks = $$("[data-ink]").map((el) => {
    const words = [];
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.data.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const w = document.createElement("span");
          w.className = "ink-w";
          w.textContent = part;
          words.push(w);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(el);
    return { el, words, on: false };
  });
  blocks.forEach((b) => whenVisible(b.el, () => { b.on = true; kick(); }, () => { b.on = false; }, { margin: "0px" }));
  frames.add(() => {
    blocks.forEach((b) => {
      if (!b.on) return;
      const r = b.el.getBoundingClientRect();
      // 0 when the block's top is at 85% of the screen, 1 when its bottom reaches 45%
      const p = clamp((innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.4));
      const n = b.words.length, head = p * (n + 3);
      // A soft three-word edge travels through the text in reading order
      b.words.forEach((w, i) => w.style.setProperty("--k", clamp((head - i) / 3).toFixed(3)));
    });
    return false;
  });
}

// ── Layer: each button shows its own layer card (image, number, title, text) ──
{
  const sec = $("[data-layer]");
  const tabs = $$(".layer__tab", sec);
  const cards = $$(".layer__card", sec);
  const texts = $$(".layer__text", sec);
  const dot = $(".layer__dot", sec);
  let cur = 0;
  const select = (k, focus = false) => {
    k = (k + tabs.length) % tabs.length;
    if (k === cur) return;
    const prev = cur;
    cur = k;
    tabs.forEach((t, j) => {
      const on = j === k;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    dot.style.top = `${parseFloat(tabs[k].style.top) + 20}px`;
    // The outgoing card lifts away while the new one rises into place
    cards[prev].classList.add("is-out");
    setTimeout(() => cards[prev].classList.remove("is-out"), 700);
    [cards, texts].forEach((list) => list.forEach((el, j) => {
      el.classList.toggle("is-on", j === k);
      el.toggleAttribute("aria-hidden", j !== k);
    }));
    $("#layer-panel").setAttribute("aria-labelledby", tabs[k].id);
    if (focus) tabs[k].focus();
  };
  tabs.forEach((t, k) => t.addEventListener("click", () => select(k)));
  sec.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step || !e.target.closest(".layer__tab")) return;
    e.preventDefault();
    select(cur + step, true);
  });
}

// ── App prototypes: Sensing answers and the Check intensity boxes (as on the previous site) ──
{
  // Sensing: one answer at a time. Demo: 맞아요 → (clear) → 다른 감정 느껴요 → (clear) …
  $$("[data-choice]").forEach((choice) => {
    const opts = $$(".sense-btn", choice);
    opts.forEach((b) => b.addEventListener("click", () => opts.forEach((o) => o.setAttribute("aria-pressed", String(o === b)))));
    const clearChoice = () => opts.forEach((o) => o.setAttribute("aria-pressed", "false"));
    autoplay(choice, () => [[700, () => tap(opts[0])], [2000, clearChoice], [700, () => tap(opts[1])], [2000, clearChoice], [400, hold]], { watch: choice.closest(".proto") });
  });

  // Intensity: boxes up to the chosen level fill in, the chip and counter follow
  const swap = (el, text) => {
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.add("is-swap");
    void el.offsetWidth;
    el.classList.remove("is-swap");
  };
  const intensity = $$("[data-intensity]").map((lv) => {
    const boxes = $$(".lv__box", lv);
    const chip = $("[data-lv-chip]", lv), count = $("[data-lv-count]", lv);
    let level = 0;
    const setLevel = (n, animate = true) => {
      const prev = level;
      level = n;
      boxes.forEach((b, i) => {
        const on = i < n;
        // Fill upward one box after another; when lowering, drain from the top down
        const fd = !animate ? 0 : on ? Math.max(0, i - prev) * 70 : Math.max(0, prev - 1 - i) * 70;
        b.style.setProperty("--fd", `${fd}ms`);
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(i === n - 1));
      });
      lv.classList.toggle("is-empty", n === 0);
      if (n) swap(chip, `${lv.dataset.emotion} ${n}`);
      swap(count, String(n));
    };
    boxes.forEach((b, i) => b.addEventListener("click", () => setLevel(i + 1)));
    setLevel(boxes.findIndex((b) => b.getAttribute("aria-checked") === "true") + 1, false);
    return { lv, boxes, setLevel };
  });

  // Big intensity panel demo: starts and ends on the designed level 2 (3 → 4 → 1 → 2)
  const big = intensity.find((x) => !x.lv.classList.contains("lv--sm"));
  autoplay(big.lv.closest(".proto"), () => [[1000, () => tap(big.boxes[2])], [550, () => tap(big.boxes[3])], [1700, () => tap(big.boxes[0])], [700, () => tap(big.boxes[1])], [2000, hold]]);

}

// ── Emotion colour: custom colour picker + the wheel opening out (as before) ──
{
  const panel = $("[data-colors]");
  const tints = $$("[data-tint]", panel);
  const sws = $$(".sw[data-c]", panel);
  const custom = $("[data-custom]", panel);
  // Selected chip gets a drawn check mark
  sws.forEach((sw) => {
    const mark = document.createElement("span");
    mark.className = "sw__check";
    mark.innerHTML = '<svg viewBox="0 0 26 26" aria-hidden="true"><path pathLength="1" d="M7 13.4l4.1 4 7.9-8.2" /></svg>';
    sw.append(mark);
  });
  // The left panel takes on the picked colour; two layers cross-fade so one colour dissolves into the next
  let front = 0;
  const pick = (c, btn) => {
    sws.forEach((b) => b.setAttribute("aria-checked", String(b === btn)));
    const next = tints[1 - front], prev = tints[front];
    next.style.backgroundImage = `linear-gradient(180deg, color-mix(in srgb, ${c} 55%, #fff), color-mix(in srgb, ${c} 18%, #fff))`;
    next.style.opacity = "1";
    prev.style.opacity = "0";
    front = 1 - front;
  };
  sws.forEach((b) => b.addEventListener("click", () => pick(b.dataset.c, b)));
  custom.addEventListener("input", () => pick(custom.value, null));
  // Demo (as before): 보라 → 주황 → 노랑 → 하늘
  const byName = (n) => sws.find((s) => s.getAttribute("aria-label") === n);
  autoplay(panel, () => ["보라", "주황", "노랑", "하늘"].map((n, i) => [i ? 1800 : 1200, () => tap(byName(n))]).concat([[1800, hold]]));
  $("[data-save]", panel).addEventListener("click", () => toast("나의 감정 색상이 저장됐어요"));
  whenVisible(panel, () => setTimeout(() => panel.classList.add("is-open"), 250), null, { once: true, margin: "0px 0px -25% 0px" });
}

// ── Core Value (feature selector): the content changes only when an item is clicked ──
{
  const box = $("[data-tabs]");
  const tabs = $$(".ft__tab", box);
  const panes = $$(".ft__pane", box);
  const caps = $$(".ft__caps p", box);
  const texts = $$(".ft__text", box);
  const count = $("[data-tab-count]", box);

  // Tab 2 (감정 회복, Figma 4075:6215): the two care cards rise in, one after the other, each time the tab opens
  const recover = $(".rc", box);
  // Tab 3 (감정 관리, Figma 4075:5993 → 4085:6811): tapping the record card moves to the next record — the
  // hours slide on by one (09–14 → 10–15) and the card swaps from 화 09:12 to 역겨움 10:23.
  const mg = $("[data-manage]", box);
  const slots = mg.dataset.slots.split(",").map(Number), labels = mg.dataset.labels.split(",").map(Number);
  const mgBars = $$(".mg__bar", mg), mgHours = $$(".mg__hr", mg);
  const mgCard = $("[data-mg-card]", mg), recs = $$(".mg__rec", mgCard);
  let mgState = 0;
  const mgShow = (s) => {
    mgState = s;
    // slot index (array index 0 = the slot just off the left edge): hour − first visible hour + 1
    const place = (el, list, prop) => {
      const k = Number(el.dataset.hr) - 9 - s + 1;
      el.style[prop] = `${list[Math.max(0, Math.min(list.length - 1, k))]}px`;
      el.style.opacity = k >= 1 && k <= 6 ? "1" : "0";
      el.style.setProperty("--k", String(Math.max(0, k - 1)));
    };
    mgBars.forEach((el) => place(el, slots, "left"));
    mgHours.forEach((el) => place(el, labels, "left"));
    recs.forEach((r, k) => r.classList.toggle("is-on", k === s));
    mgCard.setAttribute("aria-label", s ? "처음 기록 보기" : "다음 기록 보기");
  };
  mgShow(0);
  mgCard.addEventListener("click", () => mgShow(mgState ? 0 : 1));
  // While the tab is open and in view, the flow plays by itself (first record → tap → next record → back);
  // a real tap pauses it so it can be tried by hand
  autoplay(mg, () => (panes[cur].dataset.pane === "manage" ? [[1800, () => tap(mgCard)], [2800, () => mgShow(0)], [600, hold]] : [[1000, hold]]), { watch: box.querySelector(".ft__stage") });
  // Tab 1 (감정 확인, Figma 4085:6690): the watch's two answers — a tap moves the choice (mint glass) to that answer.
  // While the tab is open and in view the watch shows it by itself; a real tap pauses that.
  const watch = $("[data-watch]", box);
  const pills = $$(".wpill", watch);
  const choose = (k) => pills.forEach((p, j) => { p.classList.toggle("is-pick", j === k); p.setAttribute("aria-pressed", String(j === k)); });
  pills.forEach((p, k) => p.addEventListener("click", () => choose(k)));
  autoplay(watch, () => (panes[cur].dataset.pane === "check" ? [[1600, () => tap(pills[1])], [2000, () => tap(pills[0])], [1400, hold]] : [[1000, hold]]), { watch: box.querySelector(".ft__stage") });

  // Replay a pane's entrance: drop .is-in, let the hidden state apply, then add it back
  const enter = (el) => { el.classList.remove("is-in"); void el.offsetWidth; el.classList.add("is-in"); };
  let cur = 0;
  const select = (i, focus = false) => {
    const prev = cur;
    cur = (i + tabs.length) % tabs.length;
    tabs.forEach((t, k) => {
      const on = k === cur;
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    [panes, caps, texts].forEach((list) => list.forEach((el, k) => el.classList.toggle("is-on", k === cur)));
    count.textContent = `${cur + 1} / ${tabs.length}`;
    if (prev !== cur && panes[cur].dataset.pane === "recover") enter(recover);
    if (prev !== cur && panes[cur].dataset.pane === "manage") { mgShow(0); enter(mg); }
    if (focus) tabs[cur].focus();
  };
  // No timer: nothing changes until the visitor picks an item (click, or arrow keys on the list)
  tabs.forEach((t, k) => t.addEventListener("click", () => select(k)));
  box.addEventListener("keydown", (e) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!step || !e.target.closest(".ft__tab")) return;
    e.preventDefault();
    select(cur + step, true);
  });
}

// ── "Multiple Facets of Impulsivity": the lines are drawn with the scroll ──
// The impulsivity points come in first, each curve then draws from left to right (one after another), and the
// behaviour points light up as the curves reach them. Progress is smoothed toward the scroll position, so it
// never jumps on fast scrolls, and it follows the scroll both ways.
{
  const fig = $("[data-lines]");
  const parts = $$("[data-lines] > div > div"); // each curve / point is a box placed by its Figma inset
  const byLeft = (pct) => parts.filter((el) => (el.style.inset || "").trim().split(/\s+/)[3] === pct);
  const curves = byLeft("53.42%");
  const fromDots = byLeft("52.99%");
  const toDots = byLeft("88%");
  const fromLabel = $('[data-n="4069:4097"]'), toLabel = $('[data-n="4069:4096"]');
  let on = false, shown = reduceMotion ? 1 : 0;
  const apply = (p) => {
    fromDots.forEach((d, k) => { const t = easeOut(clamp((p - k * 0.025) / 0.12)); d.style.opacity = String(t); d.style.transform = `scale(${(0.5 + 0.5 * t).toFixed(3)})`; });
    if (fromLabel) fromLabel.style.opacity = String(clamp(p / 0.15));
    curves.forEach((c, k) => {
      const t = clamp((p - 0.1 - k * 0.03) / 0.55);
      c.style.clipPath = `inset(-20% ${((1 - t) * 100).toFixed(2)}% -20% 0)`;
    });
    toDots.forEach((d, k) => { const t = easeOut(clamp((p - 0.62 - k * 0.05) / 0.18)); d.style.opacity = String(0.15 + 0.85 * t); d.style.transform = `scale(${(0.6 + 0.4 * t).toFixed(3)})`; });
    if (toLabel) toLabel.style.opacity = String(clamp((p - 0.75) / 0.2));
  };
  if (fig && curves.length) {
    apply(shown);
    if (!reduceMotion) {
      const box = curves[0];
      whenVisible(box, () => { on = true; kick(); }, () => { on = false; }, { margin: "30% 0px 30% 0px" });
      frames.add(() => {
        if (!on) return false;
        const r = box.getBoundingClientRect();
        // 0 when the graphic is at 90% of the screen height, 1 once it has risen to 40%
        const target = clamp((innerHeight * 0.9 - r.top) / (innerHeight * 0.5));
        shown += (target - shown) * 0.1;
        if (Math.abs(target - shown) < 0.001) shown = target;
        apply(shown);
        return shown !== target;
      });
    }
  }
}

kick();
