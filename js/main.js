const CONTACT_EMAIL = "thaivanlam373@gmail.com";

// EmailJS (https://dashboard.emailjs.com) — the placeholders below are replaced with
// GitHub Secrets by .github/workflows/deploy.yml. Until then (e.g. locally), the forms
// fall back to opening the visitor's mail app.
const EMAILJS = {
  publicKey: "__EMAILJS_PUBLIC_KEY__",
  serviceId: "__EMAILJS_SERVICE_ID__",
  templateId: "__EMAILJS_TEMPLATE_ID__",
};

/* ---------- Nav: highlight the section in view ---------- */
const navLinks = document.querySelectorAll(".nav__link");
const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) =>
        link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id)
      );
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
navLinks.forEach((link) => {
  const section = document.querySelector(link.getAttribute("href"));
  if (section) sectionObserver.observe(section);
});

/* ---------- Carousels with dots ---------- */
function initCarousel(root, onChange) {
  const track = root.querySelector("[data-carousel-track]");
  const dotsEl = root.querySelector("[data-carousel-dots]");
  let slides = [];
  let active = 0;
  let lockUntil = 0;

  const setActive = (index) => {
    active = index;
    [...dotsEl.children].forEach((dot, i) => dot.classList.toggle("is-active", i === index));
    if (onChange && slides[index]) onChange(slides[index]);
  };

  const render = () => {
    slides = [...track.children].filter((slide) => !slide.hidden);
    dotsEl.innerHTML = "";
    slides.forEach((slide, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Go to item ${i + 1}`);
      dot.addEventListener("click", () => {
        lockUntil = Date.now() + 700;
        track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: "smooth" });
        setActive(i);
      });
      dotsEl.append(dot);
    });
    // hide dots when every slide already fits
    dotsEl.hidden = track.scrollWidth <= track.clientWidth + 1;
    track.scrollLeft = 0;
    setActive(0);
  };

  track.addEventListener(
    "scroll",
    () => {
      if (Date.now() < lockUntil) return;
      const x = track.scrollLeft + track.offsetLeft;
      let nearest = 0;
      slides.forEach((slide, i) => {
        if (Math.abs(slide.offsetLeft - x) < Math.abs(slides[nearest].offsetLeft - x)) nearest = i;
      });
      if (nearest !== active) setActive(nearest);
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    dotsEl.hidden = track.scrollWidth <= track.clientWidth + 1;
  });

  render();
  return { render };
}

/* ---------- Portfolio: filters + detail panel ---------- */
const detailTitle = document.querySelector("[data-detail-title]");
const detailText = document.querySelector("[data-detail-text]");
const detailLink = document.querySelector("[data-detail-link]");
const detailTags = document.querySelector("[data-detail-tags]");

function showProject(slide) {
  const info = slide.querySelector(".project__info");
  detailTitle.textContent = info.querySelector("h3").textContent;
  detailText.textContent = info.querySelector("p").textContent;
  detailTags.innerHTML = info.querySelector("ul").innerHTML;
  detailLink.href = slide.href;
}

document.querySelectorAll("[data-carousel]").forEach((root) => {
  if (!root.hasAttribute("data-portfolio")) {
    initCarousel(root);
    return;
  }

  const carousel = initCarousel(root, showProject);
  const chips = document.querySelectorAll(".chip");
  chips.forEach((chip) =>
    chip.addEventListener("click", () => {
      const filter = chip.dataset.filter;
      chips.forEach((c) => c.classList.toggle("is-active", c === chip));
      root.querySelectorAll(".project").forEach((project) => {
        project.hidden = filter !== "all" && !project.dataset.cat.split(" ").includes(filter);
      });
      carousel.render();
    })
  );
});

/* ---------- Soft skills: start with a card centered ---------- */
const softTrack = document.querySelector("[data-soft-track]");
if (softTrack && softTrack.children[1] && window.innerWidth > 900) {
  const card = softTrack.children[1];
  softTrack.scrollLeft = card.offsetLeft - (softTrack.clientWidth - card.offsetWidth) / 2;
}

/* ---------- Marquee: duplicate content for a seamless loop ---------- */
document.querySelectorAll(".marquee__track").forEach((track) => {
  track.innerHTML += track.innerHTML;
});

/* ---------- Email forms: send via EmailJS, else open the mail app ---------- */
const emailjsReady = window.emailjs && !Object.values(EMAILJS).some((v) => !v || v.startsWith("__EMAILJS_"));
if (emailjsReady) emailjs.init({ publicKey: EMAILJS.publicKey });

function openMailApp(email) {
  const subject = encodeURIComponent("Let's discuss an opportunity");
  const body = encodeURIComponent(`Hi Lâm,\n\nYou can reach me at ${email}.\n\n`);
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

document.querySelectorAll("[data-mail-form]").forEach((form) =>
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.elements.email;
    const button = form.querySelector("button");
    const email = input.value.trim();
    if (!emailjsReady) return openMailApp(email);

    button.disabled = true;
    try {
      await emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
        reply_to: email,
        from_email: email,
        page: location.href,
      });
      form.reset();
      input.placeholder = "Thanks! I'll get back to you soon.";
    } catch (error) {
      console.error("EmailJS failed, falling back to mailto", error);
      openMailApp(email);
    } finally {
      button.disabled = false;
    }
  })
);

document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = new Date().getFullYear();
});
