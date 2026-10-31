/* ==========================================================================
   Bijou Gone — JavaScript du thème
   Menu mobile · Panier AJAX + tiroir · Carrousel hero · Variantes · Quantités
   ========================================================================== */

(function () {
  'use strict';

  var routes = (window.theme && window.theme.routes) || {};
  var strings = (window.theme && window.theme.strings) || {};
  var moneyFormat = (window.theme && window.theme.moneyFormat) || '{{amount}} FCFA';

  /* --------------------------------------------------------------- Devise -- */

  function formatMoney(cents) {
    var value = (cents || 0) / 100;

    function group(number, decimals, thousandsSep, decimalSep) {
      var fixed = Math.abs(number).toFixed(decimals);
      var parts = fixed.split('.');
      var integer = parts[0].replace(/(\d)(?=(\d{3})+$)/g, '$1' + thousandsSep);
      return parts[1] ? integer + decimalSep + parts[1] : integer;
    }

    return moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/, function (_match, name) {
      switch (name) {
        case 'amount': return group(value, 2, ',', '.');
        case 'amount_no_decimals': return group(value, 0, ',', '.');
        case 'amount_with_comma_separator': return group(value, 2, '.', ',');
        case 'amount_no_decimals_with_comma_separator': return group(value, 0, '.', ',');
        case 'amount_with_space_separator': return group(value, 2, ' ', ',');
        case 'amount_no_decimals_with_space_separator': return group(value, 0, ' ', '');
        case 'amount_with_apostrophe_separator': return group(value, 2, "'", '.');
        default: return group(value, 0, ' ', '');
      }
    });
  }

  /* ---------------------------------------------------------- Notification -- */

  var toastTimer;

  function toast(message) {
    var el = document.getElementById('theme-toast');
    if (!el) return;

    var label = el.querySelector('[data-toast-message]');
    if (label) label.textContent = message;

    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 3200);
  }

  /* --------------------------------------------------------------- Tiroirs -- */

  var openDrawer = null;

  function drawerOpen(id) {
    var el = document.getElementById(id);
    if (!el) return;

    if (openDrawer && openDrawer !== el) drawerClose(openDrawer);

    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    openDrawer = el;

    var focusable = el.querySelector('[data-drawer-close], a, button, input');
    if (focusable) focusable.focus();
  }

  function drawerClose(el) {
    el = el || openDrawer;
    if (!el) return;

    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (openDrawer === el) openDrawer = null;
  }

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-drawer-open]');
    if (opener) {
      event.preventDefault();
      drawerOpen(opener.getAttribute('data-drawer-open'));
      return;
    }

    if (event.target.closest('[data-drawer-close]') || event.target.matches('.drawer__overlay')) {
      event.preventDefault();
      drawerClose(event.target.closest('.drawer'));
      return;
    }

    // Un lien d'ancre ne recharge pas la page : il faut fermer le tiroir
    // nous-mêmes, sinon il resterait ouvert par-dessus la section visée.
    var lien = event.target.closest('.drawer a[href]');
    if (lien && lien.getAttribute('href').indexOf('#') !== -1) {
      drawerClose(lien.closest('.drawer'));
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && openDrawer) drawerClose(openDrawer);
  });

  /* ----------------------------------------------------------- Panier AJAX -- */

  /* Redimensionne une URL du CDN Shopify via le paramètre `width`. */
  function sizedImage(url, width) {
    if (!url) return '';
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'width=' + width;
  }

  function fetchJSON(url, options) {
    return fetch(url, options).then(function (response) {
      return response.json().then(function (data) {
        if (!response.ok) throw data;
        return data;
      });
    });
  }

  function updateCartCount(count) {
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count > 99 ? '99+' : count;
    });
  }

  function renderCartDrawer(cart) {
    var drawer = document.getElementById('cart-drawer');
    if (!drawer) return;

    var body = drawer.querySelector('[data-cart-drawer-body]');
    var footer = drawer.querySelector('[data-cart-drawer-footer]');
    var countLabel = drawer.querySelector('[data-cart-drawer-count]');
    var subtotal = drawer.querySelector('[data-cart-drawer-subtotal]');
    var emptyTpl = drawer.querySelector('[data-cart-empty-template]');

    if (countLabel) countLabel.textContent = cart.item_count;
    if (subtotal) subtotal.textContent = formatMoney(cart.items_subtotal_price);
    if (footer) footer.hidden = cart.item_count === 0;
    if (!body) return;

    if (cart.item_count === 0) {
      body.innerHTML = emptyTpl ? emptyTpl.innerHTML : '';
      return;
    }

    body.innerHTML = cart.items.map(function (item, index) {
      var image = item.image
        ? '<img src="' + sizedImage(item.image, 160) +
          '" alt="" width="80" height="80" loading="lazy">'
        : '';

      var variant = (item.variant_title && item.variant_title !== 'Default Title')
        ? '<p class="cart-item__variant">' + item.variant_title + '</p>'
        : '';

      return '' +
        '<div class="cart-item" data-cart-line="' + (index + 1) + '">' +
          '<a class="cart-item__media" href="' + item.url + '">' + image + '</a>' +
          '<div class="cart-item__body">' +
            (item.product_type ? '<span class="cart-item__vendor">' + item.product_type + '</span>' : '') +
            '<a class="cart-item__title" href="' + item.url + '">' + item.product_title + '</a>' +
            variant +
            '<p class="cart-item__unit">' + formatMoney(item.final_price) + '</p>' +
            '<div class="cart-item__controls">' +
              '<div class="qty qty--sm">' +
                '<button type="button" data-qty-step="-1" aria-label="' + (strings.decrease || 'Diminuer') + '">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>' +
                '</button>' +
                '<input type="number" min="0" value="' + item.quantity + '" data-cart-qty aria-label="' + (strings.quantity || 'Quantité') + '">' +
                '<button type="button" data-qty-step="1" aria-label="' + (strings.increase || 'Augmenter') + '">' +
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
                '</button>' +
              '</div>' +
              '<button type="button" class="cart-item__remove" data-cart-remove aria-label="' + (strings.remove || 'Supprimer') + '">' +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item__total">' + formatMoney(item.final_line_price) + '</div>' +
        '</div>';
    }).join('');
  }

  function refreshCart(options) {
    options = options || {};
    return fetchJSON(routes.cart_url ? routes.cart_url + '.js' : '/cart.js')
      .then(function (cart) {
        updateCartCount(cart.item_count);
        renderCartDrawer(cart);
        if (options.open) drawerOpen('cart-drawer');
        return cart;
      });
  }

  function addToCart(id, quantity, button) {
    if (button) button.classList.add('is-loading');

    return fetchJSON((routes.cart_add_url || '/cart/add') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: id, quantity: quantity || 1 })
    })
      .then(function () {
        // En mode « page panier » (apps de paiement à la livraison), on y mène
        // directement : le bouton de commande de l'app s'y trouve.
        if ((window.theme && window.theme.cartMode) === 'page') {
          window.location.href = routes.cart_url || '/cart';
          return null;
        }
        return refreshCart({ open: true });
      })
      .then(function (cart) {
        if (cart !== null) toast(strings.added || 'Ajouté au panier');
      })
      .catch(function (error) {
        toast((error && error.description) || strings.error || 'Une erreur est survenue');
      })
      .finally(function () {
        if (button) button.classList.remove('is-loading');
      });
  }

  function changeLine(line, quantity) {
    return fetchJSON((routes.cart_change_url || '/cart/change') + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity })
    }).then(function (cart) {
      updateCartCount(cart.item_count);
      renderCartDrawer(cart);

      // La page panier est rendue côté serveur : on la recharge pour les totaux.
      if (document.querySelector('[data-cart-page]')) window.location.reload();
      return cart;
    });
  }

  /* Ajout au panier depuis les cartes produit et la page produit */
  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-product-form]');
    if (!form) return;

    event.preventDefault();

    var idInput = form.querySelector('[name="id"]');
    var qtyInput = form.querySelector('[name="quantity"]');
    if (!idInput || !idInput.value) return;

    addToCart(idInput.value, qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1,
      form.querySelector('[type="submit"]'));
  });

  /* Quantités (page produit, panier, tiroir) */
  document.addEventListener('click', function (event) {
    var step = event.target.closest('[data-qty-step]');
    if (step) {
      var wrap = step.closest('.qty');
      var input = wrap && wrap.querySelector('input');
      if (!input) return;

      var min = parseInt(input.getAttribute('min'), 10);
      if (isNaN(min)) min = 1;

      var next = (parseInt(input.value, 10) || min) + parseInt(step.getAttribute('data-qty-step'), 10);
      input.value = Math.max(min, next);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    var remove = event.target.closest('[data-cart-remove]');
    if (remove) {
      event.preventDefault();
      var row = remove.closest('[data-cart-line]');
      if (row) changeLine(parseInt(row.getAttribute('data-cart-line'), 10), 0);
    }
  });

  document.addEventListener('change', function (event) {
    var input = event.target.closest('[data-cart-qty]');
    if (!input) return;

    var row = input.closest('[data-cart-line]');
    if (!row) return;

    changeLine(parseInt(row.getAttribute('data-cart-line'), 10), Math.max(0, parseInt(input.value, 10) || 0));
  });

  /* ------------------------------------------------------ Carrousel hero -- */

  document.querySelectorAll('[data-hero]').forEach(function (hero) {
    var slides = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-slide]'));
    var dots = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-dot]'));
    if (slides.length < 1) return;

    var index = 0;
    var autoplay = hero.getAttribute('data-hero-autoplay') === 'true';
    var interval = parseInt(hero.getAttribute('data-hero-interval'), 10) || 6000;
    var timer;

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === index);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
      });
    }

    function start() {
      if (!autoplay || slides.length < 2) return;
      stop();
      timer = setInterval(function () { show(index + 1); }, interval);
    }

    function stop() { if (timer) clearInterval(timer); }

    hero.querySelectorAll('[data-hero-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () { show(index - 1); start(); });
    });
    hero.querySelectorAll('[data-hero-next]').forEach(function (btn) {
      btn.addEventListener('click', function () { show(index + 1); start(); });
    });
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { show(i); start(); });
    });

    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);

    show(0);
    start();
  });

  /* ----------------------------------------------- Sélecteur de variantes -- */

  document.querySelectorAll('[data-variant-picker]').forEach(function (picker) {
    var root = picker.closest('[data-product-root]') || document;
    var dataEl = root.querySelector('[data-variants-json]');
    if (!dataEl) return;

    var variants;
    try { variants = JSON.parse(dataEl.textContent); } catch (e) { return; }

    var idInput = root.querySelector('[data-variant-id]');
    var priceEl = root.querySelector('[data-variant-price]');
    var submitEl = root.querySelector('[data-variant-submit]');
    var mediaEl = root.querySelector('[data-product-media] img');

    function selected() {
      return Array.prototype.map.call(
        picker.querySelectorAll('[data-option-index]'),
        function (group) {
          var active = group.querySelector('.is-active');
          return active ? active.getAttribute('data-option-value') : null;
        }
      );
    }

    function update() {
      var chosen = selected();

      var match = variants.filter(function (variant) {
        return chosen.every(function (value, i) {
          return value === null || variant.options[i] === value;
        });
      })[0];

      if (idInput) idInput.value = match ? match.id : '';

      if (priceEl && match) {
        var html = formatMoney(match.price);
        if (match.compare_at_price && match.compare_at_price > match.price) {
          html += ' <del>' + formatMoney(match.compare_at_price) + '</del>';
        }
        priceEl.innerHTML = html;
      }

      if (submitEl) {
        var available = match && match.available;
        submitEl.disabled = !available;
        var label = submitEl.querySelector('[data-submit-label]');
        if (label) {
          label.textContent = !match
            ? (strings.unavailable || 'Indisponible')
            : available
              ? (strings.add_to_cart || 'Ajouter au panier')
              : (strings.sold_out || 'Épuisé');
        }
      }

      if (mediaEl && match && match.featured_image) {
        mediaEl.src = match.featured_image;
        mediaEl.removeAttribute('srcset');
      }

      if (match && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('variant', match.id);
        window.history.replaceState({}, '', url.toString());
      }
    }

    picker.addEventListener('click', function (event) {
      var value = event.target.closest('[data-option-value]');
      if (!value) return;

      var group = value.closest('[data-option-index]');
      group.querySelectorAll('[data-option-value]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn === value);
        btn.setAttribute('aria-pressed', btn === value ? 'true' : 'false');
      });

      update();
    });

    update();
  });

  /* ------------------------------------------------ Galerie page produit -- */

  document.querySelectorAll('[data-product-thumbs]').forEach(function (thumbs) {
    var root = thumbs.closest('[data-product-root]') || document;
    var main = root.querySelector('[data-product-media] img');
    if (!main) return;

    thumbs.addEventListener('click', function (event) {
      var thumb = event.target.closest('[data-thumb-src]');
      if (!thumb) return;

      main.src = thumb.getAttribute('data-thumb-src');
      main.removeAttribute('srcset');

      thumbs.querySelectorAll('[data-thumb-src]').forEach(function (btn) {
        btn.classList.toggle('is-active', btn === thumb);
      });
    });
  });

  /* ------------------------------------------- Défilement bande galerie -- */

  document.querySelectorAll('[data-gallery-next]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var strip = btn.parentElement.querySelector('[data-gallery-strip]');
      if (!strip) return;

      var first = strip.querySelector('*');
      strip.scrollBy({ left: first ? first.offsetWidth + 12 : 180, behavior: 'smooth' });
    });
  });

  /* ------------------------------------------- « Voir plus » sur la grille -- */

  document.querySelectorAll('[data-load-more]').forEach(function (bouton) {
    var grille = document.querySelector(bouton.getAttribute('data-load-more'));
    if (!grille) return;

    var pas = parseInt(bouton.getAttribute('data-step'), 10) || 5;

    bouton.addEventListener('click', function () {
      var caches = grille.querySelectorAll('.product-grid__item[hidden]');
      Array.prototype.slice.call(caches, 0, pas).forEach(function (item) {
        item.removeAttribute('hidden');
      });

      if (grille.querySelectorAll('.product-grid__item[hidden]').length === 0) {
        bouton.hidden = true;
      }
    });
  });

  /* -------------------------------------------------------- Tri collection */

  document.querySelectorAll('[data-sort-select]').forEach(function (select) {
    select.addEventListener('change', function () {
      var url = new URL(window.location.href);
      url.searchParams.set('sort_by', select.value);
      url.searchParams.delete('page');
      window.location.href = url.toString();
    });
  });

  /* ------------------------------------------------------------- Init ----- */

  document.addEventListener('DOMContentLoaded', function () {
    refreshCart().catch(function () { /* panier indisponible : on ignore */ });
  });

  window.BijouGone = {
    formatMoney: formatMoney,
    addToCart: addToCart,
    refreshCart: refreshCart,
    toast: toast,
    drawerOpen: drawerOpen,
    drawerClose: drawerClose
  };
})();
