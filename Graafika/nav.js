(function () {
  var names = [
    "Cursor Trail",
    "Magnetic Buttons",
    "Dynamic Background Gradient",
    "Click-to-Explode",
    "Scroll-Driven Scaling",
    "Toggle Themes with Sound",
    "Hover-Glitch Fall",
    "Shake to Clear",
    "Custom Cursor Shape",
    "Typing Ghost",
    "Sticker Slap",
    "Color Splash",
    "Dragging Physics",
    "Auto-Chaos Rotation",
    "Hover Filter Swap",
    "Text Shadow Follow",
    "Z-Index Shuffle",
    "Eraser Mode",
    "Key-Sound Piano",
    "Screen Edge Warp"
  ];

  var match = location.pathname.match(/(\d{2})\.html$/);
  if (!match) return;
  var current = Number(match[1]);
  if (!current || current < 1 || current > 20) return;

  var bar = document.createElement("nav");
  bar.className = "demo-nav";
  bar.setAttribute("aria-label", "Demo navigation");

  var top = document.createElement("div");
  top.className = "demo-nav-top";

  var home = document.createElement("a");
  home.href = "index.html";
  home.textContent = "Home";

  var prev = document.createElement("a");
  prev.href = ("0" + Math.max(1, current - 1)).slice(-2) + ".html";
  prev.textContent = "Prev";

  var next = document.createElement("a");
  next.href = ("0" + Math.min(20, current + 1)).slice(-2) + ".html";
  next.textContent = "Next";

  top.appendChild(home);
  top.appendChild(prev);
  top.appendChild(next);

  var list = document.createElement("div");
  list.className = "demo-nav-list";

  for (var i = 1; i <= 20; i += 1) {
    var item = document.createElement("a");
    var n = ("0" + i).slice(-2);
    item.href = n + ".html";
    item.textContent = n + " - " + names[i - 1];
    item.className = "demo-nav-item";
    if (i === current) {
      item.className += " active";
      item.setAttribute("aria-current", "page");
    }
    list.appendChild(item);
  }

  bar.appendChild(top);
  bar.appendChild(list);
  document.body.appendChild(bar);
})();