# Live Comment Review Workflow

Paste this whole prompt into a Claude Code session opened on this repo
(`mrbuddha-simple-portfolio`) whenever you want to mark up the live page
with click-to-comment notes and have Claude implement them.

---

## Prompt to paste

I want to review my portfolio visually and leave comments directly on the
live page, then have you implement each comment as a code change. Set up
the "live comment review" workflow for this project:

1. **Serve the site properly** (not as a static file snapshot, so relative
   `css/` and `assets/` paths resolve). If `.claude/launch.json` doesn't
   already have a working static-server config, create one:

   ```json
   {
     "version": "0.0.1",
     "configurations": [
       {
         "name": "portfolio-static",
         "runtimeExecutable": "python",
         "runtimeArgs": ["-m", "http.server", "5173"],
         "port": 5173
       }
     ]
   }
   ```

   Then open it with the Browser tool: `preview_start` with
   `name: "portfolio-static"`.

2. **Inject the comment overlay** into the loaded page via the browser's
   JS execution tool. Use exactly this script (it's idempotent — safe to
   re-run, it no-ops if already installed):

   ```js
   (function(){
     if (window.__commentToolInstalled) { return 'already installed'; }
     window.__commentToolInstalled = true;

     var STORE_KEY = 'portfolioComments';
     function load(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch(e){ return []; } }
     function save(list){ localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
     var comments = load();

     function cssSelector(el){
       if (el.id) return '#' + el.id;
       var path = [];
       var node = el;
       while (node && node.nodeType === 1 && node !== document.body) {
         var sel = node.tagName.toLowerCase();
         if (node.className && typeof node.className === 'string' && node.className.trim()) {
           sel += '.' + node.className.trim().split(/\s+/).join('.');
         }
         var parent = node.parentNode;
         if (parent) {
           var siblings = Array.prototype.filter.call(parent.children, function(c){ return c.tagName === node.tagName; });
           if (siblings.length > 1) {
             var idx = Array.prototype.indexOf.call(parent.children, node) + 1;
             sel += ':nth-child(' + idx + ')';
           }
         }
         path.unshift(sel);
         node = parent;
       }
       return path.join(' > ');
     }

     var style = document.createElement('style');
     style.textContent = `
       .ct-toggle { position: fixed; bottom: 20px; right: 20px; z-index: 999999; background: #6d28d9; color: #fff;
         border: none; border-radius: 999px; padding: 12px 18px; font: 600 14px sans-serif; cursor: pointer;
         box-shadow: 0 4px 14px rgba(0,0,0,.3); }
       .ct-toggle.active { background: #dc2626; }
       .ct-hover-outline { outline: 2px dashed #6d28d9 !important; outline-offset: 2px !important; cursor: crosshair !important; }
       .ct-pin { position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #6d28d9; color: #fff;
         font: 700 12px/22px sans-serif; text-align: center; z-index: 999998; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,.4); }
       .ct-popup { position: absolute; z-index: 1000000; background: #1f2937; color: #fff; padding: 8px; border-radius: 8px;
         box-shadow: 0 6px 20px rgba(0,0,0,.4); width: 260px; font: 13px sans-serif; }
       .ct-popup textarea { width: 100%; box-sizing: border-box; border-radius: 4px; border: none; padding: 6px; font: 13px sans-serif; resize: vertical; min-height: 60px; }
       .ct-popup button { margin-top: 6px; margin-right: 6px; padding: 4px 10px; border: none; border-radius: 4px; cursor: pointer; font: 600 12px sans-serif; }
       .ct-save { background: #16a34a; color: #fff; }
       .ct-cancel { background: #4b5563; color: #fff; }
       .ct-panel { position: fixed; top: 0; right: 0; width: 300px; height: 100%; background: #111827; color: #fff;
         z-index: 999997; overflow-y: auto; padding: 12px; font: 13px sans-serif; box-shadow: -4px 0 14px rgba(0,0,0,.4); display: none; }
       .ct-panel.open { display: block; }
       .ct-panel h3 { margin: 0 0 10px; font-size: 15px; }
       .ct-item { background: #1f2937; border-radius: 6px; padding: 8px; margin-bottom: 8px; }
       .ct-item small { color: #9ca3af; display: block; margin-bottom: 4px; word-break: break-all; }
       .ct-item .ct-del { float: right; background: #7f1d1d; color: #fff; border: none; border-radius: 4px; cursor: pointer; padding: 2px 6px; font-size: 11px; }
       .ct-panel-toggle { position: fixed; bottom: 20px; right: 150px; z-index: 999999; background: #111827; color: #fff;
         border: none; border-radius: 999px; padding: 12px 18px; font: 600 14px sans-serif; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.3); }
     `;
     document.head.appendChild(style);

     var active = false;
     var toggleBtn = document.createElement('button');
     toggleBtn.className = 'ct-toggle';
     toggleBtn.textContent = '💬 Comment Mode: OFF';
     document.body.appendChild(toggleBtn);

     var panelBtn = document.createElement('button');
     panelBtn.className = 'ct-panel-toggle';
     panelBtn.textContent = '📋 Comments (' + comments.length + ')';
     document.body.appendChild(panelBtn);

     var panel = document.createElement('div');
     panel.className = 'ct-panel';
     document.body.appendChild(panel);

     function renderPanel(){
       panelBtn.textContent = '📋 Comments (' + comments.length + ')';
       panel.innerHTML = '<h3>Page Comments</h3>';
       if (!comments.length) {
         panel.innerHTML += '<div style="color:#9ca3af">No comments yet. Turn on Comment Mode and click an element.</div>';
       }
       comments.forEach(function(c, i){
         var item = document.createElement('div');
         item.className = 'ct-item';
         item.innerHTML = '<button class="ct-del" data-i="' + i + '">✕</button><small>#' + (i+1) + ' — ' + c.selector + '</small>' + c.text.replace(/</g,'&lt;');
         panel.appendChild(item);
       });
       panel.querySelectorAll('.ct-del').forEach(function(btn){
         btn.addEventListener('click', function(){
           var i = parseInt(btn.getAttribute('data-i'), 10);
           var pinEl = document.querySelector('.ct-pin[data-idx="' + comments[i].id + '"]');
           if (pinEl) pinEl.remove();
           comments.splice(i, 1);
           save(comments);
           renderPanel();
           renumberPins();
         });
       });
     }

     function renumberPins(){
       document.querySelectorAll('.ct-pin').forEach(function(p){ p.remove(); });
       comments.forEach(function(c, i){ placePin(c, i); });
     }

     function placePin(c, i){
       var pin = document.createElement('div');
       pin.className = 'ct-pin';
       pin.textContent = (i+1);
       pin.dataset.idx = c.id;
       pin.style.left = c.pageX + 'px';
       pin.style.top = c.pageY + 'px';
       pin.title = c.text;
       document.body.appendChild(pin);
     }

     comments.forEach(function(c, i){ placePin(c, i); });

     panelBtn.addEventListener('click', function(){ panel.classList.toggle('open'); renderPanel(); });

     var hoverEl = null;
     function onMouseOver(e){
       if (!active) return;
       if (hoverEl) hoverEl.classList.remove('ct-hover-outline');
       hoverEl = e.target;
       hoverEl.classList.add('ct-hover-outline');
     }
     function onMouseOut(e){
       if (e.target === hoverEl) { hoverEl.classList.remove('ct-hover-outline'); hoverEl = null; }
     }

     function onClick(e){
       if (!active) return;
       if (e.target.closest('.ct-toggle, .ct-panel, .ct-panel-toggle, .ct-popup, .ct-pin')) return;
       e.preventDefault();
       e.stopPropagation();
       var target = e.target;
       var selector = cssSelector(target);
       var pageX = e.pageX, pageY = e.pageY;

       var existingPopup = document.querySelector('.ct-popup');
       if (existingPopup) existingPopup.remove();

       var popup = document.createElement('div');
       popup.className = 'ct-popup';
       popup.style.left = Math.min(pageX, window.scrollX + window.innerWidth - 280) + 'px';
       popup.style.top = pageY + 'px';
       popup.innerHTML = '<div style="margin-bottom:4px;color:#9ca3af;">' + selector + '</div>' +
         '<textarea placeholder="What should change here?"></textarea><br/>' +
         '<button class="ct-save">Save</button><button class="ct-cancel">Cancel</button>';
       document.body.appendChild(popup);
       var textarea = popup.querySelector('textarea');
       textarea.focus();

       popup.querySelector('.ct-cancel').addEventListener('click', function(){ popup.remove(); });
       popup.querySelector('.ct-save').addEventListener('click', function(){
         var text = textarea.value.trim();
         if (!text) { popup.remove(); return; }
         var c = { id: Date.now() + Math.random(), selector: selector, text: text, pageX: pageX, pageY: pageY,
           tag: target.tagName.toLowerCase(), snippet: (target.textContent || '').trim().slice(0, 80) };
         comments.push(c);
         save(comments);
         placePin(c, comments.length - 1);
         renderPanel();
         popup.remove();
       });
     }

     document.addEventListener('mouseover', onMouseOver, true);
     document.addEventListener('mouseout', onMouseOut, true);
     document.addEventListener('click', onClick, true);

     toggleBtn.addEventListener('click', function(){
       active = !active;
       toggleBtn.classList.toggle('active', active);
       toggleBtn.textContent = '💬 Comment Mode: ' + (active ? 'ON' : 'OFF');
       if (!active && hoverEl) { hoverEl.classList.remove('ct-hover-outline'); hoverEl = null; }
     });

     window.__getPortfolioComments = function(){ return load(); };
     return 'installed, ' + comments.length + ' existing comments';
   })();
   ```

3. **Confirm to me** that Comment Mode is installed and tell me to go
   click around the page (toggle "💬 Comment Mode: ON", click an element,
   type a note, Save; "📋 Comments (N)" opens the running list).

4. **Wait for me to say "process the comments"** (or similar). When I do:
   - Retrieve the list by executing
     `JSON.parse(localStorage.getItem('portfolioComments') || '[]')`
     in the page.
   - For each comment, use its `selector`, `tag`, and `snippet` to find
     the matching markup in `index.html` (or the relevant file in `css/`)
     and make the requested change.
   - After implementing all comments, reload the page, re-inject the
     overlay, and run
     `localStorage.removeItem('portfolioComments')` plus a page reload
     so old pins don't linger, then take a screenshot to confirm the
     changes look right.
   - Summarize what was changed, comment by comment.

---

### Notes for future you (Claude)
- The overlay is pure client-side JS/CSS injected at runtime — it is
  **never** written into the project's actual source files. It only
  lives in the browser tab's DOM + localStorage for the session.
- If the dev server is already running (check `preview_list`), reuse it
  instead of starting a duplicate.
- If `python` isn't available, fall back to `npx http-server -p 5173`
  in the launch.json config.
