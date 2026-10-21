// Shared site components.
//
// <site-header> replaces the header/nav markup that used to be duplicated on
// every page. It renders light DOM (no shadow root) so the existing site CSS
// (assets/mobile.css and each page's generated styles) keeps applying unchanged:
//   - the mobile hamburger bar (.mob-menu-bar, CSS-only checkbox toggle)
//   - the desktop horizontal menu, injected into the existing #comp-miy5tb8a
//     slot inside #SITE_HEADER so the Wix mesh positioning and menu styles match.
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

// ---- Desktop horizontal menu (rendered into #comp-miy5tb8a) -------------

const TOGGLE_ICON = `<svg width="0" height="0" viewBox="0 0 0 0" fill="black" xmlns="http://www.w3.org/2000/svg"><path d="M8 10.5L16 1.86193L14.7387 0.5L8 7.77613L1.26133 0.499999L-5.95321e-08 1.86193L8 10.5Z"></path></svg>`;

const desktopChild = ({ href, label }) => {
  const current = isCurrent(href);
  return `<li class="itemDepth12472627565__itemWrapper" data-testid="menuItemDepth1" data-item-depth="1" data-is-current="${current}" aria-current="${
    current ? "page" : "false"
  }"><div class="itemShared2352141355__rootContainer"><a data-item-label="true" data-testid="linkElement" href="${href}" target="_self" class="itemDepth12472627565__root${
    current ? " itemDepth12472627565--isCurrentPage" : ""
  } submenu815198092__menuItem itemShared2352141355__menuItem" tabindex="0"><div class="itemDepth12472627565__container"><span class="itemDepth12472627565__label">${label}</span></div></a></div></li>`;
};

const desktopItem = ({ href, label, children }) => {
  const current = isCurrent(href);
  return `<li class="itemDepth02233374943__itemWrapper siteui-horizontal-menu__item" data-testid="menuItemDepth0" data-item-depth="0" data-is-current="${current}" aria-current="${
    current ? "page" : "false"
  }"><div class="itemShared2352141355__rootContainer${
    children ? " itemShared2352141355--isRow" : ""
  }"><a data-item-label="true" data-testid="linkElement" href="${href}" target="_self" class="itemDepth02233374943__root${
    current ? " itemDepth02233374943--isCurrentPage" : ""
  } StylableHorizontalMenu3372578893__menuItem itemShared2352141355__menuItem"${
    children ? ' aria-expanded="false" aria-haspopup="true"' : ""
  } tabindex="0"><div class="itemDepth02233374943__container"><span class="itemDepth02233374943__label siteui-horizontal-menu__item-label">${label}</span></div></a>${
    children
      ? `<div class="itemShared2352141355__accessibilityIconWrapper itemShared2352141355--isTopLevel"><button tabindex="0" class="itemShared2352141355__accessibilityIcon" aria-label="Toggle ${label}">${TOGGLE_ICON}</button></div>`
      : ""
  }</div>${
    children
      ? `<div class="itemDepth02233374943__positionBox" role="group" aria-label="${label}" data-testid="positionBox"><div class="itemDepth02233374943__animationBox submenu815198092__root StylableHorizontalMenu3372578893__columnsLayout" style="--flyoutAlignment:var(--style-mj7kny6q-flyoutAlignment)"><div class="submenu815198092__pageWrapper submenu815198092__overrideWidth"><ul class="itemDepth02233374943__list">${children
          .map(desktopChild)
          .join("")}</ul></div></div></div>`
      : ""
  }</li>`;
};

const desktopNav = () =>
  `<nav class="StylableHorizontalMenu3372578893__root StylableHorizontalMenu3372578893---menuMode-4-wrap style-mj7kny6q__root siteui-horizontal-menu" aria-label="Site"><ul class="StylableHorizontalMenu3372578893__menu">${NAV.map(
    desktopItem
  ).join("")}</ul></nav>`;

// ---- Plain desktop menu (pages rebuilt without the Wix header) ------------

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

    const plain = this.hasAttribute("plain");
    this.innerHTML = mobileNav() + (plain ? plainDesktopNav() : "");

    // Fill the existing desktop menu slot if this page has one.
    if (!plain) {
      const slot = document.getElementById("comp-miy5tb8a");
      if (slot) slot.innerHTML = desktopNav();
    }
  }
}

if (!customElements.get("site-header")) {
  customElements.define("site-header", SiteHeader);
}

// ---- Footer -------------------------------------------------------------
//
// <site-footer> replaces the footer markup that used to be duplicated on every
// page. Like <site-header> it renders light DOM so the existing CSS keeps
// applying unchanged. The Wix-exported pages get the original #SITE_FOOTER
// structure; 404 (which has no #SITE_HEADER) gets its simpler .site-footer
// markup. Image paths are root-relative so they also resolve on 404.
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

// Markup used by the Wix-exported pages. Keep the id, classes and structure so
// the generated page CSS and the mobile CSS lay it out exactly as before.
const wixFooter = () =>
  `<footer id="SITE_FOOTER" class="MLzr0a SITE_FOOTER siteui-footer" tabindex="-1"><div class="uZIV9d"><div id="bgLayers_SITE_FOOTER" data-hook="bgLayers" data-motion-part="BG_LAYER SITE_FOOTER" class="QG9w8P XzOkCb"><div data-testid="colorUnderlay" class="LNYVZi ayCf9D"></div><div id="bgMedia_SITE_FOOTER" data-motion-part="BG_MEDIA SITE_FOOTER" class="ROWgFb"></div></div><div class="ncI7Xj"></div></div><div class="XKFSfx"><div data-mesh-id="SITE_FOOTERinlineContent" data-testid="inline-content" class=""><div data-mesh-id="SITE_FOOTERinlineContent-gridContainer" data-testid="mesh-container-content"><!--$--><div id="hyio5hbu" class="N8MGzv _v6ohL PO9MfV hyio5hbu siteui-rich-text" data-testid="richTextElement"><p class="font_9 color_12 siteui-rich-text__text" style="font-size:14px; line-height:normal; text-align:center;"><span class="color_36 siteui-rich-text__text"><span style="font-weight:bold;" class="siteui-rich-text__text"><span style="font-size:14px;" class="siteui-rich-text__text"><span style="letter-spacing:normal;" class="siteui-rich-text__text">${COPYRIGHT}</span></span></span></span></p></div><!--/$--><div class="footer-social" aria-label="Social links">${SOCIAL.map(
    (social) => socialLink(social, 30, "footer-social__link")
  ).join("")}</div><!--/$--></div></div></div></footer>`;

// Simpler markup used by 404.html.
const simpleFooter = () =>
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

    // The Wix-exported pages have #SITE_HEADER; 404 does not.
    this.innerHTML = document.getElementById("SITE_HEADER")
      ? wixFooter()
      : simpleFooter();
  }
}

if (!customElements.get("site-footer")) {
  customElements.define("site-footer", SiteFooter);
}
