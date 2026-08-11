/* Product gallery: thumbnail switching, prev/next, zoom, full-frame lightbox.
   Vanilla JS, no dependencies. Loaded only on the product page. */
(function () {
  var gallery = document.querySelector('[data-gallery]');
  if (!gallery) return;

  var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('[data-gthumb]'));
  var view = gallery.querySelector('[data-gview]');
  var lightbox = document.querySelector('[data-lightbox]');
  var lbView = lightbox ? lightbox.querySelector('[data-lbview]') : null;

  // Build the media list from the thumbnails, or fall back to the single
  // image already rendered in the stage.
  var items = thumbs.length
    ? thumbs.map(function (t) {
        return { type: t.getAttribute('data-type') || 'image',
                 url: t.getAttribute('data-url'),
                 alt: t.getAttribute('data-alt') || '' };
      })
    : (function () {
        var img = view && view.querySelector('img');
        return img ? [{ type: 'image', url: img.getAttribute('src'), alt: img.getAttribute('alt') || '' }] : [];
      })();

  var current = 0;
  var zoom = 1;
  var ZMIN = 1, ZMAX = 4, ZSTEP = 0.5;

  function render(target, index, withZoom) {
    var item = items[index];
    if (!item || !target) return;
    target.innerHTML = '';
    var el;
    if (item.type === 'embed') {
      el = document.createElement('iframe');
      el.src = item.url;
      el.title = item.alt || '';
      el.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      el.setAttribute('allowfullscreen', '');
    } else if (item.type === 'video') {
      el = document.createElement('video');
      el.src = item.url;
      el.controls = true;
      el.setAttribute('playsinline', '');
    } else {
      el = document.createElement('img');
      el.src = item.url;
      el.alt = item.alt;
      el.setAttribute('data-gimg', '');
      if (withZoom) el.style.transform = 'scale(' + zoom + ')';
    }
    target.appendChild(el);
  }

  function setActiveThumb(index) {
    thumbs.forEach(function (t, i) {
      t.classList.toggle('active', i === index);
    });
  }

  function show(index) {
    if (!items.length) return;
    current = (index + items.length) % items.length;
    zoom = 1;
    render(view, current, true);
    setActiveThumb(current);
    if (lightbox && !lightbox.hasAttribute('hidden')) render(lbView, current, true);
  }

  function applyZoom(where) {
    var img = where.querySelector('[data-gimg]');
    if (img) img.style.transform = 'scale(' + zoom + ')';
    where.classList.toggle('zoomed', zoom > 1);
  }

  function zoomBy(delta) {
    zoom = Math.min(ZMAX, Math.max(ZMIN, zoom + delta));
    var open = lightbox && !lightbox.hasAttribute('hidden');
    applyZoom(open ? lbView : view);
  }

  // Thumbnails
  thumbs.forEach(function (t, i) {
    t.addEventListener('click', function () { show(i); });
  });

  // Prev / next (buttons live in both the inline stage and the lightbox)
  document.querySelectorAll('[data-gprev]').forEach(function (b) {
    b.addEventListener('click', function () { show(current - 1); });
  });
  document.querySelectorAll('[data-gnext]').forEach(function (b) {
    b.addEventListener('click', function () { show(current + 1); });
  });

  // Zoom
  document.querySelectorAll('[data-gzoom]').forEach(function (b) {
    b.addEventListener('click', function () {
      zoomBy(b.getAttribute('data-gzoom') === 'in' ? ZSTEP : -ZSTEP);
    });
  });

  // Full-frame lightbox
  function openLightbox() {
    if (!lightbox) return;
    zoom = 1;
    render(lbView, current, true);
    lightbox.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    if (!lightbox) return;
    lightbox.setAttribute('hidden', '');
    document.body.style.overflow = '';
    zoom = 1;
    applyZoom(view);
  }

  var fullBtn = gallery.querySelector('[data-gfull]');
  if (fullBtn) fullBtn.addEventListener('click', openLightbox);
  // Clicking the inline image also opens full frame.
  if (view) view.addEventListener('click', function (e) {
    if (e.target.tagName === 'IMG') openLightbox();
  });

  if (lightbox) {
    var closeBtn = lightbox.querySelector('[data-lbclose]');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    // Click the dark backdrop (not the media) to close.
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener('keydown', function (e) {
    var open = lightbox && !lightbox.hasAttribute('hidden');
    if (e.key === 'Escape' && open) closeLightbox();
    else if (e.key === 'ArrowLeft') show(current - 1);
    else if (e.key === 'ArrowRight') show(current + 1);
  });
})();
