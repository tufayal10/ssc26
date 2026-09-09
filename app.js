(function () {
  "use strict";

  // Row layout: [roll, name, reg, father, group, mother, session, passingYear, type, instIdx, centerIdx, gpa, subs[]]
  const ROLL = 0, NAME = 1, REG = 2, FATHER = 3, GROUP = 4, MOTHER = 5,
        SESSION = 6, PYEAR = 7, TYPE = 8, INST = 9, CENTER = 10, GPA = 11, SUBS = 12;

  const SUBJECT_LABELS = {
    "Bangla": "Bangla",
    "English": "English",
    "Mathematics": "Mathematics",
    "Science": "Science",
    "Islam & Moral Education": "Islam & Moral Education",
    "History Of Bangladesh & World Civilization": "History of Bangladesh & World Civilization",
    "Geography And Environment": "Geography & Environment",
    "Civics And Citizenship": "Civics & Citizenship",
    "Information & Communication Technology": "Information & Communication Technology",
    "Agriculture Studies": "Agriculture Studies",
    "Physical Education, Health & Sports (CA)": "Physical Education, Health & Sports (CA)",
    "Career Education (CA)": "Career Education (CA)",
    "Hindu Religion & Moral Education": "Hindu Religion & Moral Education",
    "Home Science": "Home Science"
  };

  let DATA = null;       // { insts, centers, subjOrder, rows }
  let filtered = [];      // current filtered+sorted row set
  let currentField = "all";
  let currentPage = 1;
  const PAGE_SIZE = 50;

  const el = (id) => document.getElementById(id);

  function fmtInt(n) { return n.toLocaleString("en-US"); }

  function resultLabel(gpa) {
    if (gpa === -1) return "FAIL";
    if (gpa === -2) return "ABSENT";
    if (gpa === -3) return "REPORTED";
    if (gpa === null || gpa === undefined) return "—";
    return "GPA " + gpa.toFixed(2);
  }

  function badgeFor(gpa) {
    if (gpa === -1) return '<span class="badge badge-fail">FAIL</span>';
    if (gpa === -2) return '<span class="badge badge-fail">ABSENT</span>';
    if (gpa === -3) return '<span class="badge badge-fail">REPORTED</span>';
    if (gpa === 5) return '<span class="badge badge-gold">GPA 5.00</span>';
    if (typeof gpa === "number") return '<span class="badge badge-pass">GPA ' + gpa.toFixed(2) + '</span>';
    return "—";
  }

  // ---------- Load data ----------

  function loadData() {
    const barFill = el("loading-bar-fill");
    fetch("jingkalala.json")
      .then((r) => {
        if (!r.ok) throw new Error("Network response was not ok");
        return r.json();
      })
      .then((json) => {
        DATA = json;
        initUI();
        el("loading-veil").style.display = "none";
      })
      .catch((err) => {
        el("loading-box").innerHTML =
          "<p style='color:#B5262F'>Could not load results.json</p>" +
          "<p style='font-size:0.8rem;color:#5B5646;max-width:320px'>Make sure results.json sits next to index.html and that you're viewing this over a local server (not double-clicking the file), since browsers block file:// data loads.</p>";
        console.error(err);
      });
  }

  // ---------- Init UI (dropdowns, listeners) ----------

  function initUI() {
    const total = DATA.rows.length;
    el("dataset-count").textContent = fmtInt(total) + " candidates on record";

    // Populate institute datalist
    const instList = el("institute-list");
    const instFrag = document.createDocumentFragment();
    DATA.insts.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      instFrag.appendChild(opt);
    });
    instList.appendChild(instFrag);

    // Populate center select (sorted)
    const centerSelect = el("f-center");
    const sortedCenters = DATA.centers
      .map((name, idx) => ({ name, idx }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const centerFrag = document.createDocumentFragment();
    sortedCenters.forEach(({ name, idx }) => {
      const opt = document.createElement("option");
      opt.value = String(idx);
      opt.textContent = name;
      centerFrag.appendChild(opt);
    });
    centerSelect.appendChild(centerFrag);

    // Populate session select
    const sessions = Array.from(new Set(DATA.rows.map((r) => r[SESSION]))).sort().reverse();
    const sessionSelect = el("f-session");
    sessions.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sessionSelect.appendChild(opt);
    });

    // Stats
    let passed = 0, gpa5 = 0, failed = 0;
    DATA.rows.forEach((r) => {
      const g = r[GPA];
      if (typeof g === "number" && g >= 1) passed++;
      if (g === 5) gpa5++;
      if (g === -1) failed++;
    });
    el("stat-total").textContent = fmtInt(total);
    el("stat-passed").textContent = fmtInt(passed);
    el("stat-gpa5").textContent = fmtInt(gpa5);
    el("stat-failed").textContent = fmtInt(failed);
    el("stat-rate").textContent = ((passed / total) * 100).toFixed(1) + "%";

    // Listeners
    el("search-input").addEventListener("input", debounce(onFilterChange, 150));
    el("search-clear").addEventListener("click", () => {
      el("search-input").value = "";
      onFilterChange();
    });
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        currentField = chip.dataset.field;
        onFilterChange();
      });
    });
    ["f-institute", "f-center", "f-gpa", "f-status", "f-session", "f-type", "sort-select"].forEach((id) => {
      el(id).addEventListener("input", onFilterChange);
      el(id).addEventListener("change", onFilterChange);
    });
    el("filters-reset").addEventListener("click", resetFilters);

    el("overlay").addEventListener("click", (e) => {
      if (e.target.id === "overlay" || e.target.id === "card-backdrop") closeCard();
    });
    el("card-close").addEventListener("click", closeCard);
    el("card-print").addEventListener("click", () => window.print());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCard();
    });

    applyFilters();
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function resetFilters() {
    el("search-input").value = "";
    el("f-institute").value = "";
    el("f-center").value = "";
    el("f-gpa").value = "";
    el("f-status").value = "";
    el("f-session").value = "";
    el("f-type").value = "";
    el("sort-select").value = "roll-asc";
    currentField = "all";
    document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    document.querySelector('.chip[data-field="all"]').classList.add("active");
    onFilterChange();
  }

  function onFilterChange() {
    currentPage = 1;
    applyFilters();
  }

  // ---------- Filtering ----------

  function gpaInRange(gpa, rangeStr) {
    if (typeof gpa !== "number" || gpa < 0) return false;
    if (rangeStr === "5.00") return gpa === 5;
    const [lo, hi] = rangeStr.split("-").map(Number);
    return gpa >= lo && gpa <= hi;
  }

  function applyFilters() {
    const q = el("search-input").value.trim().toLowerCase();
    const instQuery = el("f-institute").value.trim().toLowerCase();
    const centerVal = el("f-center").value;
    const gpaVal = el("f-gpa").value;
    const statusVal = el("f-status").value;
    const sessionVal = el("f-session").value;
    const typeVal = el("f-type").value;

    let rows = DATA.rows;

    if (q) {
      rows = rows.filter((r) => matchesQuery(r, q, currentField));
    }
    if (instQuery) {
      rows = rows.filter((r) => DATA.insts[r[INST]].toLowerCase().includes(instQuery));
    }
    if (centerVal !== "") {
      const idx = Number(centerVal);
      rows = rows.filter((r) => r[CENTER] === idx);
    }
    if (gpaVal) {
      rows = rows.filter((r) => gpaInRange(r[GPA], gpaVal));
    }
    if (statusVal) {
      rows = rows.filter((r) => {
        const g = r[GPA];
        if (statusVal === "pass") return typeof g === "number" && g >= 1;
        if (statusVal === "fail") return g === -1;
        if (statusVal === "absent") return g === -2;
        if (statusVal === "reported") return g === -3;
        return true;
      });
    }
    if (sessionVal) {
      rows = rows.filter((r) => r[SESSION] === sessionVal);
    }
    if (typeVal) {
      rows = rows.filter((r) => r[TYPE] === typeVal);
    }

    rows = sortRows(rows, el("sort-select").value);
    filtered = rows;
    renderResults();
  }

  function matchesQuery(row, q, field) {
    if (field === "all") {
      return (
        row[NAME].toLowerCase().includes(q) ||
        row[FATHER].toLowerCase().includes(q) ||
        row[MOTHER].toLowerCase().includes(q) ||
        row[ROLL].toLowerCase().includes(q) ||
        row[REG].toLowerCase().includes(q)
      );
    }
    if (field === "n") return row[NAME].toLowerCase().includes(q);
    if (field === "f") return row[FATHER].toLowerCase().includes(q);
    if (field === "m") return row[MOTHER].toLowerCase().includes(q);
    if (field === "r") return row[ROLL].toLowerCase().includes(q);
    if (field === "g") return row[REG].toLowerCase().includes(q);
    return false;
  }

  function sortRows(rows, mode) {
    const copy = rows.slice();
    switch (mode) {
      case "roll-desc":
        copy.sort((a, b) => b[ROLL].localeCompare(a[ROLL], undefined, { numeric: true }));
        break;
      case "gpa-desc":
        copy.sort((a, b) => gpaSortVal(b[GPA]) - gpaSortVal(a[GPA]));
        break;
      case "gpa-asc":
        copy.sort((a, b) => gpaSortVal(a[GPA]) - gpaSortVal(b[GPA]));
        break;
      case "name-asc":
        copy.sort((a, b) => a[NAME].localeCompare(b[NAME]));
        break;
      case "roll-asc":
      default:
        copy.sort((a, b) => a[ROLL].localeCompare(b[ROLL], undefined, { numeric: true }));
        break;
    }
    return copy;
  }

  function gpaSortVal(g) {
    if (typeof g === "number" && g >= 0) return g;
    return -99; // fail/absent/reported sink to bottom when sorting desc, top when asc reversed naturally
  }

  // ---------- Rendering ----------

  function renderResults() {
    const total = filtered.length;
    el("results-count").textContent =
      total === 0 ? "No matching records" : "Showing " + fmtInt(Math.min(PAGE_SIZE, total)) + " of " + fmtInt(total) + " results";

    const tbody = el("results-body");
    const emptyState = el("empty-state");

    if (total === 0) {
      tbody.innerHTML = "";
      emptyState.hidden = false;
      el("pagination").innerHTML = "";
      return;
    }
    emptyState.hidden = true;

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    const frag = document.createDocumentFragment();
    pageRows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML =
        '<td class="col-roll">' + escapeHtml(row[ROLL]) + '</td>' +
        '<td class="col-name">' + escapeHtml(row[NAME]) + '</td>' +
        '<td class="col-father">' + escapeHtml(row[FATHER]) + '</td>' +
        '<td class="col-inst">' + escapeHtml(DATA.insts[row[INST]]) + '</td>' +
        '<td class="col-center">' + escapeHtml(DATA.centers[row[CENTER]]) + '</td>' +
        '<td class="col-result">' + badgeFor(row[GPA]) + '</td>';
      tr.addEventListener("click", () => openCard(row));
      frag.appendChild(tr);
    });
    tbody.innerHTML = "";
    tbody.appendChild(frag);

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = el("pagination");
    container.innerHTML = "";
    if (totalPages <= 1) return;

    const makeBtn = (label, page, opts = {}) => {
      const b = document.createElement("button");
      b.textContent = label;
      if (opts.active) b.classList.add("active");
      if (opts.disabled) b.disabled = true;
      b.addEventListener("click", () => {
        currentPage = page;
        renderResults();
        window.scrollTo({ top: el("search-input").offsetTop - 20, behavior: "smooth" });
      });
      return b;
    };

    container.appendChild(makeBtn("‹ Prev", currentPage - 1, { disabled: currentPage === 1 }));

    const pages = pageWindow(currentPage, totalPages);
    pages.forEach((p) => {
      if (p === "...") {
        const span = document.createElement("span");
        span.className = "dots";
        span.textContent = "…";
        container.appendChild(span);
      } else {
        container.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
      }
    });

    container.appendChild(makeBtn("Next ›", currentPage + 1, { disabled: currentPage === totalPages }));
  }

  function pageWindow(current, total) {
    const delta = 2;
    const range = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    if (range[0] > 1) {
      if (range[0] > 2) range.unshift("...");
      range.unshift(1);
    }
    if (range[range.length - 1] < total) {
      if (range[range.length - 1] < total - 1) range.push("...");
      range.push(total);
    }
    return range;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ---------- Result card ----------

  function openCard(row) {
    el("card-name").textContent = row[NAME];
    el("card-roll").textContent =
      "Roll " + row[ROLL] + (row[REG] ? " · Reg " + row[REG] : "");

    const fieldsWrap = el("card-fields");
    const fields = [
      ["Father's Name", row[FATHER]],
      ["Mother's Name", row[MOTHER]],
      ["Group", row[GROUP]],
      ["Type", titleCase(row[TYPE])],
      ["Institute", DATA.insts[row[INST]]],
      ["Center", DATA.centers[row[CENTER]]],
      ["Session", row[SESSION]],
      ["Passing Year", row[PYEAR]]
    ];
    fieldsWrap.innerHTML = fields
      .map(
        ([label, val]) =>
          "<div><dt>" + escapeHtml(label) + "</dt><dd>" + (escapeHtml(val) || "—") + "</dd></div>"
      )
      .join("");

    const verdict = el("card-verdict");
    const gpa = row[GPA];
    verdict.classList.toggle("is-fail", gpa === -1 || gpa === -2 || gpa === -3);
    el("card-result").textContent = resultLabel(gpa);

    const subjTbody = document.querySelector("#card-subjects tbody");
    const subs = row[SUBS];
    const rowsHtml = DATA.subjOrder
      .map((subjFull, i) => {
        const grade = subs[i];
        if (!grade) return "";
        const label = SUBJECT_LABELS[subjFull] || subjFull;
        return "<tr><td>" + escapeHtml(label) + "</td><td>" + escapeHtml(grade) + "</td></tr>";
      })
      .join("");
    subjTbody.innerHTML = rowsHtml || "<tr><td colspan='2'>No subject-wise grades on record.</td></tr>";

    el("overlay").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCard() {
    el("overlay").hidden = true;
    document.body.style.overflow = "";
  }

  function titleCase(s) {
    if (!s) return s;
    return s.charAt(0) + s.slice(1).toLowerCase();
  }

  document.addEventListener("DOMContentLoaded", loadData);
})();
