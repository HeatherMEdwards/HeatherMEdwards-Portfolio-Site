// Shared site components.
//
// <site-header> and <site-footer> hold the markup that used to be duplicated on
// every page. Both render light DOM (no shadow root) so the site CSS in
// assets/css/site.css applies directly:
//   - the mobile hamburger bar (.mob-menu-bar, CSS-only checkbox toggle)
//   - the plain desktop menu (.site-nav-wrap)
//
// The nav items live in one place (NAV) so links are managed once.

const NAV = [
  { href: "/", label: "About" },
  {
    href: "/multimedia.html",
    label: "Multimedia",
    children: [
      { href: "/graphic-design.html", label: "Graphic Design" },
      { href: "/photography.html", label: "Photography" },
    ],
  },
  { href: "/culture.html", label: "Culture" },
  { href: "/faith.html", label: "Faith" },
  { href: "/politics.html", label: "Politics" },
  { href: "/humanrights.html", label: "Human Rights" },
  { href: "/interviews.html", label: "Interviews" },
];

// Treat "/" and "/index.html" as the same page.
const currentPath = () => {
  const p = location.pathname;
  return p === "/index.html" || p === "" ? "/" : p;
};

const isCurrent = (href) => href === currentPath();

// ---- Mobile menu bar (CSS-only checkbox toggle) -------------------------

const mobileLink = ({ href, label }) =>
  `<a href="${href}"${isCurrent(href) ? ' aria-current="page"' : ""}>${label}</a>`;

const mobileNav = () =>
  `<div class="mob-menu-bar">
<input type="checkbox" id="mob-toggle" class="mob-toggle"/>
<label for="mob-toggle" class="mob-burger" aria-label="Menu"><span></span><span></span><span></span></label>
<nav class="mob-nav">
${NAV.map((item) =>
  item.children
    ? `<div class="mob-group">${mobileLink(item)}<div class="mob-sub">${item.children
        .map(mobileLink)
        .join("")}</div></div>`
    : mobileLink(item)
).join("\n")}
</nav>
</div>`;

// ---- Plain desktop menu --------------------------------------------------

const plainChild = ({ href, label }) =>
  `<li><a href="${href}"${isCurrent(href) ? ' aria-current="page"' : ""}>${label}</a></li>`;

const plainItem = ({ href, label, children }) =>
  `<li${children ? ' class="has-submenu"' : ""}><a href="${href}"${
    isCurrent(href) ? ' aria-current="page"' : ""
  }>${label}</a>${
    children
      ? `<ul class="site-nav__submenu">${children.map(plainChild).join("")}</ul>`
      : ""
  }</li>`;

const plainDesktopNav = () =>
  `<div class="site-nav-wrap"><nav class="site-nav" aria-label="Site"><ul>${NAV.map(
    plainItem
  ).join("")}</ul></nav></div>`;

class SiteHeader extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = "true";

    // Keep the bar a direct child of <body> so its sticky positioning still
    // spans the whole page (custom elements are inline by default).
    this.style.display = "contents";

    this.innerHTML = mobileNav() + plainDesktopNav();
  }
}

if (!customElements.get("site-header")) {
  customElements.define("site-header", SiteHeader);
}

// ---- Footer -------------------------------------------------------------
//
// <site-footer> renders the shared footer markup in light DOM so site.css
// applies directly. Image paths are root-relative so they resolve on every
// page, including 404.
//
// The social links live in one place (SOCIAL) so they are managed once.

const SOCIAL = [
  {
    href: "https://www.linkedin.com/in/heathermedwards/?lipi=urn%3Ali%3Apage%3Ad_flagship3_feed%3Bv42cjmHSQ1OVQy9Jp0Z%2Buw%3D%3D",
    label: "LinkedIn",
    icon: "linkedin-icon.png",
  },
  {
    href: "https://github.com/HeatherMEdwards",
    label: "GitHub",
    icon: "github-icon.png",
  },
  {
    href: "https://www.instagram.com/with.liberty/",
    label: "Instagram",
    icon: "instagram-icon.png",
  },
];

const COPYRIGHT = "All rights &copy; Heather M. Edwards";

const socialLink = ({ href, label, icon }, size, className) =>
  `<a${className ? ` class="${className}"` : ""} href="${href}" target="_blank" rel="noreferrer noopener"><img src="/assets/images/shared/${icon}" alt="${label}" width="${size}" height="${size}"/></a>`;

const footer = () =>
  `<footer class="site-footer"><p class="copyright"><strong>${COPYRIGHT}</strong></p><div class="footer-social" aria-label="Social links">${SOCIAL.map(
    (social) => socialLink(social, 20)
  ).join("")}</div></footer>`;

class SiteFooter extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = "true";

    // Custom elements are inline by default; let the injected <footer> behave
    // as if it were a direct child of the original container.
    this.style.display = "contents";

    this.innerHTML = footer();
  }
}

if (!customElements.get("site-footer")) {
  customElements.define("site-footer", SiteFooter);
}
