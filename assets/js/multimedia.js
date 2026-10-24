// Multimedia galleries: previous/next buttons for the sideways-scrolling
// mosaics. The buttons start hidden, so without this script the galleries
// still scroll by trackpad, touch or keyboard. Each button shows only when
// there is more to scroll that way; on phones CSS hides them altogether.
(function () {
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.mm-gallery__box').forEach(function (box) {
    var viewport = box.querySelector('.mm-gallery__viewport');
    var prev = box.querySelector('.mm-gallery__btn--prev');
    var next = box.querySelector('.mm-gallery__btn--next');
    if (!viewport || !prev || !next) return;

    function update() {
      var end = viewport.scrollWidth - viewport.clientWidth;
      prev.hidden = viewport.scrollLeft <= 1;
      next.hidden = viewport.scrollLeft >= end - 1;
    }

    // Scroll most of a box-width, keeping a sliver of the last view in sight.
    function step(direction) {
      viewport.scrollBy({
        left: direction * viewport.clientWidth * 0.8,
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
      update();
    }

    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    viewport.addEventListener('scroll', update, { passive: true });
    viewport.addEventListener('scrollend', update);
    window.addEventListener('resize', update);
    update();
  });
})();
